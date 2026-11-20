/**
 * GPU command: utilization history, workload breakdown, and the apps that are
 * using the GPU right now.
 */
 
import { Color, Icon, List } from "@raycast/api";
import { AppGroupActions } from "./components/Actions";
import { InactiveNotice } from "./components/InactiveNotice";
import { RangeDropdown } from "./components/RangeDropdown";
import { classifyProcessWorkload } from "./data/queries";
import { AppGroup, SystemSnapshot, WorkloadSlices } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import { generateAreaChart, generateStackedBar } from "./utils/charts";
import { formatPercent, formatWatts } from "./utils/formatting";
import { BarSlice } from "./utils/memory";
import { WORKLOAD_CATEGORIES, workloadColor, workloadHexColor, workloadLabel } from "./utils/workload";

/** One slice per workload category for the stacked bar, labeled in percent. */
export function gpuWorkloadSlices(workload: WorkloadSlices): (BarSlice & { formatted: string })[] {
  const slices = [];
  for (const category of WORKLOAD_CATEGORIES) {
    slices.push({
      label: workloadLabel(category),
      value: workload[category],
      color: workloadHexColor(category),
      formatted: formatPercent(workload[category]),
    });
  }
  return slices;
}

/** Total GPU percent attributed to apps. */
export function totalWorkload(workload: WorkloadSlices): number {
  return workload.aiMl + workload.displayUi + workload.media + workload.other;
}

function gpuTagColor(gpuPercent: number): Color {
  if (gpuPercent > 20) {
    return Color.Red;
  }
  if (gpuPercent > 5) {
    return Color.Orange;
  }
  return Color.Green;
}

export default function Command() {
  const stats = useLiveStats({ sortMetric: "gpu" });
  const snapshot = stats.snapshot;

  if (stats.isLoading && snapshot === null) {
    return <List isLoading searchBarPlaceholder="Loading GPU telemetry..." />;
  }
  if (!stats.isAppRunning || snapshot === null) {
    return <InactiveNotice />;
  }

  // Only apps actually using the GPU are listed; everything else would be a wall of 0.0%.
  const gpuApps = stats.apps.filter((app) => app.gpuPercent > 0);

  const gpuValues = stats.history.map((point) => point.gpuPercent);
  const gpuChart = generateAreaChart(gpuValues, { label: "GPU Usage", color: "#30D158", unit: "%", maxValue: 100 });
  const tick = snapshot.timestamp;
  let markdown = "![GPU Usage - " + tick + "](" + gpuChart + "?raycast-width=760)";

  const total = totalWorkload(stats.gpuWorkload);
  if (total > 0) {
    const workloadChart = generateStackedBar(
      gpuWorkloadSlices(stats.gpuWorkload),
      total,
      "GPU Usage by Workload",
      760,
      90,
      "By app category",
    );
    markdown += "\n\n![GPU Workload - " + tick + "](" + workloadChart + "?raycast-width=760)";
  }

  return (
    <List
      isLoading={stats.isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter apps by name..."
      searchBarAccessory={<RangeDropdown value={stats.range} onChange={stats.setRange} />}
    >
      <List.EmptyView
        icon={Icon.Eye}
        title="No app is using the GPU right now"
        description={"System GPU utilization is " + formatPercent(snapshot.gpuUtil) + "."}
      />
      <List.Section title="Applications Using the GPU" subtitle={String(gpuApps.length)}>
        {gpuApps.map((app) => {
          const category = classifyProcessWorkload(app.appName, app.bundleId, app.executablePath);
          return (
            <List.Item
              key={app.appName}
              title={app.appName}
              icon={Icon.Eye}
              accessories={[
                { text: formatPercent(app.gpuPercent), tooltip: "GPU usage" },
                { tag: { value: workloadLabel(category), color: workloadColor(category) }, tooltip: "Workload" },
              ]}
              detail={<List.Item.Detail markdown={markdown} metadata={<AppMetadata app={app} snapshot={snapshot} />} />}
              actions={<AppGroupActions app={app} onRefresh={stats.refresh} />}
            />
          );
        })}
      </List.Section>
    </List>
  );
}

interface AppMetadataProps {
  app: AppGroup;
  snapshot: SystemSnapshot;
}

function AppMetadata(props: AppMetadataProps) {
  const app = props.app;
  const snapshot = props.snapshot;
  const category = classifyProcessWorkload(app.appName, app.bundleId, app.executablePath);

  return (
    <List.Item.Detail.Metadata>
      <List.Item.Detail.Metadata.TagList title="GPU">
        <List.Item.Detail.Metadata.TagList.Item
          text={formatPercent(app.gpuPercent)}
          color={gpuTagColor(app.gpuPercent)}
        />
        <List.Item.Detail.Metadata.TagList.Item text={workloadLabel(category)} color={workloadColor(category)} />
      </List.Item.Detail.Metadata.TagList>
      <List.Item.Detail.Metadata.Label title="CPU" text={formatPercent(app.cpuPercent)} />
      <List.Item.Detail.Metadata.Label title="Processes" text={String(app.processCount)} />
      <List.Item.Detail.Metadata.Separator />
      <List.Item.Detail.Metadata.Label
        title="System GPU"
        text={formatPercent(snapshot.gpuUtil) + " · " + formatWatts(snapshot.gpuPower)}
      />
      {app.executablePath !== null && <List.Item.Detail.Metadata.Label title="Executable" text={app.executablePath} />}
    </List.Item.Detail.Metadata>
  );
}
