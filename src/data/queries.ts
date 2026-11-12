import { execSync } from "child_process";
import os from "os";
import { querySqlite } from "./db";
import {
  AppGroup,
  CoreUsage,
  MacTopology,
  SubprocessItem,
  SystemHistoryPoint,
  SystemSnapshot,
  TimeRange,
  WorkloadSlices,
} from "./types";

interface RawSystemSample {
  timestamp: number;
  total_ram: number;
  free: number;
  active: number;
  inactive: number;
  wired: number;
  speculative: number;
  compressed: number;
  app_memory: number;
  cached_files: number;
  swap_total: number;
  swap_used: number;
  pressure_level: number;
  pressure_percent: number;
  cpu_load: number;
  load_1: number;
  load_5: number;
  load_15: number;
  net_in: number;
  net_out: number;
  disk_read: number;
  disk_write: number;
  disk_read_iops: number;
  disk_write_iops: number;
  disk_read_latency: number;
  disk_write_latency: number;
  disk_util: number;
  boot_free: number;
  boot_total: number;
  gpu_util: number;
  gpu_power: number;
  ane_power: number;
  cpu_die: number | null;
  gpu_die: number | null;
  ssd_temp: number | null;
  fan_rpm: number | null;
  thermal_state: number | string | null;
  battery_present: number;
  battery_charge: number;
  battery_power: number;
  battery_charging: number;
  battery_health: number;
  battery_cycles: number;
  energy_power?: number;
}

function parseThermalState(state: number | string | null | undefined): string {
  if (state === 0 || state === "0" || state === "nominal") return "nominal";
  if (state === 1 || state === "1" || state === "fair") return "fair";
  if (state === 2 || state === "2" || state === "serious") return "serious";
  if (state === 3 || state === "3" || state === "critical") return "critical";
  return "nominal";
}

export async function getLatestSnapshot(): Promise<SystemSnapshot | null> {
  const rows = await querySqlite<RawSystemSample>("SELECT * FROM system_samples ORDER BY timestamp DESC LIMIT 1;");

  if (!rows || rows.length === 0) return null;
  const r = rows[0];

  return {
    timestamp: r.timestamp,
    totalRam: r.total_ram || 0,
    freeRam: r.free || 0,
    activeRam: r.active || 0,
    inactiveRam: r.inactive || 0,
    wiredRam: r.wired || 0,
    speculativeRam: r.speculative || 0,
    compressedRam: r.compressed || 0,
    appMemory: r.app_memory || 0,
    cachedFiles: r.cached_files || 0,
    swapTotal: r.swap_total || 0,
    swapUsed: r.swap_used || 0,
    pressureLevel: r.pressure_level || 1,
    pressurePercent: r.pressure_percent || 0,
    cpuLoad: r.cpu_load || 0,
    load1: r.load_1 || 0,
    load5: r.load_5 || 0,
    load15: r.load_15 || 0,
    netIn: r.net_in || 0,
    netOut: r.net_out || 0,
    diskRead: r.disk_read || 0,
    diskWrite: r.disk_write || 0,
    diskReadIops: r.disk_read_iops || 0,
    diskWriteIops: r.disk_write_iops || 0,
    diskReadLatency: r.disk_read_latency || 0,
    diskWriteLatency: r.disk_write_latency || 0,
    diskUtil: r.disk_util || 0,
    bootFree: r.boot_free || 0,
    bootTotal: r.boot_total || 0,
    gpuUtil: r.gpu_util || 0,
    gpuPower: r.gpu_power || 0,
    anePower: r.ane_power || 0,
    cpuDieTemp: r.cpu_die ?? null,
    gpuDieTemp: r.gpu_die ?? null,
    ssdTemp: r.ssd_temp ?? null,
    fanRpm: r.fan_rpm ?? null,
    thermalState: parseThermalState(r.thermal_state),
    batteryPresent: r.battery_present === 1,
    batteryCharge: r.battery_charge || 0,
    batteryWatts: Math.abs(r.battery_power || 0),
    batteryCharging: r.battery_charging === 1,
    batteryHealth: r.battery_health || 100,
    batteryCycles: r.battery_cycles || 0,
    systemPowerWatts: Math.abs(r.energy_power || r.battery_power || 0),
  };
}

