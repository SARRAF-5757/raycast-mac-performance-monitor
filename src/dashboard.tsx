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
  const { snapshot, history, cores, apps, gpuWorkload, isLoading, isInactive, lastUpdated } = useLiveStats({
    sortMetric: "cpu",
    appLimit: 50,
  });

  if (!snapshot && isInactive) {
    return <InactiveNotice lastUpdated={lastUpdated} />;
  }

  const tick = snapshot?.timestamp ?? Date.now();
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
      sections.push(`![Warning Pills - ${tick}](${warningPillsUri}?raycast-width=760)`);
    }
  }

  function getCard(panelId: string): string | null {
    switch (panelId) {
      case "memory_pressure": {
        const pressurePoints = history.map((h) => h.memoryPressure);
        const pressureColor =
          (snapshot?.pressurePercent || 0) >= 67
            ? "#FF453A"
            : (snapshot?.pressurePercent || 0) >= 34
              ? "#FF9F0A"
              : "#0A84FF";

        return generateAreaChart(pressurePoints, {
          width: 374,
          height: 180,
          label: "Memory Pressure",
          color: pressureColor,
          unit: "%",
          maxValue: 100,
          idPrefix: "mem_pressure",
        });
      }

      case "memory_composition": {
        if (!snapshot) return null;
        const totalRam = snapshot.totalRam || 1;
        const slices = [
          { label: "Wired", value: snapshot.wiredRam, color: "#FF375F" },
          { label: "Active", value: snapshot.activeRam, color: "#0A84FF" },
          { label: "Compressed", value: snapshot.compressedRam, color: "#FF9F0A" },
          { label: "Cached", value: snapshot.cachedFiles, color: "#5E5CE6" },
          { label: "Free", value: snapshot.freeRam, color: "#30D158" },
        ];
        const swapSubtitle =
          snapshot.swapUsed > 0 ? `Swap: ${formatBytes(snapshot.swapUsed)}` : `Total ${formatBytes(totalRam)}`;
        return generateStackedBar(slices, totalRam, "Memory Composition Breakdown", 374, 180, swapSubtitle);
      }

      case "cpu_usage": {
        const cpuPoints = history.map((h) => h.cpuPercent);
        return generateAreaChart(cpuPoints, {
          width: 374,
          height: 180,
          label: "CPU Usage",
          color: "#BF5AF2",
          unit: "%",
          maxValue: 100,
          idPrefix: "cpu_usage",
        });
      }

      case "cpu_cores": {
        return cores.length > 0 ? generateCoreGrid(cores, 374, 180) : null;
      }

      case "gpu_usage": {
        const gpuPoints = history.map((h) => h.gpuPercent);
        return generateAreaChart(gpuPoints, {
          width: 374,
          height: 180,
          label: "GPU Usage",
          color: "#30D158",
          unit: "%",
          maxValue: 100,
          idPrefix: "gpu_usage",
        });
      }

      case "gpu_breakdown": {
        const totalGpu = gpuWorkload.aiMl + gpuWorkload.displayUi + gpuWorkload.media + gpuWorkload.other;
        const validTotalGpu = totalGpu > 0 ? totalGpu : 100;
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
        return generateStackedBar(gpuSlices, validTotalGpu, "GPU Usage Breakdown", 374, 180);
      }

      case "disk_io": {
        const readPoints = history.map((h) => h.diskReadMb);
        const writePoints = history.map((h) => h.diskWriteMb);
        return generateDualAreaChart(readPoints, writePoints, {
          width: 374,
          height: 180,
          title: "Disk Read & Write Records",
          labelA: "Read",
          labelB: "Write",
          colorA: "#64D2FF",
          colorB: "#FF9F0A",
          unit: "MB/s",
          idPrefix: "disk_io",
        });
      }

      case "power_consumption": {
        const powerPoints = history.map((h) => h.batteryWatts);
        return generateAreaChart(powerPoints, {
          width: 374,
          height: 180,
          label: "Power Consumption",
          color: "#FFD60A",
          unit: "W",
          idPrefix: "power_consumption",
        });
      }

      case "thermals": {
        const cpuTemps = history.map((h) => h.cpuTemp || 0);
        const gpuTemps = history.map((h) => h.gpuTemp || 0);
        return generateDualAreaChart(cpuTemps, gpuTemps, {
          width: 374,
          height: 180,
          title: "Thermals",
          labelA: "CPU Die",
          labelB: "GPU Die",
          colorA: "#FF453A",
          colorB: "#FF9F0A",
          unit: "°C",
          idPrefix: "thermals",
        });
      }

      case "top_memory": {
        if (apps.length === 0) return null;
        const topMemApps = [...apps]
          .sort((a, b) => b.memoryBytes - a.memoryBytes)
          .slice(0, 5)
          .map((a) => ({ name: a.appName, value: formatBytes(a.memoryBytes) }));
        return generateMiniLeaderboardCard("Top Memory Users", topMemApps, "#0A84FF", 374, 180);
      }

      case "top_cpu": {
        if (apps.length === 0) return null;
        const topCpuApps = [...apps]
          .sort((a, b) => b.cpuPercent - a.cpuPercent)
          .slice(0, 5)
          .map((a) => ({ name: a.appName, value: formatPercent(a.cpuPercent) }));
        return generateMiniLeaderboardCard("Top CPU Users", topCpuApps, "#BF5AF2", 374, 180);
      }

      case "top_gpu": {
        if (apps.length === 0) return null;
        const topGpuApps = [...apps]
          .filter((a) => a.gpuPercent > 0)
          .sort((a, b) => b.gpuPercent - a.gpuPercent)
          .slice(0, 5)
          .map((a) => ({ name: a.appName, value: formatPercent(a.gpuPercent) }));
        return generateMiniLeaderboardCard("Top GPU Users", topGpuApps, "#30D158", 374, 180);
      }

      case "top_energy": {
        if (apps.length === 0) return null;
        const topEnergyApps = [...apps]
          .sort((a, b) => b.energyImpact - a.energyImpact)
          .slice(0, 5)
          .map((a) => ({ name: a.appName, value: a.energyImpact.toFixed(1) }));
        return generateMiniLeaderboardCard("Top Energy Users", topEnergyApps, "#FFD60A", 374, 180);
      }

      default:
        return null;
    }
  }

  // 14 customizable slot dropdowns, defaulting to all available panels
  const slotList: string[] = [
    prefs.slot1 ?? "memory_pressure",
    prefs.slot2 ?? "memory_composition",
    prefs.slot3 ?? "cpu_usage",
    prefs.slot4 ?? "cpu_cores",
    prefs.slot5 ?? "gpu_usage",
    prefs.slot6 ?? "gpu_breakdown",
    prefs.slot7 ?? "disk_io",
    prefs.slot8 ?? "power_consumption",
    prefs.slot9 ?? "thermals",
    prefs.slot10 ?? "none",
    prefs.slot11 ?? "top_memory",
    prefs.slot12 ?? "top_cpu",
    prefs.slot13 ?? "top_gpu",
    prefs.slot14 ?? "top_energy",
  ];

  let rowCount = 0;

  for (let i = 0; i < slotList.length; i += 2) {
    const leftId = slotList[i];
    const rightId = slotList[i + 1];

    const leftCard = leftId && leftId !== "none" ? getCard(leftId) : null;
    const rightCard = rightId && rightId !== "none" ? getCard(rightId) : null;

    if (!leftCard && !rightCard) {
      continue;
    }

    rowCount++;
    const rowUri = renderCardRow(leftCard || "", rightCard || null, 760, 180);
    sections.push(`![Dashboard Row ${rowCount} - ${tick}](${rowUri}?raycast-width=760)`);
  }

  if (rowCount === 0) {
    sections.push(
      "### No Dashboard Panels Selected\n\nOpen Raycast Extension Preferences to assign performance panels to slots.",
    );
  }

  const markdown = sections.join("\n\n");

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
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
}
