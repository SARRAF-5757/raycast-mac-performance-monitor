/**
 * The one React hook every command uses. It polls the database and hands the views
 * everything they draw: the latest snapshot, the chart history for the selected
 * range, per-core CPU usage, the list of running apps, the GPU workload breakdown,
 * and whether the MPM app is running.
 */

import { getPreferenceValues, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeGpuWorkload,
  getActiveProcesses,
  getLatestSnapshot,
  getMacTopology,
  getProcessTree,
  getSystemHistory,
  groupProcesses,
  sampleCoreUsage,
  sortApps,
  SortMetric,
} from "../data/queries";
import {
  AppGroup,
  CoreUsage,
  GlobalPreferences,
  MacTopology,
  SystemHistoryPoint,
  SystemSnapshot,
  TimeRange,
  WorkloadSlices,
} from "../data/types";

/** Converts the "Live Refresh Cadence" preference into milliseconds. */
export function cadenceToMs(cadence: string | undefined): number {
  switch (cadence) {
    case "1s":
      return 1000;
    case "5s":
      return 5000;
    default:
      return 2000;
  }
}

interface UseLiveStatsOptions {
  /** Metric used to sort the applications list. */
  sortMetric: SortMetric;
}

export function useLiveStats(options: UseLiveStatsOptions) {
  const prefs = getPreferenceValues<GlobalPreferences>();
  const cadenceMs = cadenceToMs(prefs.refreshCadence);
  const sortMetric = options.sortMetric;

  const [range, setRange] = useState<TimeRange>(prefs.defaultRange === undefined ? "15m" : prefs.defaultRange);
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [history, setHistory] = useState<SystemHistoryPoint[]>([]);
  const [topology, setTopology] = useState<MacTopology | null>(null);
  const [cores, setCores] = useState<CoreUsage[]>([]);
  const [apps, setApps] = useState<AppGroup[]>([]);
  const [gpuWorkload, setGpuWorkload] = useState<WorkloadSlices>({ aiMl: 0, displayUi: 0, media: 0, other: 0 });
  const [isAppRunning, setIsAppRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Topology is loaded once and kept here so later ticks do not query it again.
  const topologyRef = useRef<MacTopology | null>(null);
  // Set to false when the view closes, so a late response does not update a dead view.
  const isMountedRef = useRef(true);
  // Prevents two fetches from running at the same time.
  const isFetchingRef = useRef(false);

  // One refresh tick. A new instance is made when the range or sort metric changes,
  // which also restarts the polling effect below.
  const fetchStats = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;

    try {
      if (topologyRef.current === null) {
        topologyRef.current = await getMacTopology();
        if (isMountedRef.current) {
          setTopology(topologyRef.current);
        }
      }

      // All four run at the same time; we wait for all of them.
      const [snap, hist, processes, tree] = await Promise.all([
        getLatestSnapshot(),
        getSystemHistory(range),
        getActiveProcesses(),
        getProcessTree(),
      ]);
      if (!isMountedRef.current) {
        return;
      }

      const grouped = sortApps(groupProcesses(processes, tree), sortMetric);

      setIsAppRunning(tree.isMonitorRunning);
      setSnapshot(snap);
      setHistory(hist);
      setApps(grouped);
      setGpuWorkload(computeGpuWorkload(grouped));
      setCores(sampleCoreUsage(topologyRef.current));
    } catch (error) {
      if (isMountedRef.current) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Could not read performance data",
          message: String(error),
        });
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [range, sortMetric]);

  // Start polling. Each tick schedules the next one only after it finishes, so
  // a slow tick can never overlap the next.
  useEffect(() => {
    isMountedRef.current = true;
    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      await fetchStats();
      if (!isCancelled) {
        timer = setTimeout(tick, cadenceMs);
      }
    };
    tick();

    return () => {
      isCancelled = true;
      isMountedRef.current = false;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [fetchStats, cadenceMs]);

  return {
    snapshot,
    history,
    range,
    setRange,
    topology,
    cores,
    apps,
    gpuWorkload,
    isAppRunning,
    isLoading,
    refresh: fetchStats,
  };
}
