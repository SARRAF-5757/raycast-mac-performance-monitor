import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { InactiveNotice } from "./components/InactiveNotice";
import { SubprocessList } from "./components/SubprocessList";
import { TimeRange } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import { generateAreaChart, generateStackedBar } from "./utils/charts";
import { openApp } from "./utils/deepLink";
import { formatBytes, formatPercent } from "./utils/formatting";

export default function Command() {
  const { snapshot, history, range, setRange, apps, isLoading, isInactive, lastUpdated } = useLiveStats({
    sortMetric: "memory",
    appLimit: 40,
  });

  if (!snapshot && isInactive) {
    return <InactiveNotice lastUpdated={lastUpdated} />;
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
        {apps.map((app) => {
          const ramShare = totalRam > 0 ? (app.memoryBytes / totalRam) * 100 : 0;

          return (
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
                      <List.Item.Detail.Metadata.Label title="Share of Physical RAM" text={formatPercent(ramShare)} />
                      <List.Item.Detail.Metadata.Label title="Processes" text={`${app.processCount} active`} />
                      <List.Item.Detail.Metadata.Label title="CPU Usage" text={formatPercent(app.cpuPercent)} />
                      <List.Item.Detail.Metadata.Label title="Energy Impact" text={app.energyImpact.toFixed(1)} />
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label
                        title="System Memory Pressure"
                        text={`${formatPercent(snapshot?.pressurePercent || 0)} (${(snapshot?.pressurePercent || 0) >= 67 ? "Critical" : (snapshot?.pressurePercent || 0) >= 34 ? "Warning" : "Nominal"})`}
                      />
                      <List.Item.Detail.Metadata.Label title="Total Physical RAM" text={formatBytes(totalRam)} />
                      <List.Item.Detail.Metadata.Label
                        title="Active RAM"
                        text={formatBytes(snapshot?.activeRam || 0)}
                      />
                      <List.Item.Detail.Metadata.Label title="Wired RAM" text={formatBytes(snapshot?.wiredRam || 0)} />
                      <List.Item.Detail.Metadata.Label
                        title="Compressed RAM"
                        text={formatBytes(snapshot?.compressedRam || 0)}
                      />
                      <List.Item.Detail.Metadata.TagList title="Swap Memory">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={`${formatBytes(snapshot?.swapUsed || 0)} used (${formatBytes(snapshot?.swapTotal || 0)} total)`}
                          color={
                            (snapshot?.swapUsed || 0) > 2 * 1024 * 1024 * 1024
                              ? Color.Red
                              : (snapshot?.swapUsed || 0) > 512 * 1024 * 1024
                                ? Color.Orange
                                : Color.SecondaryText
                          }
                        />
                      </List.Item.Detail.Metadata.TagList>
                      <List.Item.Detail.Metadata.Label title="Free RAM" text={formatBytes(snapshot?.freeRam || 0)} />
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
                  <Action
                    title="Open Mac Performance Monitor"
                    icon={Icon.AppWindow}
                    shortcut={Keyboard.Shortcut.Common.Open}
                    onAction={openApp}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
