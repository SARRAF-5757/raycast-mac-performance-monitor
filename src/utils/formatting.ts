/**
 * Small helpers that turn numbers into the strings the views display.
 */

/** Formats a byte count with binary units (1610612736 -> "1.5 GB"). */
export function formatBytes(bytes: number, decimals = 1): string {
  // log(0) is -Infinity, so zero needs its own case.
  if (bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  unitIndex = Math.min(units.length - 1, Math.max(0, unitIndex));
  const value = bytes / Math.pow(1024, unitIndex);
  return value.toFixed(decimals) + " " + units[unitIndex];
}

/** Formats a throughput in bytes per second ("24.5 MB/s"). */
export function formatRate(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + "/s";
}

/** Formats a percentage (85.43 -> "85.4%"). */
export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null) {
    return "N/A";
  }
  return value.toFixed(decimals) + "%";
}

/** Formats electrical power ("12.4 W"). */
export function formatWatts(watts: number | null): string {
  if (watts === null) {
    return "N/A";
  }
  return watts.toFixed(1) + " W";
}

/** Formats a temperature ("54°C"). */
export function formatTemp(celsius: number | null): string {
  if (celsius === null) {
    return "N/A";
  }
  return Math.round(celsius) + "°C";
}
