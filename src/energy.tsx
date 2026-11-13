import { Action, ActionPanel, Color, Icon, Keyboard, List } from "@raycast/api";
import { InactiveNotice } from "./components/InactiveNotice";
import { SubprocessList } from "./components/SubprocessList";
import { TimeRange } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import { generateAreaChart, generateDualAreaChart } from "./utils/charts";
import { openApp } from "./utils/deepLink";
import { formatBytes, formatPercent, formatTemp, formatWatts } from "./utils/formatting";

export default function Command() {
  const { snapshot, history, range, setRange, apps, isLoading, isInactive } = useLiveStats({
    sortMetric: "energy",
    appLimit: 40,
  });

  if (isLoading && !snapshot) {
    return <List isLoading={true} searchBarPlaceholder="Loading energy telemetry..." />;
  }

  if (isInactive) {
    return <InactiveNotice />;
  }

  const powerPoints = history.map((h) => h.batteryWatts);
  const powerChartUri = generateAreaChart(powerPoints, {
    label: "Power Consumption",
    color: "#FFD60A",
    unit: "W",
  });

  const cpuTemps = history.map((h) => h.cpuTemp || 0);
  const gpuTemps = history.map((h) => h.gpuTemp || 0);
  const thermalChartUri = generateDualAreaChart(cpuTemps, gpuTemps, {
    title: "Thermals",
    labelA: "CPU Die",
    labelB: "GPU Die",
    colorA: "#FF453A",
    colorB: "#FF9F0A",
    unit: "°C",
  });

  const tick = snapshot?.timestamp ?? Date.now();
  const markdownHeader = `
![Power Consumption - ${tick}](${powerChartUri}?raycast-width=760)

![Thermals - ${tick}](${thermalChartUri}?raycast-width=760)
  `.trim();

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter apps by Energy Impact..."
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
      <List.Section title={`Energy Intensive Applications (${apps.length})`}>
        {apps.map((app) => {
          return (
            <List.Item
              key={app.appName}
              title={app.appName}
              icon={Icon.Bolt}
              accessories={[
                { text: `${app.energyImpact.toFixed(1)} Impact`, tooltip: "Energy Impact Score" },
                { text: `${app.processCount} proc`, tooltip: "Processes in App Coalition" },
              ]}
              detail={
                <List.Item.Detail
                  markdown={markdownHeader}
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label title="App Name" text={app.appName} />
                      <List.Item.Detail.Metadata.TagList title="Energy Impact">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={app.energyImpact.toFixed(1)}
                          color={
                            app.energyImpact > 25 ? Color.Red : app.energyImpact > 10 ? Color.Orange : Color.Yellow
                          }
                        />
                      </List.Item.Detail.Metadata.TagList>
                      <List.Item.Detail.Metadata.Label title="CPU Usage" text={formatPercent(app.cpuPercent)} />
                      <List.Item.Detail.Metadata.Label title="GPU Usage" text={formatPercent(app.gpuPercent)} />
                      <List.Item.Detail.Metadata.Label title="Memory Footprint" text={formatBytes(app.memoryBytes)} />
                      <List.Item.Detail.Metadata.Label title="Processes" text={`${app.processCount} active`} />
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label
                        title="Power Draw"
                        text={snapshot?.batteryWatts ? formatWatts(snapshot.batteryWatts) : "AC Power"}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Power Source"
                        text={
                          snapshot?.batteryPresent
                            ? snapshot.batteryCharging
                              ? "Charging (AC)"
                              : "Battery"
                            : "Power Adapter (AC)"
                        }
                      />
                      {snapshot?.batteryPresent ? (
                        <>
                          <List.Item.Detail.Metadata.Label
                            title="Battery Charge"
                            text={formatPercent(snapshot.batteryCharge)}
                          />
                          <List.Item.Detail.Metadata.Label
                            title="Battery Health"
                            text={formatPercent(snapshot.batteryHealth)}
                          />
                          <List.Item.Detail.Metadata.Label title="Cycle Count" text={String(snapshot.batteryCycles)} />
                        </>
                      ) : null}
                      <List.Item.Detail.Metadata.Label
                        title="CPU / GPU Temperature"
                        text={`${formatTemp(snapshot?.cpuDieTemp ?? null)} / ${formatTemp(snapshot?.gpuDieTemp ?? null)}`}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Fan Speed"
                        text={snapshot?.fanRpm ? `${snapshot.fanRpm} RPM` : "Silent / Passive"}
                      />
                      <List.Item.Detail.Metadata.TagList title="Thermal State">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={snapshot?.thermalState || "nominal"}
                          color={
                            snapshot?.thermalState === "critical"
                              ? Color.Red
                              : snapshot?.thermalState === "serious"
                                ? Color.Orange
                                : Color.Green
                          }
                        />
                      </List.Item.Detail.Metadata.TagList>
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
