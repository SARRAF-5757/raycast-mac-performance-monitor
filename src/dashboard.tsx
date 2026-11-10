import { Action, ActionPanel, Detail, getPreferenceValues, Icon, Keyboard } from "@raycast/api";
import { InactiveNotice } from "./components/InactiveNotice";
import { DashboardPreferences } from "./data/types";
import { useLiveStats } from "./hooks/useLiveStats";
import {
  generateAreaChart,
  generateCoreGrid,
  generateDualAreaChart,
  generateMiniLeaderboardCard,
  generateStackedBar,
  generateWarningPills,
  renderCardRow,
  WarningPill,
} from "./utils/charts";
import { openApp } from "./utils/deepLink";
import { formatBytes, formatPercent, formatTemp } from "./utils/formatting";

export default function Command() {
  const prefs = getPreferenceValues<DashboardPreferences>();
  const {
    snapshot,
    history,
    range,
    setRange,
    cores,
    apps,
    gpuWorkload,
    diskWorkload,
    isLoading,
    isInactive,
    lastUpdated,
    refresh,
  } = useLiveStats({ sortMetric: "cpu", appLimit: 50 });

  if (!snapshot && isInactive) {
    return <InactiveNotice lastUpdated={lastUpdated} />;
  }

  const sections: string[] = [];

  // Warning pills: if there are any warnings, show up at the very top as small rounded pills (roughly quarter width each)
  if (snapshot) {
    const warnings: WarningPill[] = [];

    // 1. Memory Pressure warning / critical
    if (snapshot.pressurePercent >= 67 || snapshot.pressureLevel >= 3) {
      warnings.push({
        id: "pressure",
        label: `Memory Pressure: ${formatPercent(snapshot.pressurePercent)}`,
        level: "critical",
      });
    } else if (snapshot.pressurePercent >= 34 || snapshot.pressureLevel >= 2) {
      warnings.push({
        id: "pressure",
        label: `Memory Pressure: ${formatPercent(snapshot.pressurePercent)}`,
        level: "warning",
      });
    }

    // 2. Thermals warning / throttling
    if (snapshot.thermalState === "critical" || snapshot.thermalState === "serious") {
      warnings.push({
        id: "thermals",
        label: `Throttling: ${snapshot.thermalState}`,
        level: "critical",
      });
    } else if (snapshot.cpuDieTemp !== null && snapshot.cpuDieTemp >= 85) {
      warnings.push({
        id: "cpu_temp",
        label: `High CPU Temp: ${formatTemp(snapshot.cpuDieTemp)}`,
        level: "warning",
      });
    }

    // 3. CPU Load
    if (snapshot.cpuLoad >= 0.85) {
      warnings.push({
        id: "cpu_load",
        label: `Heavy CPU Load: ${formatPercent(snapshot.cpuLoad * 100)}`,
        level: "warning",
      });
    }

    // 4. Battery Low
    if (snapshot.batteryPresent && snapshot.batteryCharge <= 20 && !snapshot.batteryCharging) {
      warnings.push({
        id: "battery",
        label: `Low Battery: ${Math.round(snapshot.batteryCharge)}%`,
        level: "warning",
      });
    }

    // 5. App Inactive
    if (isInactive) {
      warnings.push({
        id: "inactive",
        label: "App Recording Paused",
        level: "caution",
      });
    }

    const warningPillsUri = generateWarningPills(warnings, 760);
    if (warningPillsUri) {
      sections.push(`![Warning Pills](${warningPillsUri})`);
    }
  }

  // Dashboard panels split in half: two cards per row
  const cards: string[] = [];

  // 1. CPU Usage Timeline Card
  if (prefs.panelCpuTimeline !== false) {
    const cpuPoints = history.map((h) => h.cpuPercent);
    const cpuCard = generateAreaChart(cpuPoints, {
      width: 374,
      height: 180,
      label: "Processor Utilisation",
      color: "#BF5AF2",
      unit: "%",
      maxValue: 100,
      idPrefix: "cpu_timeline",
    });
    cards.push(cpuCard);
  }

  // 2. CPU Cores Grid Card
  if (prefs.panelCpuCores !== false && cores.length > 0) {
    const coreCard = generateCoreGrid(cores, 374, 180);
    cards.push(coreCard);
  }

  // 3. Memory Pressure Card
  if (prefs.panelMemoryPressure !== false) {
    const pressurePoints = history.map((h) => h.memoryPressure);
    const pressureColor =
      (snapshot?.pressurePercent || 0) >= 67
        ? "#FF453A"
        : (snapshot?.pressurePercent || 0) >= 34
          ? "#FF9F0A"
          : "#0A84FF";

    const pressureCard = generateAreaChart(pressurePoints, {
      width: 374,
      height: 180,
      label: "Memory Pressure",
      color: pressureColor,
      unit: "%",
      maxValue: 100,
      idPrefix: "mem_pressure",
    });
    cards.push(pressureCard);
  }

  // 4. Memory Composition Card
  if (prefs.panelMemoryComposition !== false && snapshot) {
    const totalRam = snapshot.totalRam || 1;
    const slices = [
      { label: "Wired", value: snapshot.wiredRam, color: "#FF375F" },
      { label: "Active", value: snapshot.activeRam, color: "#0A84FF" },
      { label: "Compressed", value: snapshot.compressedRam, color: "#FF9F0A" },
      { label: "Cached", value: snapshot.cachedFiles, color: "#5E5CE6" },
      { label: "Free", value: snapshot.freeRam, color: "#30D158" },
    ];
    const compCard = generateStackedBar(slices, totalRam, "Memory Composition", 374, 180);
    cards.push(compCard);
  }

  // 5. GPU Utilisation Card
  if (prefs.panelGpuWorkload) {
    const gpuPoints = history.map((h) => h.gpuPercent);
    const gpuCard = generateAreaChart(gpuPoints, {
      width: 374,
      height: 180,
      label: "GPU Utilisation",
      color: "#30D158",
      unit: "%",
      maxValue: 100,
      idPrefix: "gpu_util",
    });
    cards.push(gpuCard);

    const totalGpu = gpuWorkload.aiMl + gpuWorkload.displayUi + gpuWorkload.media + gpuWorkload.other;
    if (totalGpu > 0) {
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
      const gpuWorkloadCard = generateStackedBar(gpuSlices, totalGpu, "GPU Workload Split", 374, 180);
      cards.push(gpuWorkloadCard);
    }
  }

  // 6. Disk Read and Write Records Card
  if (prefs.panelDiskReadWrite) {
    const readPoints = history.map((h) => h.diskReadMb);
    const writePoints = history.map((h) => h.diskWriteMb);
    const diskCard = generateDualAreaChart(readPoints, writePoints, {
      width: 374,
      height: 180,
      labelA: "Disk Read",
      labelB: "Disk Write",
      colorA: "#64D2FF",
      colorB: "#FF9F0A",
      unit: "MB/s",
      idPrefix: "disk_io",
    });
    cards.push(diskCard);

    const totalDisk = diskWorkload.aiMl + diskWorkload.displayUi + diskWorkload.media + diskWorkload.other;
    if (totalDisk > 0) {
      const diskSlices = [
        { label: "AI & ML", value: diskWorkload.aiMl, color: "#BF5AF2" },
        { label: "Display/UI", value: diskWorkload.displayUi, color: "#0A84FF" },
        { label: "Media", value: diskWorkload.media, color: "#FF9F0A" },
        { label: "Other", value: diskWorkload.other, color: "#8E8E93" },
      ];
      const diskWorkloadCard = generateStackedBar(diskSlices, totalDisk, "Disk Workload Taxonomy", 374, 180);
      cards.push(diskWorkloadCard);
    }
  }

  // 7. Energy and Power History Card
  if (prefs.panelEnergyHistory) {
    const powerPoints = history.map((h) => h.batteryWatts);
    const energyCard = generateAreaChart(powerPoints, {
      width: 374,
      height: 180,
      label: "Power Consumption",
      color: "#FFD60A",
      unit: "W",
      idPrefix: "power_draw",
    });
    cards.push(energyCard);
  }

  // 8. Thermals and Fans Card
  if (prefs.panelThermals) {
    const cpuTemps = history.map((h) => h.cpuTemp || 0);
    const gpuTemps = history.map((h) => h.gpuTemp || 0);
    const thermalCard = generateDualAreaChart(cpuTemps, gpuTemps, {
      width: 374,
      height: 180,
      labelA: "CPU Die",
      labelB: "GPU Die",
      colorA: "#FF453A",
      colorB: "#FF9F0A",
      unit: "°C",
      idPrefix: "die_thermals",
    });
    cards.push(thermalCard);
  }

  // 9. Top Memory Apps Leaderboard Card (separate toggle, no process count)
  if (prefs.panelTopMemoryApps !== false && apps.length > 0) {
    const topMemApps = [...apps]
      .sort((a, b) => b.memoryBytes - a.memoryBytes)
      .slice(0, 5)
      .map((a) => ({ name: a.appName, value: formatBytes(a.memoryBytes) }));
    const memLeaderboardCard = generateMiniLeaderboardCard("Top Memory Apps", topMemApps, "#0A84FF", 374, 180);
    cards.push(memLeaderboardCard);
  }

  // 10. Top CPU Apps Leaderboard Card (separate toggle, no process count)
  if (prefs.panelTopCpuApps !== false && apps.length > 0) {
    const topCpuApps = [...apps]
      .sort((a, b) => b.cpuPercent - a.cpuPercent)
      .slice(0, 5)
      .map((a) => ({ name: a.appName, value: formatPercent(a.cpuPercent) }));
    const cpuLeaderboardCard = generateMiniLeaderboardCard("Top CPU Apps", topCpuApps, "#BF5AF2", 374, 180);
    cards.push(cpuLeaderboardCard);
  }

  // 11. Top GPU Apps Leaderboard Card (separate toggle, no process count)
  if (prefs.panelTopGpuApps && apps.length > 0) {
    const topGpuApps = [...apps]
      .filter((a) => a.gpuPercent > 0)
      .sort((a, b) => b.gpuPercent - a.gpuPercent)
      .slice(0, 5)
      .map((a) => ({ name: a.appName, value: formatPercent(a.gpuPercent) }));
    const gpuLeaderboardCard = generateMiniLeaderboardCard("Top GPU Apps", topGpuApps, "#30D158", 374, 180);
    cards.push(gpuLeaderboardCard);
  }

  // 12. Top Energy Apps Leaderboard Card (separate toggle, no process count)
  if (prefs.panelTopEnergyApps && apps.length > 0) {
    const topEnergyApps = [...apps]
      .sort((a, b) => b.energyImpact - a.energyImpact)
      .slice(0, 5)
      .map((a) => ({ name: a.appName, value: a.energyImpact.toFixed(1) }));
    const energyLeaderboardCard = generateMiniLeaderboardCard("Top Energy Apps", topEnergyApps, "#FFD60A", 374, 180);
    cards.push(energyLeaderboardCard);
  }

  // Group cards into rows of two
  for (let i = 0; i < cards.length; i += 2) {
    const card1 = cards[i];
    const card2 = cards[i + 1] || null;
    const rowUri = renderCardRow(card1, card2, 760, 180);
    sections.push(`![Dashboard Row ${Math.floor(i / 2) + 1}](${rowUri})`);
  }

  if (cards.length === 0) {
    sections.push(
      "### No Dashboard Panels Enabled\n\nOpen Raycast Extension Preferences to enable system performance metric panels and application leaderboards.",
    );
  }

  const markdown = sections.join("\n\n");

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <ActionPanel.Section title={`History Window (Current: ${range})`}>
            <Action
              title="5 Minutes Range"
              icon={Icon.Clock}
              shortcut={{ modifiers: ["cmd"], key: "1" }}
              onAction={() => setRange("5m")}
            />
            <Action
              title="15 Minutes Range"
              icon={Icon.Clock}
              shortcut={{ modifiers: ["cmd"], key: "2" }}
              onAction={() => setRange("15m")}
            />
            <Action
              title="1 Hour Range"
              icon={Icon.Clock}
              shortcut={{ modifiers: ["cmd"], key: "3" }}
              onAction={() => setRange("1h")}
            />
            <Action
              title="24 Hours Range"
              icon={Icon.Clock}
              shortcut={{ modifiers: ["cmd"], key: "4" }}
              onAction={() => setRange("24h")}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="App Actions">
            <Action
              title="Refresh Stats"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={refresh}
            />
            <Action
              title="Open in Mac Performance Monitor"
              icon={Icon.AppWindow}
              shortcut={Keyboard.Shortcut.Common.Open}
              onAction={openApp}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
