export function formatBytes(bytes: number, precision = 1): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const clampedI = Math.min(units.length - 1, Math.max(0, i));
  const value = bytes / Math.pow(1024, clampedI);
  return `${value.toFixed(precision)} ${units[clampedI]}`;
}

export function formatRate(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatPercent(val: number, precision = 1): string {
  return `${val.toFixed(precision)}%`;
}

export function formatWatts(watts: number): string {
  return `${watts.toFixed(1)} W`;
}

export function formatTemp(celsius: number | null): string {
  if (celsius === null || celsius === undefined || isNaN(celsius) || celsius <= 0) {
    return "N/A";
  }
  return `${Math.round(celsius)}°C`;
}

export function formatLatency(latencySeconds: number): string {
  if (latencySeconds <= 0) return "0 ms";
  const ms = latencySeconds * 1000;
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  return `${ms.toFixed(1)} ms`;
}

export function formatIops(iops: number): string {
  if (iops >= 1000) return `${(iops / 1000).toFixed(1)}k IOPS`;
  return `${Math.round(iops)} IOPS`;
}

export function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatUptime(): string {
  const uptimeSeconds = process.uptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
