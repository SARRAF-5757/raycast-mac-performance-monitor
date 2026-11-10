import { getPreferenceValues } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import {
  getDiskWorkloadSlices,
  getGpuWorkloadSlices,
  getGroupedApps,
  getLatestSnapshot,
  getMacTopology,
  getSystemHistory,
  sampleCoreUsage,
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

interface UseLiveStatsOptions {
  sortMetric?: SortMetric;
  appLimit?: number;
}

export function useLiveStats(options: UseLiveStatsOptions = {}) {
  const prefs = getPreferenceValues<GlobalPreferences>();
  const initialRange = prefs.defaultRange || "15m";
  const cadenceStr = prefs.refreshCadence || "2s";
  const cadenceMs = cadenceStr === "1s" ? 1000 : cadenceStr === "5s" ? 5000 : 2000;

  const [range, setRange] = useState<TimeRange>(initialRange);
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [history, setHistory] = useState<SystemHistoryPoint[]>([]);
  const [topology, setTopology] = useState<MacTopology | null>(null);
  const [cores, setCores] = useState<CoreUsage[]>([]);
  const [apps, setApps] = useState<AppGroup[]>([]);
  const [gpuWorkload, setGpuWorkload] = useState<WorkloadSlices>({ aiMl: 0, displayUi: 0, media: 0, other: 0 });
  const [diskWorkload, setDiskWorkload] = useState<WorkloadSlices>({ aiMl: 0, displayUi: 0, media: 0, other: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isInactive, setIsInactive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const rangeRef = useRef(range);
  rangeRef.current = range;

  const topologyRef = useRef(topology);
  topologyRef.current = topology;

  const isMountedRef = useRef(true);

  const fetchStats = async () => {
    try {
      let currentTopology = topologyRef.current;
      if (!currentTopology) {
        currentTopology = await getMacTopology();
        if (isMountedRef.current) setTopology(currentTopology);
      }

      const [snap, hist, appList, gpuSlices, diskSlices] = await Promise.all([
        getLatestSnapshot(),
        getSystemHistory(rangeRef.current),
        getGroupedApps(options.sortMetric || "memory", options.appLimit || 35),
        getGpuWorkloadSlices(),
        getDiskWorkloadSlices(),
      ]);

      if (!isMountedRef.current) return;

      if (snap) {
        setSnapshot(snap);
        const nowSec = Math.floor(Date.now() / 1000);
        const stale = nowSec - snap.timestamp > 12;
        setIsInactive(stale);
        setLastUpdated(new Date(snap.timestamp * 1000));
      } else {
        setIsInactive(true);
      }

      setHistory(hist);
      setApps(appList);
      setGpuWorkload(gpuSlices);
      setDiskWorkload(diskSlices);

      if (currentTopology) {
        const coreReadings = sampleCoreUsage(currentTopology);
        setCores(coreReadings);
      }
    } catch {
      if (isMountedRef.current) setIsInactive(true);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchStats();

    const interval = setInterval(() => {
      fetchStats();
    }, cadenceMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [range, options.sortMetric, cadenceMs]);

  return {
    snapshot,
    history,
    range,
    setRange,
    topology,
    cores,
    apps,
    gpuWorkload,
    diskWorkload,
    isLoading,
    isInactive,
    lastUpdated,
    refresh: fetchStats,
  };
}
