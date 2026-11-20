/**
 * CPU command: usage history, per-core grid, and every running app sorted by CPU.
 * App CPU is in percent of one core (so it can exceed 100); the detail pane also
 * shows the share of the whole Mac.
 */
 
import { Color, Icon, List } from "@raycast/api";
import { AppGroupActions } from "./components/Actions";
import { InactiveNotice } from "./components/InactiveNotice";
import { RangeDropdown } from "./components/RangeDropdown";
import { AppGroup, SystemSnapshot } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import { generateAreaChart, generateCoreGrid } from "./utils/charts";
import { formatPercent } from "./utils/formatting";

/** Red when the app uses more than one full core, orange above 30 percent of one core. */
function cpuTagColor(cpuPercent: number): Color {
  if (cpuPercent > 100) {
    return Color.Red;
  }
  if (cpuPercent > 30) {
    return Color.Orange;
  }
  return Color.Purple;
}

export default function Command() {
  const stats = useLiveStats({ sortMetric: "cpu" });
  const snapshot = stats.snapshot;

  if (stats.isLoading && snapshot === null) {
    return <List isLoading searchBarPlaceholder="Loading CPU telemetry..." />;
  }
  if (!stats.isAppRunning || snapshot === null) {
    return <InactiveNotice />;
  }

  // The topology loads in the same tick as the first snapshot, so it is set by now.
  let coreCount = 0;
  if (stats.topology !== null) {
    coreCount = stats.topology.cpuCores;
  }

  const cpuValues = stats.history.map((point) => point.cpuPercent);
  const cpuChart = generateAreaChart(cpuValues, { label: "CPU Usage", color: "#BF5AF2", unit: "%", maxValue: 100 });
  const tick = snapshot.timestamp;
  let markdown = "![CPU Usage - " + tick + "](" + cpuChart + "?raycast-width=760)";
  if (stats.cores.length > 0) {
    const coreGrid = generateCoreGrid(stats.cores);
    markdown += "\n\n![CPU Cores - " + tick + "](" + coreGrid + "?raycast-width=760)";
  }

  return (
    <List
      isLoading={stats.isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter apps by name..."
      searchBarAccessory={<RangeDropdown value={stats.range} onChange={stats.setRange} />}
    >
      <List.Section title="Applications by CPU" subtitle={String(stats.apps.length)}>
        {stats.apps.map((app) => (
          <List.Item
            key={app.appName}
            title={app.appName}
            icon={Icon.ComputerChip}
            accessories={[
              { text: formatPercent(app.cpuPercent), tooltip: "CPU, percent of one core" },
              { text: String(app.processCount), icon: Icon.Layers, tooltip: "Processes" },
            ]}
            detail={
              <List.Item.Detail
                markdown={markdown}
                metadata={<AppMetadata app={app} snapshot={snapshot} coreCount={coreCount} />}
              />
            }
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
  coreCount: number;
}

function AppMetadata(props: AppMetadataProps) {
  const app = props.app;
  const snapshot = props.snapshot;

  let systemText = formatPercent(snapshot.cpuLoad * 100);
  if (snapshot.load1 !== null) {
    systemText += " · load " + snapshot.load1.toFixed(2);
  }

  return (
    <List.Item.Detail.Metadata>
      <List.Item.Detail.Metadata.TagList title="CPU (one core = 100%)">
        <List.Item.Detail.Metadata.TagList.Item
          text={formatPercent(app.cpuPercent)}
          color={cpuTagColor(app.cpuPercent)}
        />
      </List.Item.Detail.Metadata.TagList>
      <List.Item.Detail.Metadata.Label title="Share of Mac" text={formatPercent(app.cpuPercent / props.coreCount)} />
      <List.Item.Detail.Metadata.Label title="Energy Impact" text={app.energyImpact.toFixed(1)} />
      <List.Item.Detail.Metadata.Label title="Processes" text={String(app.processCount)} />
      <List.Item.Detail.Metadata.Separator />
      <List.Item.Detail.Metadata.Label title="System" text={systemText} />
      {app.executablePath !== null && <List.Item.Detail.Metadata.Label title="Executable" text={app.executablePath} />}
    </List.Item.Detail.Metadata>
  );
}
