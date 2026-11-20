/**
 * Memory command: pressure history, RAM composition, and every running app
 * sorted by memory footprint.
 */

import { Color, Icon, List } from "@raycast/api";
import { AppGroupActions } from "./components/Actions";
import { InactiveNotice } from "./components/InactiveNotice";
import { RangeDropdown } from "./components/RangeDropdown";
import { AppGroup, SystemSnapshot } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import { generateAreaChart, generateStackedBar } from "./utils/charts";
import { formatBytes, formatPercent } from "./utils/formatting";
import { memorySlices, memorySubtitle, pressureColor } from "./utils/memory";

const ONE_GB = 1024 * 1024 * 1024;

/** Red above 2 GB, orange above 1 GB, blue otherwise. */
function memoryTagColor(bytes: number): Color {
  if (bytes > 2 * ONE_GB) {
    return Color.Red;
  }
  if (bytes > ONE_GB) {
    return Color.Orange;
  }
  return Color.Blue;
}

export default function Command() {
  const stats = useLiveStats({ sortMetric: "memory" });
  const snapshot = stats.snapshot;

  if (stats.isLoading && snapshot === null) {
    return <List isLoading searchBarPlaceholder="Loading memory telemetry..." />;
  }
  if (!stats.isAppRunning || snapshot === null) {
    return <InactiveNotice />;
  }

  // Both charts are shown in the detail pane of every row, so build them once.
  const pressureValues = stats.history.map((point) => point.memoryPressure);
  const pressureChart = generateAreaChart(pressureValues, {
    label: "Memory Pressure",
    color: pressureColor(snapshot.pressurePercent),
    unit: "%",
    maxValue: 100,
  });
  const compositionChart = generateStackedBar(
    memorySlices(snapshot),
    snapshot.totalRam,
    "Memory Composition",
    760,
    90,
    memorySubtitle(snapshot),
  );
  
  // The timestamp in the image title changes every tick, which makes Raycast redraw the image.
  const tick = snapshot.timestamp;
  const markdown =
    "![Memory Pressure - " +
    tick +
    "](" +
    pressureChart +
    "?raycast-width=760)\n\n" +
    "![Memory Composition - " +
    tick +
    "](" +
    compositionChart +
    "?raycast-width=760)";

  return (
    <List
      isLoading={stats.isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter apps by name..."
      searchBarAccessory={<RangeDropdown value={stats.range} onChange={stats.setRange} />}
    >
      <List.Section title="Applications by Memory" subtitle={String(stats.apps.length)}>
        {stats.apps.map((app) => (
          <List.Item
            key={app.appName}
            title={app.appName}
            icon={Icon.MemoryChip}
            accessories={[
              { text: formatBytes(app.memoryBytes), tooltip: "Memory footprint across all processes" },
              { text: String(app.processCount), icon: Icon.Layers, tooltip: "Processes" },
            ]}
            detail={<List.Item.Detail markdown={markdown} metadata={<AppMetadata app={app} snapshot={snapshot} />} />}
            actions={<AppGroupActions app={app} onRefresh={stats.refresh} />}
          />
        ))}
      </List.Section>
    </List>
  );
}

interface AppMetadataProps {
  app: AppGroup;
  snapshot: SystemSnapshot;
}

/** The right-hand metadata column of the detail pane. */
function AppMetadata(props: AppMetadataProps) {
  const app = props.app;
  const snapshot = props.snapshot;
  const shareOfRam = snapshot.totalRam > 0 ? (app.memoryBytes / snapshot.totalRam) * 100 : 0;

  return (
    <List.Item.Detail.Metadata>
      <List.Item.Detail.Metadata.TagList title="Memory">
        <List.Item.Detail.Metadata.TagList.Item
          text={formatBytes(app.memoryBytes)}
          color={memoryTagColor(app.memoryBytes)}
        />
      </List.Item.Detail.Metadata.TagList>
      <List.Item.Detail.Metadata.Label title="Share of RAM" text={formatPercent(shareOfRam)} />
      <List.Item.Detail.Metadata.Label title="CPU" text={formatPercent(app.cpuPercent)} />
      <List.Item.Detail.Metadata.Label title="Processes" text={String(app.processCount)} />
      <List.Item.Detail.Metadata.Separator />
      <List.Item.Detail.Metadata.Label
        title="Pressure"
        text={formatPercent(snapshot.pressurePercent) + " · swap " + formatBytes(snapshot.swapUsed)}
      />
      {app.executablePath !== null && <List.Item.Detail.Metadata.Label title="Executable" text={app.executablePath} />}
    </List.Item.Detail.Metadata>
  );
}
