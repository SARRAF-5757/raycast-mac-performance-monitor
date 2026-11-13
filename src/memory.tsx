import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { InactiveNotice } from "./components/InactiveNotice";
import { SubprocessList } from "./components/SubprocessList";
import { TimeRange } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import { generateAreaChart, generateStackedBar } from "./utils/charts";
import { openApp } from "./utils/deepLink";
import { formatBytes } from "./utils/formatting";

export default function Command() {
  const { snapshot, history, range, setRange, apps, isLoading, isInactive } = useLiveStats({
    sortMetric: "memory",
    appLimit: 40,
  });

  if (isLoading && !snapshot) {
    return <List isLoading={true} searchBarPlaceholder="Loading memory telemetry..." />;
  }

  if (isInactive) {
    return <InactiveNotice />;
  }

  const pressurePoints = history.map((h) => h.memoryPressure);
  const pressureColor =
    (snapshot?.pressurePercent || 0) >= 67 ? "#FF453A" : (snapshot?.pressurePercent || 0) >= 34 ? "#FF9F0A" : "#0A84FF";

  const pressureChartUri = generateAreaChart(pressurePoints, {
    label: "Memory Pressure",
    color: pressureColor,
    unit: "%",
    maxValue: 100,
  });

  const totalRam = snapshot?.totalRam || 1;
  const slices = snapshot
    ? [
        { label: "Wired", value: snapshot.wiredRam, color: "#FF375F" },
        { label: "Active", value: snapshot.activeRam, color: "#0A84FF" },
        { label: "Compressed", value: snapshot.compressedRam, color: "#FF9F0A" },
        { label: "Cached", value: snapshot.cachedFiles, color: "#5E5CE6" },
        { label: "Free", value: snapshot.freeRam, color: "#30D158" },
      ]
    : [];

  const swapSubtitle = snapshot
    ? `Total ${formatBytes(totalRam)} · Swap: ${formatBytes(snapshot.swapUsed)}`
    : undefined;
  const compUri = snapshot
    ? generateStackedBar(slices, totalRam, "Memory Composition Breakdown", 760, 90, swapSubtitle)
    : null;

  const tick = snapshot?.timestamp ?? Date.now();
  const markdownHeader = `
![Memory Pressure - ${tick}](${pressureChartUri}?raycast-width=760)

${compUri ? `![Memory Composition Breakdown - ${tick}](${compUri}?raycast-width=760)` : ""}
  `.trim();

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter apps by Memory usage..."
      searchBarAccessory={
        <List.Dropdown tooltip="History Window" value={range} onChange={(newVal) => setRange(newVal as TimeRange)}>
          <List.Dropdown.Item title="Last 5 Minutes" value="5m" />
          <List.Dropdown.Item title="Last 15 Minutes" value="15m" />
          <List.Dropdown.Item title="Last 30 Minutes" value="30m" />
          <List.Dropdown.Item title="Last 1 Hour" value="1h" />
          <List.Dropdown.Item title="Last 6 Hours" value="6h" />
          <List.Dropdown.Item title="Last 24 Hours" value="24h" />
        </List.Dropdown>
      }
    >
      <List.Section title={`Active Applications (${apps.length})`}>
        {apps.map((app) => (
          <List.Item
            key={app.appName}
            title={app.appName}
            icon={Icon.MemoryChip}
            accessories={[
              { text: formatBytes(app.memoryBytes), tooltip: "Summed RAM across all subprocesses" },
              { text: `${app.processCount} proc`, tooltip: "Processes in App Coalition" },
            ]}
            detail={
              <List.Item.Detail
                markdown={markdownHeader}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="App Name" text={app.appName} />
                    <List.Item.Detail.Metadata.TagList title="Memory Footprint">
                      <List.Item.Detail.Metadata.TagList.Item
                        text={formatBytes(app.memoryBytes)}
                        color={
                          app.memoryBytes > 2 * 1024 * 1024 * 1024
                            ? Color.Red
                            : app.memoryBytes > 1024 * 1024 * 1024
                              ? Color.Orange
                              : Color.Blue
                        }
                      />
                    </List.Item.Detail.Metadata.TagList>
                    <List.Item.Detail.Metadata.Label title="Processes" text={`${app.processCount} active`} />
                    {app.executablePath ? (
                      <List.Item.Detail.Metadata.Label title="Executable Path" text={app.executablePath} />
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
                <Action
                  title="Open Mac Performance Monitor"
                  icon={Icon.AppWindow}
                  shortcut={Keyboard.Shortcut.Common.Open}
                  onAction={openApp}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