export function rangeToSeconds(range: TimeRange): number {
  switch (range) {
    case "5m":
      return 300;
    case "15m":
      return 900;
    case "30m":
      return 1800;
    case "1h":
      return 3600;
    case "6h":
      return 21600;
    case "24h":
      return 86400;
  }
}

interface RawHistoryRow {
  timestamp: number;
  cpu_percent: number;
  memory_pressure: number;
  gpu_percent: number;
  disk_read_mb: number;
  disk_write_mb: number;
  net_in_kb: number;
  net_out_kb: number;
  cpu_temp: number | null;
  gpu_temp: number | null;
  battery_watts: number;
  battery_percent: number;
}

export async function getSystemHistory(range: TimeRange): Promise<SystemHistoryPoint[]> {
  const seconds = rangeToSeconds(range);

  // For long windows like 24h, we group into buckets to keep the dataset responsive.
  const isLongWindow = seconds >= 3600;
  const bucketSeconds = isLongWindow ? (seconds > 7200 ? 300 : 60) : 2;

  const sql = isLongWindow
    ? `
      WITH anchor AS (SELECT max(timestamp) as max_ts FROM system_samples)
      SELECT 
        (CAST(timestamp / ${bucketSeconds} AS INT) * ${bucketSeconds}) as timestamp,
        round(avg(cpu_load * 100), 1) as cpu_percent,
        round(avg(pressure_percent), 1) as memory_pressure,
        round(avg(gpu_util), 1) as gpu_percent,
        round(avg(disk_read) / 1048576.0, 2) as disk_read_mb,
        round(avg(disk_write) / 1048576.0, 2) as disk_write_mb,
        round(avg(net_in) / 1024.0, 1) as net_in_kb,
        round(avg(net_out) / 1024.0, 1) as net_out_kb,
        round(avg(cpu_die), 1) as cpu_temp,
        round(avg(gpu_die), 1) as gpu_temp,
        round(avg(abs(battery_power)), 2) as battery_watts,
        round(avg(battery_charge), 1) as battery_percent
      FROM system_samples, anchor
      WHERE timestamp >= (max_ts - ${seconds})
      GROUP BY 1
      ORDER BY 1 ASC;
    `
    : `
      WITH anchor AS (SELECT max(timestamp) as max_ts FROM system_samples)
      SELECT 
        timestamp,
        round(cpu_load * 100, 1) as cpu_percent,
        round(pressure_percent, 1) as memory_pressure,
        round(gpu_util, 1) as gpu_percent,
        round(disk_read / 1048576.0, 2) as disk_read_mb,
        round(disk_write / 1048576.0, 2) as disk_write_mb,
        round(net_in / 1024.0, 1) as net_in_kb,
        round(net_out / 1024.0, 1) as net_out_kb,
        cpu_die as cpu_temp,
        gpu_die as gpu_temp,
        round(abs(battery_power), 2) as battery_watts,
        battery_charge as battery_percent
      FROM system_samples, anchor
      WHERE timestamp >= (max_ts - ${seconds})
      ORDER BY timestamp ASC;
    `;

  const rows = await querySqlite<RawHistoryRow>(sql);

  return rows.map((r) => ({
    timestamp: r.timestamp,
    cpuPercent: r.cpu_percent || 0,
    memoryPressure: r.memory_pressure || 0,
    gpuPercent: r.gpu_percent || 0,
    diskReadMb: r.disk_read_mb || 0,
    diskWriteMb: r.disk_write_mb || 0,
    netInKb: r.net_in_kb || 0,
    netOutKb: r.net_out_kb || 0,
    cpuTemp: r.cpu_temp,
    gpuTemp: r.gpu_temp,
    batteryWatts: r.battery_watts || 0,
    batteryPercent: r.battery_percent || 0,
  }));
}

