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
import { classifyProcessWorkload } from "./data/queries";
import { TimeRange } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import { generateDualAreaChart, generateStackedBar } from "./utils/charts";
import { openApp } from "./utils/deepLink";
import { formatBytes, formatIops, formatLatency, formatPercent, formatRate } from "./utils/formatting";

export default function Command() {
  const { snapshot, history, range, setRange, apps, diskWorkload, isLoading, isInactive, lastUpdated, refresh } =
    useLiveStats({ sortMetric: "disk", appLimit: 40 });

  if (!snapshot && isInactive) {
    return <InactiveNotice lastUpdated={lastUpdated} />;
  }

  const readPoints = history.map((h) => h.diskReadMb);
  const writePoints = history.map((h) => h.diskWriteMb);
  const diskChartUri = generateDualAreaChart(readPoints, writePoints, {
    labelA: "Disk Read",
    labelB: "Disk Write",
    colorA: "#64D2FF",
    colorB: "#FF9F0A",
    unit: "MB/s",
  });

  const totalDisk = diskWorkload.aiMl + diskWorkload.displayUi + diskWorkload.media + diskWorkload.other;
  const diskSlices = [
    { label: "AI & ML", value: diskWorkload.aiMl, color: "#BF5AF2" },
    { label: "Display/UI", value: diskWorkload.displayUi, color: "#0A84FF" },
    { label: "Media", value: diskWorkload.media, color: "#FF9F0A" },
    { label: "Other", value: diskWorkload.other, color: "#8E8E93" },
  ];

  const taxonomyUri = totalDisk > 0 ? generateStackedBar(diskSlices, totalDisk, "Disk Workload Taxonomy") : null;

  const markdownHeader = `
![Disk Throughput](${diskChartUri})

${taxonomyUri ? `![Taxonomy](${taxonomyUri})` : ""}
  `.trim();

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter apps by Disk I/O..."
      searchBarAccessory={
        <List.Dropdown tooltip="History Window" value={range} onChange={(newVal) => setRange(newVal as TimeRange)}>
          <List.Dropdown.Item title="Last 5 Minutes" value="5m" />
          <List.Dropdown.Item title="Last 15 Minutes" value="15m" />
          <List.Dropdown.Item title="Last 1 Hour" value="1h" />
          <List.Dropdown.Item title="Last 24 Hours" value="24h" />
        </List.Dropdown>
      }
    >
      <List.Section title={`Disk Consumer Applications (${apps.length})`}>
        {apps.map((app) => {
          const totalAppDisk = app.diskReadBytes + app.diskWrittenBytes;
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
              icon={Icon.HardDrive}
              accessories={[
                { text: formatBytes(totalAppDisk), tooltip: "Total Read and Written Bytes" },
                {
                  tag: { value: categoryLabels[category], color: categoryColors[category] },
                  tooltip: "Taxonomy Category",
                },
              ]}
              detail={
                <List.Item.Detail
                  markdown={markdownHeader}
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label title="App Name" text={app.appName} />
                      <List.Item.Detail.Metadata.TagList title="Total Disk I/O">
                        <List.Item.Detail.Metadata.TagList.Item text={formatBytes(totalAppDisk)} color={Color.Blue} />
                      </List.Item.Detail.Metadata.TagList>
                      <List.Item.Detail.Metadata.Label title="Bytes Read" text={formatBytes(app.diskReadBytes)} />
                      <List.Item.Detail.Metadata.Label title="Bytes Written" text={formatBytes(app.diskWrittenBytes)} />
                      <List.Item.Detail.Metadata.TagList title="Workload Category">
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
                        title="Live Read Rate"
                        text={formatRate(snapshot?.diskRead || 0)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Live Write Rate"
                        text={formatRate(snapshot?.diskWrite || 0)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Read / Write IOPS"
                        text={`${formatIops(snapshot?.diskReadIops || 0)} / ${formatIops(snapshot?.diskWriteIops || 0)}`}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Latency"
                        text={`Read: ${formatLatency(snapshot?.diskReadLatency || 0)} · Write: ${formatLatency(snapshot?.diskWriteLatency || 0)}`}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Startup Disk Free"
                        text={`${formatBytes(snapshot?.bootFree || 0)} of ${formatBytes(snapshot?.bootTotal || 0)}`}
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
                        const text = `${app.appName}: ${formatBytes(totalAppDisk)} Total I/O (${formatBytes(app.diskReadBytes)} Read, ${formatBytes(app.diskWrittenBytes)} Written)`;
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
