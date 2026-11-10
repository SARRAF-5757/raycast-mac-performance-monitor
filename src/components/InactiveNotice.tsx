import { Action, ActionPanel, Color, Detail, Icon } from "@raycast/api";
import { openApp } from "../utils/deepLink";
import { formatTime } from "../utils/formatting";

export function InactiveNotice({ lastUpdated }: { lastUpdated: Date | null }) {
  const timeStr = lastUpdated ? formatTime(Math.floor(lastUpdated.getTime() / 1000)) : "Unknown";

  const markdown = `
# Mac Performance Monitor is Not Recording

The app is currently paused or not running. Showing the last recorded snapshot from **${timeStr}**.

Launch **Mac Performance Monitor** to resume live real-time metrics and logging.
  `.trim();

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item text="Paused / Inactive" color={Color.Yellow} />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Label title="Last Recorded" text={timeStr} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action title="Launch Mac Performance Monitor" icon={Icon.Play} onAction={openApp} />
        </ActionPanel>
      }
    />
  );
}
