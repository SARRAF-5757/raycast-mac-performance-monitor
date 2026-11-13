import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { InactiveNotice } from "./components/InactiveNotice";
import { SubprocessList } from "./components/SubprocessList";
import { classifyProcessWorkload } from "./data/queries";
import { TimeRange } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import { generateAreaChart, generateStackedBar } from "./utils/charts";
import { openApp } from "./utils/deepLink";
import { formatBytes, formatPercent, formatTemp, formatWatts } from "./utils/formatting";

export default function Command() {
  const { snapshot, history, range, setRange, apps, gpuWorkload, isLoading, isInactive } = useLiveStats({
    sortMetric: "gpu",
    appLimit: 40,
  });

  if (isLoading && !snapshot) {
    return <List isLoading={true} searchBarPlaceholder="Loading GPU telemetry..." />;
  }

  if (isInactive) {
    return <InactiveNotice />;
  }

  const gpuPoints = history.map((h) => h.gpuPercent);
  const gpuChartUri = generateAreaChart(gpuPoints, {
    label: "GPU Usage",
    color: "#30D158",
    unit: "%",
    maxValue: 100,
  });

  const totalGpu = gpuWorkload.aiMl + gpuWorkload.displayUi + gpuWorkload.media + gpuWorkload.other;
  const gpuSlices = [
    { label: "AI & ML", value: gpuWorkload.aiMl, color: "#BF5AF2", formatted: `${gpuWorkload.aiMl.toFixed(1)}%` },
    {
      label: "Display/UI",
      value: gpuWorkload.displayUi,
      color: "#0A84FF",
      formatted: `${gpuWorkload.displayUi.toFixed(1)}%`,
    },
    { label: "Media", value: gpuWorkload.media, color: "#FF9F0A", formatted: `${gpuWorkload.media.toFixed(1)}%` },
    { label: "Other", value: gpuWorkload.other, color: "#8E8E93", formatted: `${gpuWorkload.other.toFixed(1)}%` },
  ];

  const workloadUri = totalGpu > 0 ? generateStackedBar(gpuSlices, totalGpu, "GPU Usage Breakdown") : null;

  const tick = snapshot?.timestamp ?? Date.now();
  const markdownHeader = `
![GPU Usage - ${tick}](${gpuChartUri}?raycast-width=760)

${workloadUri ? `![GPU Usage Breakdown - ${tick}](${workloadUri}?raycast-width=760)` : ""}
  `.trim();

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter apps by GPU usage..."
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
      <List.Section title={`GPU Applications (${apps.length})`}>
        {apps.map((app) => {
          const category = classifyProcessWorkload(app.appName, app.bundleId, app.executablePath);
          const categoryLabels: Record<string, string> = {
            aiMl: "AI & ML",
            displayUi: "Display & UI",
            media: "Media",
            other: "General App",
          };
          const categoryColors: Record<string, Color> = {
            aiMl: Color.Purple,
            displayUi: Color.Blue,
            media: Color.Orange,
            other: Color.SecondaryText,
          };

          return (
            <List.Item
              key={app.appName}
              title={app.appName}
              icon={Icon.Eye}
              accessories={[
                { text: formatPercent(app.gpuPercent), tooltip: "GPU Percentage" },
                {
                  tag: { value: categoryLabels[category], color: categoryColors[category] },
                  tooltip: "Workload Category",
                },
              ]}
              detail={
                <List.Item.Detail
                  markdown={markdownHeader}
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label title="App Name" text={app.appName} />
                      <List.Item.Detail.Metadata.TagList title="GPU Usage">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={formatPercent(app.gpuPercent)}
                          color={app.gpuPercent > 20 ? Color.Red : app.gpuPercent > 5 ? Color.Orange : Color.Green}
                        />
                      </List.Item.Detail.Metadata.TagList>
                      <List.Item.Detail.Metadata.TagList title="Workload Type">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={categoryLabels[category]}
                          color={categoryColors[category]}
                        />
                      </List.Item.Detail.Metadata.TagList>
                      <List.Item.Detail.Metadata.Label title="Processes" text={`${app.processCount} active`} />
                      <List.Item.Detail.Metadata.Label title="Memory Footprint" text={formatBytes(app.memoryBytes)} />
                      <List.Item.Detail.Metadata.Label title="CPU Usage" text={formatPercent(app.cpuPercent)} />
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label
                        title="System GPU Load"
                        text={formatPercent(snapshot?.gpuUtil || 0)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="GPU Power Draw"
                        text={formatWatts(snapshot?.gpuPower || 0)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Neural Engine (ANE) Power"
                        text={formatWatts(snapshot?.anePower || 0)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="GPU Temperature"
                        text={formatTemp(snapshot?.gpuDieTemp ?? null)}
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
