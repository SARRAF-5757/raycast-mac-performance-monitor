import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const DATABASE_PATH = path.join(
  os.homedir(),
  "Library/Application Support/MacPerformanceMonitor/macperfmonitor.sqlite",
);

export function isDatabaseAvailable(): boolean {
  return fs.existsSync(DATABASE_PATH);
}

export function querySqlite<T>(sql: string): Promise<T[]> {
  return new Promise((resolve) => {
    if (!isDatabaseAvailable()) {
      resolve([]);
      return;
    }

    const uri = `file:${DATABASE_PATH}?mode=ro`;
    execFile(
      "/usr/bin/sqlite3",
      ["-json", uri, sql],
      { timeout: 4000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error || !stdout || stdout.trim().length === 0) {
          resolve([]);
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as T[];
          resolve(parsed);
        } catch {
          resolve([]);
        }
      },
    );
  });
}