interface RawAppGroupRow {
  app_name: string;
  process_count: number;
  memory_bytes: number;
  cpu_percent: number;
  gpu_percent: number;
  disk_read_bytes: number;
  disk_written_bytes: number;
  energy_impact: number;
  primary_pid: number;
  executable_path: string | null;
  bundle_id: string | null;
}

export type SortMetric = "memory" | "cpu" | "gpu" | "disk" | "energy";

export async function getGroupedApps(sortBy: SortMetric = "memory", limit = 40): Promise<AppGroup[]> {
  let orderClause = "memory_bytes DESC";
  switch (sortBy) {
    case "memory":
      orderClause = "memory_bytes DESC";
      break;
    case "cpu":
      orderClause = "cpu_percent DESC";
      break;
    case "gpu":
      orderClause = "gpu_percent DESC";
      break;
    case "disk":
      orderClause = "(disk_read_bytes + disk_written_bytes) DESC";
      break;
    case "energy":
      orderClause = "energy_impact DESC";
      break;
  }

  const sql = `
    WITH latest_time AS (
      SELECT max(timestamp) AS ts FROM process_samples
    ),
    app_classified AS (
      SELECT 
        CASE 
          WHEN instr(p.executable_path, '.app/') > 0 THEN 
            replace(substr(p.executable_path, 1, instr(p.executable_path, '.app/') - 1), rtrim(substr(p.executable_path, 1, instr(p.executable_path, '.app/') - 1), replace(substr(p.executable_path, 1, instr(p.executable_path, '.app/') - 1), '/', '')), '')
          ELSE p.name
        END AS app_name,
        p.id AS process_id,
        p.pid,
        p.executable_path,
        p.bundle_id,
        ps.phys_footprint,
        ps.cpu_percent,
        ps.gpu_percent,
        ps.disk_read,
        ps.disk_written,
        ps.energy_impact
      FROM process_samples ps
      JOIN processes p ON ps.process_id = p.id
      WHERE ps.timestamp = (SELECT ts FROM latest_time)
    )
    SELECT 
      app_name,
      count(*) AS process_count,
      sum(phys_footprint) AS memory_bytes,
      round(sum(cpu_percent), 1) AS cpu_percent,
      round(sum(gpu_percent), 1) AS gpu_percent,
      sum(disk_read) AS disk_read_bytes,
      sum(disk_written) AS disk_written_bytes,
      round(sum(energy_impact), 1) AS energy_impact,
      min(pid) AS primary_pid,
      max(executable_path) AS executable_path,
      max(bundle_id) AS bundle_id
    FROM app_classified
    GROUP BY app_name
    ORDER BY ${orderClause}
    LIMIT ${limit};
  `;

  const rows = await querySqlite<RawAppGroupRow>(sql);

  return rows.map((r) => ({
    appName: r.app_name,
    processCount: r.process_count,
    memoryBytes: r.memory_bytes || 0,
    cpuPercent: r.cpu_percent || 0,
    gpuPercent: r.gpu_percent || 0,
    diskReadBytes: r.disk_read_bytes || 0,
    diskWrittenBytes: r.disk_written_bytes || 0,
    energyImpact: r.energy_impact || 0,
    primaryPid: r.primary_pid,
    executablePath: r.executable_path,
    bundleId: r.bundle_id,
  }));
}

interface RawSubprocessRow {
  pid: number;
  name: string;
  executable_path: string;
  memory_bytes: number;
  cpu_percent: number;
  gpu_percent: number;
  disk_read_bytes: number;
  disk_written_bytes: number;
  energy_impact: number;
  architecture: string;
  is_translated: number;
}

