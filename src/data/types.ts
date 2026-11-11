export interface SystemSnapshot {
  timestamp: number;
  totalRam: number;
  freeRam: number;
  activeRam: number;
  inactiveRam: number;
  wiredRam: number;
  speculativeRam: number;
  compressedRam: number;
  appMemory: number;
  cachedFiles: number;
  swapTotal: number;
  swapUsed: number;
  pressureLevel: number;
  pressurePercent: number;
  cpuLoad: number;
  load1: number;
  load5: number;
  load15: number;
  netIn: number;
  netOut: number;
  diskRead: number;
  diskWrite: number;
  diskReadIops: number;
  diskWriteIops: number;
  diskReadLatency: number;
  diskWriteLatency: number;
  diskUtil: number;
  bootFree: number;
  bootTotal: number;
  gpuUtil: number;
  gpuPower: number;
  anePower: number;
  cpuDieTemp: number | null;
  gpuDieTemp: number | null;
  ssdTemp: number | null;
  fanRpm: number | null;
  thermalState: string | null;
  batteryPresent: boolean;
  batteryCharge: number;
  batteryWatts: number;
  batteryCharging: boolean;
  batteryHealth: number;
  batteryCycles: number;
  systemPowerWatts: number;
}

export interface SystemHistoryPoint {
  timestamp: number;
  cpuPercent: number;
  memoryPressure: number;
  gpuPercent: number;
  diskReadMb: number;
  diskWriteMb: number;
  netInKb: number;
  netOutKb: number;
  cpuTemp: number | null;
  gpuTemp: number | null;
  batteryWatts: number;
  batteryPercent: number;
}

export interface AppGroup {
  appName: string;
  processCount: number;
  memoryBytes: number;
  cpuPercent: number;
  gpuPercent: number;
  diskReadBytes: number;
  diskWrittenBytes: number;
  energyImpact: number;
  primaryPid: number;
  executablePath: string | null;
  bundleId: string | null;
}

export interface SubprocessItem {
  pid: number;
  name: string;
  executablePath: string;
  memoryBytes: number;
  cpuPercent: number;
  gpuPercent: number;
  diskReadBytes: number;
  diskWrittenBytes: number;
  energyImpact: number;
  architecture: string;
  isTranslated: boolean;
}

export interface CoreUsage {
  index: number;
  kind: "performance" | "efficiency" | "unknown";
  usage: number; // 0 to 100
}

export interface MacTopology {
  cpuCores: number;
  performanceCores: number;
  efficiencyCores: number;
  memoryBytes: number;
  chip: string;
  model: string;
}

export type TimeRange = "5m" | "15m" | "1h" | "24h";

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

export interface GlobalPreferences {
  defaultRange?: TimeRange;
  refreshCadence?: "1s" | "2s" | "5s";
}

export interface WorkloadSlices {
  aiMl: number;
  displayUi: number;
  media: number;
  other: number;
}
