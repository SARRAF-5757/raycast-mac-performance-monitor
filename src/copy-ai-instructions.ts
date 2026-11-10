import { Clipboard, showHUD } from "@raycast/api";
import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import { DATABASE_PATH } from "./data/db";
import { getMacTopology } from "./data/queries";
import { formatBytes } from "./utils/formatting";

const MPM_PATH = "/Applications/Mac Performance Monitor.app/Contents/MacOS/mpm";

function runMpmPrompt(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(MPM_PATH)) {
      reject(new Error("mpm executable not found"));
      return;
    }

    execFile(MPM_PATH, ["prompt"], { timeout: 6000 }, (error, stdout) => {
      if (error || !stdout || stdout.trim().length === 0) {
        reject(error || new Error("Empty prompt output"));
        return;
      }
      resolve(stdout);
    });
  });
}

async function generateFallbackPrompt(): Promise<string> {
  const topology = await getMacTopology();
  const cpus = os.cpus();
  const chipName = cpus[0]?.model || "Apple Silicon";

  return `
# Help me investigate my Mac

I use Mac Performance Monitor, a macOS app that records this Mac's performance history in a local SQLite database. Please use that history to investigate, check your conclusions against the data, and explain what you find in plain English.

## This Mac
- Chip: ${chipName}
- Cores: ${topology.cpuCores} (${topology.performanceCores} performance, ${topology.efficiencyCores} efficiency)
- Memory: ${formatBytes(topology.memoryBytes)}
- macOS ${os.release()}
- Database: ${DATABASE_PATH}

## Reading the data

If you have mpm installed:
\`\`\`sh
MPM="${MPM_PATH}"
"$MPM" schema                      # every view and column, with units
"$MPM" sql "SELECT ..."            # read-only SQL (add --format csv or json)
"$MPM" brief processor --last 60   # the app's own judged summary of one part
"$MPM" brief overall --at 10:00    # around a time today
"$MPM" find "Chrome"               # recorded runs of an app
"$MPM" link processor --last 60    # a link that opens the matching charts in the app
\`\`\`

If you use sqlite3 instead, open the database read-only only:
\`\`\`sh
sqlite3 -readonly "file:${DATABASE_PATH}?mode=ro"
\`\`\`

## Rules
- Never write to, copy, move or delete the database or anything in its folder. The app owns it; read it only.
- Query the agent_* views, not the raw tables. They stitch history together and use plain units.
- Always bound queries in time with ts (Unix seconds). For more than a couple of hours use agent_system_by_minute, not agent_system.
- NULL means not measured. Never treat it as zero.
- For how much of the Mac an app used, use cpu_share_of_mac_percent. cpu_percent_of_one_core can exceed 100.
- An app using a small share is not the cause of a slowdown, however high it ranks. Many small processes can add up.
- Processes with kind = 'macos' are part of macOS. Never suggest quitting them; say they usually settle, and a restart helps if one stays busy for hours.
- Memory pressure under 34 is fine, 34 to 66 means macOS is compressing memory, 67 and over means it is swapping and the Mac slows. High memory use alone is not a problem.

## What I want to know
Start by summarising how this Mac has been doing over the last hour, then ask me what to look into.
When you find something, show the numbers you used and give me a link so I can verify it.
  `.trim();
}

export default async function Command() {
  try {
    let promptText: string;
    try {
      promptText = await runMpmPrompt();
    } catch {
      promptText = await generateFallbackPrompt();
    }

    await Clipboard.copy(promptText);
    await showHUD("Copied Mac Performance Monitor AI Instructions to Clipboard");
  } catch (err) {
    await showHUD(`Failed to copy AI instructions: ${String(err)}`);
  }
}