export async function getAppSubprocesses(appName: string): Promise<SubprocessItem[]> {
  const sql = `
    WITH latest_time AS (
      SELECT max(timestamp) AS ts FROM process_samples
    )
    SELECT 
      p.pid,
      p.name,
      COALESCE(p.executable_path, '') AS executable_path,
      COALESCE(p.architecture, 'unknown') AS architecture,
      COALESCE(p.is_translated, 0) AS is_translated,
      ps.phys_footprint AS memory_bytes,
      round(ps.cpu_percent, 1) AS cpu_percent,
      round(ps.gpu_percent, 1) AS gpu_percent,
      ps.disk_read AS disk_read_bytes,
      ps.disk_written AS disk_written_bytes,
      round(ps.energy_impact, 1) AS energy_impact
    FROM process_samples ps
    JOIN processes p ON ps.process_id = p.id
    WHERE ps.timestamp = (SELECT ts FROM latest_time)
      AND (
        (instr(p.executable_path, '.app/') > 0 AND replace(substr(p.executable_path, 1, instr(p.executable_path, '.app/') - 1), rtrim(substr(p.executable_path, 1, instr(p.executable_path, '.app/') - 1), replace(substr(p.executable_path, 1, instr(p.executable_path, '.app/') - 1), '/', '')), '') = '${appName.replace(/'/g, "''")}')
        OR p.name = '${appName.replace(/'/g, "''")}'
      )
    ORDER BY ps.phys_footprint DESC;
  `;

  const rows = await querySqlite<RawSubprocessRow>(sql);

  return rows.map((r) => ({
    pid: r.pid,
    name: r.name,
    executablePath: r.executable_path,
    memoryBytes: r.memory_bytes || 0,
    cpuPercent: r.cpu_percent || 0,
    gpuPercent: r.gpu_percent || 0,
    diskReadBytes: r.disk_read_bytes || 0,
    diskWrittenBytes: r.disk_written_bytes || 0,
    energyImpact: r.energy_impact || 0,
    architecture: r.architecture,
    isTranslated: r.is_translated === 1,
  }));
}

interface RawMetaRow {
  key: string;
  value: number;
}

export async function getMacTopology(): Promise<MacTopology> {
  const metaRows = await querySqlite<RawMetaRow>("SELECT key, value FROM meta WHERE key LIKE 'agent.%';");

  const metaMap = new Map<string, number>();
  for (const row of metaRows) {
    metaMap.set(row.key, row.value);
  }

  const cpus = os.cpus();
  const totalLogical = cpus.length;
  const chipModel = cpus[0]?.model || "Apple Silicon";

  let pCores = metaMap.get("agent.performance_cores");
  let eCores = metaMap.get("agent.efficiency_cores");

  if (pCores === undefined || eCores === undefined) {
    try {
      const out = execSync("sysctl -n hw.perflevel0.logicalcpu hw.perflevel1.logicalcpu", {
        encoding: "utf-8",
        timeout: 1000,
      })
        .trim()
        .split(/\s+/);
      if (out.length >= 2) {
        pCores = parseInt(out[0], 10);
        eCores = parseInt(out[1], 10);
      }
    } catch {
      // Fallback if sysctl fails
    }
  }

  pCores = pCores ?? Math.floor(totalLogical / 2);
  eCores = eCores ?? totalLogical - pCores;
  const totalRam = metaMap.get("agent.memory_bytes") ?? os.totalmem();

  return {
    cpuCores: metaMap.get("agent.cpu_cores") ?? totalLogical,
    performanceCores: pCores,
    efficiencyCores: eCores,
    memoryBytes: totalRam,
    chip: chipModel,
    model: os.hostname(),
  };
}

let previousCpuTimes: { user: number; nice: number; sys: number; idle: number; irq: number }[] | null = null;

export function sampleCoreUsage(topology: MacTopology): CoreUsage[] {
  const currentCpus = os.cpus();
  if (!previousCpuTimes || previousCpuTimes.length !== currentCpus.length) {
    previousCpuTimes = currentCpus.map((c) => c.times);
    // Return empty or zero on initial measurement
    return currentCpus.map((_, index) => {
      const isEfficiency =
        index < topology.efficiencyCores && topology.efficiencyCores + topology.performanceCores === currentCpus.length;
      return {
        index,
        kind: isEfficiency ? "efficiency" : "performance",
        usage: 0,
      };
    });
  }

  const results: CoreUsage[] = [];
  for (let i = 0; i < currentCpus.length; i++) {
    const prev = previousCpuTimes[i];
    const curr = currentCpus[i].times;

    const userDelta = curr.user - prev.user;
    const sysDelta = curr.sys - prev.sys;
    const idleDelta = curr.idle - prev.idle;
    const totalDelta = userDelta + sysDelta + idleDelta;

    const busyShare = totalDelta > 0 ? ((userDelta + sysDelta) / totalDelta) * 100 : 0;
    const isEfficiency =
      i < topology.efficiencyCores && topology.efficiencyCores + topology.performanceCores === currentCpus.length;

    results.push({
      index: i,
      kind: isEfficiency ? "efficiency" : "performance",
      usage: Math.min(100, Math.max(0, Math.round(busyShare))),
    });
  }

  previousCpuTimes = currentCpus.map((c) => c.times);
  return results;
}

