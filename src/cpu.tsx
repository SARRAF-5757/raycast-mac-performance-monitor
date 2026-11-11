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
import { InactiveNotice } from "./components/InactiveNotice";
import { SubprocessList } from "./components/SubprocessList";
import { TimeRange } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import { generateAreaChart, generateCoreGrid } from "./utils/charts";
import { openApp } from "./utils/deepLink";
import { formatBytes, formatPercent } from "./utils/formatting";

export default function Command() {
  const { snapshot, history, range, setRange, cores, apps, isLoading, isInactive, lastUpdated, refresh } = useLiveStats(
    { sortMetric: "cpu", appLimit: 40 },
  );

  if (!snapshot && isInactive) {
    return <InactiveNotice lastUpdated={lastUpdated} />;
  }

  const cpuPoints = history.map((h) => h.cpuPercent);
  const cpuChartUri = generateAreaChart(cpuPoints, {
    label: "CPU Usage",
    color: "#BF5AF2",
    unit: "%",
    maxValue: 100,
  });

  const coreGridUri = cores.length > 0 ? generateCoreGrid(cores) : null;

  const tick = snapshot?.timestamp ?? Date.now();
  const markdownHeader = `
![CPU Usage - ${tick}](${cpuChartUri}?raycast-width=760)

${coreGridUri ? `![CPU Cores - ${tick}](${coreGridUri}?raycast-width=760)` : ""}
  `.trim();

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter apps by CPU usage..."
      searchBarAccessory={
        <List.Dropdown tooltip="History Window" value={range} onChange={(newVal) => setRange(newVal as TimeRange)}>
          <List.Dropdown.Item title="Last 5 Minutes" value="5m" />
          <List.Dropdown.Item title="Last 15 Minutes" value="15m" />
          <List.Dropdown.Item title="Last 1 Hour" value="1h" />
          <List.Dropdown.Item title="Last 24 Hours" value="24h" />
        </List.Dropdown>
      }
    >
      <List.Section title={`Active Applications (${apps.length})`}>
        {apps.map((app) => {
          return (
            <List.Item
              key={app.appName}
              title={app.appName}
              icon={Icon.ComputerChip}
              accessories={[
                { text: `${formatPercent(app.cpuPercent)}`, tooltip: "Total CPU Percentage across subprocesses" },
                { text: `${app.processCount} proc`, tooltip: "Processes in App Coalition" },
              ]}
              detail={
                <List.Item.Detail
                  markdown={markdownHeader}
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label title="App Name" text={app.appName} />
                      <List.Item.Detail.Metadata.TagList title="CPU Usage">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={formatPercent(app.cpuPercent)}
                          color={app.cpuPercent > 50 ? Color.Red : app.cpuPercent > 20 ? Color.Orange : Color.Purple}
                        />
                      </List.Item.Detail.Metadata.TagList>
                      <List.Item.Detail.Metadata.Label title="Processes" text={`${app.processCount} active`} />
                      <List.Item.Detail.Metadata.Label title="Memory Footprint" text={formatBytes(app.memoryBytes)} />
                      <List.Item.Detail.Metadata.Label title="GPU Usage" text={formatPercent(app.gpuPercent)} />
                      <List.Item.Detail.Metadata.Label title="Energy Impact" text={app.energyImpact.toFixed(1)} />
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label
                        title="System CPU Load"
                        text={formatPercent((snapshot?.cpuLoad || 0) * 100)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Load Averages"
                        text={`${snapshot?.load1.toFixed(2)} (1m) · ${snapshot?.load5.toFixed(2)} (5m) · ${snapshot?.load15.toFixed(2)} (15m)`}
                      />
                      {app.executablePath ? (
                        <List.Item.Detail.Metadata.Label title="Executable" text={app.executablePath} />
                      ) : null}
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Inspect Subprocesses"
                    icon={Icon.List}
                    target={<SubprocessList appName={app.appName} />}
                  />
                  <ActionPanel.Section title="App Actions">
                    {app.executablePath ? (
                      <Action
                        title="Reveal in Finder"
                        icon={Icon.Finder}
                        shortcut={{ modifiers: ["cmd"], key: "f" }}
                        onAction={async () => {
                          try {
                            if (app.executablePath) await showInFinder(app.executablePath);
                          } catch {
                            await showToast({ style: Toast.Style.Failure, title: "Could not reveal in Finder" });
                          }
                        }}
                      />
                    ) : null}
                    <Action
                      title="Copy App Stats"
                      icon={Icon.CopyClipboard}
                      shortcut={{ modifiers: ["cmd"], key: "c" }}
                      onAction={async () => {
                        const text = `${app.appName}: ${app.cpuPercent.toFixed(1)}% CPU, ${formatBytes(app.memoryBytes)} RAM, ${app.processCount} processes`;
                        await Clipboard.copy(text);
                        await showToast({ style: Toast.Style.Success, title: "Copied Stats to Clipboard" });
                      }}
                    />
                    <Action
                      title="Open in Mac Performance Monitor"
                      icon={Icon.AppWindow}
                      shortcut={Keyboard.Shortcut.Common.Open}
                      onAction={openApp}
                    />
                    <Action
                      title="Refresh"
                      icon={Icon.ArrowClockwise}
                      shortcut={Keyboard.Shortcut.Common.Refresh}
                      onAction={refresh}
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
