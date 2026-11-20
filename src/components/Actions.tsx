/**
 * Actions shared by the list views: opening the native app, refreshing, and the
 * full action panel attached to every application row.
 */

import { Action, ActionPanel, Clipboard, Icon, Keyboard, showInFinder, showToast, Toast } from "@raycast/api";
import { AppGroup } from "../data/types";
import { openApp } from "../utils/deepLink";
import { forceQuitApp, quitApp } from "../utils/processControl";
import { SubprocessList } from "./SubprocessList";

/** Opens the native Mac Performance Monitor app (Cmd+O). */
export function OpenMonitorAction() {
  return (
    <Action
      title="Open Mac Performance Monitor"
      icon={Icon.AppWindow}
      shortcut={Keyboard.Shortcut.Common.Open}
      onAction={openApp}
    />
  );
}

interface RefreshActionProps {
  onRefresh: () => void;
}

/** Re-runs the data fetch right away (Cmd+R). */
export function RefreshAction(props: RefreshActionProps) {
  return (
    <Action
      title="Refresh Now"
      icon={Icon.ArrowClockwise}
      shortcut={Keyboard.Shortcut.Common.Refresh}
      onAction={props.onRefresh}
    />
  );
}

/** Shows a file in Finder, with a toast if it no longer exists. */
export async function revealPath(path: string): Promise<void> {
  try {
    await showInFinder(path);
  } catch {
    await showToast({ style: Toast.Style.Failure, title: "Could not reveal in Finder" });
  }
}

/** Copies text to the clipboard and confirms with a toast. */
export async function copyWithToast(text: string, toastTitle: string): Promise<void> {
  await Clipboard.copy(text);
  await showToast({ style: Toast.Style.Success, title: toastTitle });
}

interface AppGroupActionsProps {
  app: AppGroup;
  onRefresh: () => void;
}

/**
 * The action panel for one application row: drill into its processes, quit or
 * force quit it, copy its name, reveal its binary, and open the native app.
 */
export function AppGroupActions(props: AppGroupActionsProps) {
  const app = props.app;

  async function handleQuit() {
    await quitApp(app);
    props.onRefresh();
  }

  async function handleForceQuit() {
    await forceQuitApp(app);
    props.onRefresh();
  }

  return (
    <ActionPanel>
      <ActionPanel.Section>
        <Action.Push title="Inspect Processes" icon={Icon.List} target={<SubprocessList appName={app.appName} />} />
        <OpenMonitorAction />
        <RefreshAction onRefresh={props.onRefresh} />
      </ActionPanel.Section>
      <ActionPanel.Section title={app.appName}>
        <Action
          title="Quit App"
          icon={Icon.XMarkCircle}
          style={Action.Style.Destructive}
          shortcut={{ modifiers: ["ctrl"], key: "q" }}
          onAction={handleQuit}
        />
        <Action
          title="Force Quit App"
          icon={Icon.ExclamationMark}
          style={Action.Style.Destructive}
          shortcut={{ modifiers: ["ctrl", "shift"], key: "q" }}
          onAction={handleForceQuit}
        />
        <Action
          title="Copy App Name"
          icon={Icon.CopyClipboard}
          shortcut={Keyboard.Shortcut.Common.Copy}
          onAction={() => copyWithToast(app.appName, 'Copied "' + app.appName + '"')}
        />
        {app.executablePath !== null && (
          <Action
            title="Reveal Executable in Finder"
            icon={Icon.Finder}
            shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
            onAction={() => revealPath(app.executablePath as string)}
          />
        )}
      </ActionPanel.Section>
    </ActionPanel>
  );
}
