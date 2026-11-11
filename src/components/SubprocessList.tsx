import {
  Action,
  ActionPanel,
  Clipboard,
  Color,
  Icon,
  Keyboard,
  List,
  showInFinder,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { getAppSubprocesses } from "../data/queries";
import { SubprocessItem } from "../data/types";
import { openApp } from "../utils/deepLink";
import { formatBytes, formatPercent } from "../utils/formatting";

export function SubprocessList({ appName }: { appName: string }) {
  const [subprocesses, setSubprocesses] = useState<SubprocessItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAppSubprocesses(appName).then((items) => {
      if (active) {
        setSubprocesses(items);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [appName]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder={`Filter ${appName} subprocesses...`}>
      <List.Section title={`${appName} Processes (${subprocesses.length})`}>
        {subprocesses.map((proc) => {
          const archTag = proc.isTranslated ? "Rosetta (x86_64)" : proc.architecture;
          const archColor = proc.isTranslated ? Color.Orange : Color.Blue;

          return (
            <List.Item
              key={proc.pid}
              title={proc.name}
              subtitle={`PID ${proc.pid}`}
              icon={Icon.Terminal}
              accessories={[
                { text: formatBytes(proc.memoryBytes), tooltip: "Physical RAM Footprint" },
                { text: `${formatPercent(proc.cpuPercent)} CPU`, tooltip: "CPU Percentage" },
                { tag: { value: archTag, color: archColor }, tooltip: "Architecture" },
              ]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section title="Process Actions">
                    {proc.executablePath ? (
                      <Action
                        title="Reveal Executable in Finder"
                        icon={Icon.Finder}
                        onAction={async () => {
                          try {
                            await showInFinder(proc.executablePath);
                          } catch {
                            await showToast({ style: Toast.Style.Failure, title: "Could not reveal in Finder" });
                          }
                        }}
                      />
                    ) : null}
                    <Action
                      title="Copy PID"
                      icon={Icon.CopyClipboard}
                      shortcut={Keyboard.Shortcut.Common.Copy}
                      onAction={async () => {
                        await Clipboard.copy(String(proc.pid));
                        await showToast({ style: Toast.Style.Success, title: `Copied PID ${proc.pid}` });
                      }}
                    />
                    {proc.executablePath ? (
                      <Action
                        title="Copy Executable Path"
                        icon={Icon.Document}
                        shortcut={Keyboard.Shortcut.Common.Copy}
                        onAction={async () => {
                          await Clipboard.copy(proc.executablePath);
                          await showToast({ style: Toast.Style.Success, title: "Copied Path" });
                        }}
                      />
                    ) : null}
                    <Action
                      title="Open Mac Performance Monitor"
                      icon={Icon.AppWindow}
                      shortcut={Keyboard.Shortcut.Common.Open}
                      onAction={openApp}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
