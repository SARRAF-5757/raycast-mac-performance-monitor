import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { generateInactiveSvg } from "../utils/charts";
import { openApp } from "../utils/deepLink";

/**
 * Notice view presented when the native Mac Performance Monitor app is not running.
 * Displays a clean blank screen with an icon and centered message stating the app is not running.
 * Pressing Enter opens the native Mac Performance Monitor app.
 */
export function InactiveNotice() {
  const svg = generateInactiveSvg();

  return (
    <Detail
      markdown={`![Mac Performance Monitor isn't running](${svg}?raycast-width=760)`}
      actions={
        <ActionPanel>
          <Action title="Open Mac Performance Monitor" icon={Icon.AppWindow} onAction={openApp} />
        </ActionPanel>
      }
    />
  );
}