// Workload Classification matching GPUWorkload.swift
const AI_MARKERS = [
  "ollama",
  "llama-server",
  "llama-cli",
  "llama.cpp",
  "llamafile",
  "lm studio",
  "lmstudio",
  "/lms",
  "mlx_lm",
  "mlx-lm",
  "mlx.",
  "/mlx",
  "koboldcpp",
  "gpt4all",
  "jan.ai",
  "text-generation-webui",
  "vllm",
  "comfyui",
  "draw things",
  "drawthings",
  "diffusionbee",
  "stable diffusion",
  "invokeai",
  "whisper",
  "anecompilerservice",
  "aned",
  "coremlservice",
  "com.apple.coreml",
  "mediaanalysisd",
  "photoanalysisd",
  "intelligenceplatform",
  "generativeexperiences",
  "generativefunctions",
  "privatecloudcompute",
  "siriinference",
];

const MEDIA_MARKERS = [
  "vtdecoderxpcservice",
  "vtencoderxpcservice",
  "videotoolbox",
  "avconferenced",
  "replayd",
  "screen sharing",
  "screensharing",
  "screencaptureui",
  "quicktime",
  "final cut",
  "compressor",
  "imovie",
  "handbrake",
  "obs",
  "zoom.us",
  "com.microsoft.teams",
  "facetime",
  "photos.app",
  "photolibraryd",
];

const DISPLAY_MARKERS = [
  "windowserver",
  "dock",
  "systemuiserver",
  "controlcenter",
  "notificationcenter",
  "wallpaper",
  "helper (gpu)",
  "helper (renderer)",
  "com.apple.webkit.gpu",
  "webkit.gpu",
  "gpu process",
  "finder",
  "spotlight",
  "loginwindow",
  "accessibilityui",
];

export function classifyProcessWorkload(
  name: string,
  bundleId?: string | null,
  executablePath?: string | null,
): "aiMl" | "displayUi" | "media" | "other" {
  const key = [name, bundleId || "", executablePath || ""].join(" ").toLowerCase();

  for (const marker of AI_MARKERS) {
    if (key.includes(marker)) return "aiMl";
  }
  for (const marker of MEDIA_MARKERS) {
    if (key.includes(marker)) return "media";
  }
  for (const marker of DISPLAY_MARKERS) {
    if (key.includes(marker)) return "displayUi";
  }
  return "other";
}

export async function getGpuWorkloadSlices(): Promise<WorkloadSlices> {
  const apps = await getGroupedApps("gpu", 60);
  const slices: WorkloadSlices = { aiMl: 0, displayUi: 0, media: 0, other: 0 };

  for (const app of apps) {
    if (app.gpuPercent <= 0) continue;
    const category = classifyProcessWorkload(app.appName, app.bundleId, app.executablePath);
    slices[category] += app.gpuPercent;
  }

  return slices;
}

export async function getDiskWorkloadSlices(): Promise<WorkloadSlices> {
  const apps = await getGroupedApps("disk", 60);
  const slices: WorkloadSlices = { aiMl: 0, displayUi: 0, media: 0, other: 0 };

  for (const app of apps) {
    const totalBytes = app.diskReadBytes + app.diskWrittenBytes;
    if (totalBytes <= 0) continue;
    const category = classifyProcessWorkload(app.appName, app.bundleId, app.executablePath);
    slices[category] += totalBytes;
  }

  return slices;
}
