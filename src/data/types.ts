/**
 * The latest system sample, with the fields the views show.
 * A field is `number | null` when its database column is nullable: the app
 * writes NULL when that reading was not taken.
 */
 
export interface SystemSnapshot {
  /** Timestamp in seconds (Unix epoch). */
  timestamp: number;
  /** Total physical RAM in bytes. */
  totalRam: number;
  /** Free unallocated RAM in bytes. */
  freeRam: number;
  /** Wired memory in bytes (pinned kernel and framework pages that cannot be paged out). */
  wiredRam: number;
  /** Compressed memory in bytes. */
  compressedRam: number;
  /** App Memory as Activity Monitor defines it: anonymous allocations minus purgeable, in bytes. */
  appMemory: number;
  /** Memory used for file cache in bytes (reclaimable). */
  cachedFiles: number;
  /** Currently used swap space in bytes. */
  swapUsed: number;
  /** Memory pressure level as the app records it: 1 = normal, 2 = warning, 4 = critical. */
  pressureLevel: number;
  /** Memory pressure percentage (0 to 100). */
  pressurePercent: number;
  /** Overall CPU utilization as a fraction (0 to 1). */
  cpuLoad: number;
  /** 1-minute system load average. */
  load1: number | null;
  /** Disk read throughput in bytes per second. */
  diskRead: number;
  /** Disk write throughput in bytes per second. */
  diskWrite: number;
  /** Free space on boot volume in bytes. */
  bootFree: number | null;
  /** Total space on boot volume in bytes. */
  bootTotal: number | null;
  /** GPU utilization percentage (0 to 100). */
  gpuUtil: number | null;
  /** GPU power draw in watts. */
  gpuPower: number | null;
  /** CPU die temperature in degrees Celsius. */
  cpuDieTemp: number | null;
  /** GPU die temperature in degrees Celsius. */
  gpuDieTemp: number | null;
  /** Fastest fan speed in RPM. NULL on fanless Macs. */
  fanRpm: number | null;
  /** Thermal pressure state name (nominal, fair, serious, critical, or unknown when not read). */
  thermalState: string;
  /** Whether an internal battery is present. */
  batteryPresent: boolean;
  /** Current battery charge percentage (0 to 100). */
  batteryCharge: number;
  /** Whether the battery is charging. */
  batteryCharging: boolean;
  /** Maximum battery capacity percentage relative to design capacity. */
  batteryHealth: number;
  /** Whole-system power draw in watts, as estimated by the app. */
  systemPowerWatts: number | null;
}

/**
 * One point on the history charts. Points come from the raw tier (seconds) for
 * recent windows and the minute tier for anything older than the raw retention window.
 * Readings that were not taken are 0 here, so the chart shows them as a drop.
 */
export interface SystemHistoryPoint {
  /** Bucket start timestamp in seconds (Unix epoch). */
  timestamp: number;
  /** CPU load percentage at this bucket. */
  cpuPercent: number;
  /** Memory pressure percentage at this bucket. */
  memoryPressure: number;
  /** GPU utilization percentage at this bucket. */
  gpuPercent: number;
  /** Disk read throughput in megabytes per second. */
  diskReadMb: number;
  /** Disk write throughput in megabytes per second. */
  diskWriteMb: number;
  /** CPU die temperature in degrees Celsius. */
  cpuTemp: number;
  /** GPU die temperature in degrees Celsius. */
  gpuTemp: number;
  /** System power draw in watts. */
  powerWatts: number;
}

/**
 * An application group aggregating an app and all child processes working under it.
 * Child processes inherit the identity of their top-level application bundle.
 */
export interface AppGroup {
  /** Display name of the application or top-level process. */
  appName: string;
  /** Number of live processes grouped under this application. */
  processCount: number;
  /** PIDs of every live process in the group. */
  pids: number[];
  /** Sum of physical memory footprint across all grouped processes, in bytes. */
  memoryBytes: number;
  /** Combined CPU usage, in percent of one core (can exceed 100). */
  cpuPercent: number;
  /** Combined GPU usage percentage across all grouped processes. */
  gpuPercent: number;
  /** Combined disk read rate in bytes per second over the recent sampling window. */
  diskReadBytes: number;
  /** Combined disk write rate in bytes per second over the recent sampling window. */
  diskWrittenBytes: number;
  /** Combined energy impact metric. */
  energyImpact: number;
  /** PID of the app's main process, or the oldest member when no main app binary is present. */
  primaryPid: number;
  /** Path to the main executable binary, or null. */
  executablePath: string | null;
  /** Bundle identifier (e.g., com.apple.Safari), or null. */
  bundleId: string | null;
}

/**
 * Detailed information for an individual process running within an application group.
 */
export interface SubprocessItem {
  /** Process ID. */
  pid: number;
  /** Resolved executable binary name or kernel process name. */
  name: string;
  /** Full path to the executable on disk, or empty string. */
  executablePath: string;
  /** Physical memory footprint in bytes. */
  memoryBytes: number;
  /** CPU usage in percent of one core. */
  cpuPercent: number;
  /** GPU usage percentage. */
  gpuPercent: number;
  /** Disk read rate in bytes per second. */
  diskReadBytes: number;
  /** Disk write rate in bytes per second. */
  diskWrittenBytes: number;
  /** Energy impact rating. */
  energyImpact: number;
  /** CPU architecture string (arm64, x86_64). */
  architecture: string;
  /** True if running under Rosetta 2 translation. */
  isTranslated: boolean;
}

/**
 * Instantaneous CPU core utilization sample.
 */
export interface CoreUsage {
  /** Zero-based logical core index. */
  index: number;
  /** Core classification: performance or efficiency. */
  kind: "performance" | "efficiency";
  /** Current utilization percentage (0 to 100). */
  usage: number;
}

/**
 * Hardware topology and core configuration for the host Mac.
 */
export interface MacTopology {
  /** Total number of logical CPU cores. */
  cpuCores: number;
  /** Number of high-performance cores (P-cores). */
  performanceCores: number;
  /** Number of energy-efficient cores (E-cores). */
  efficiencyCores: number;
}

/**
 * Supported time range windows for querying historical trends and telemetry.
 */
export type TimeRange = "5m" | "15m" | "30m" | "1h" | "6h" | "24h";

/**
 * Raycast user preferences configuring which panels occupy each dashboard card slot.
 */
export interface DashboardPreferences {
  slot1?: string;
  slot2?: string;
  slot3?: string;
  slot4?: string;
  slot5?: string;
  slot6?: string;
  slot7?: string;
  slot8?: string;
  slot9?: string;
  slot10?: string;
  slot11?: string;
  slot12?: string;
  slot13?: string;
  slot14?: string;
}

/**
 * Global extension preferences configured in Raycast settings.
 */
export interface GlobalPreferences {
  /** Default historical time range window to query. */
  defaultRange?: TimeRange;
  /** Polling interval cadence for live view updates. */
  refreshCadence?: "1s" | "2s" | "5s";
}

/**
 * Workload category keys shared by GPU and disk breakdowns.
 */
export type WorkloadCategory = "aiMl" | "displayUi" | "media" | "other";

/**
 * Workload distribution across categories. Values are in the metric's own unit
 * (percent for GPU, bytes per second for disk).
 */
export type WorkloadSlices = Record<WorkloadCategory, number>;
