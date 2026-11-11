import { AppGroup, CoreUsage, MacTopology, SystemSnapshot } from "../data/types";
import { formatBytes, formatPercent, formatWatts } from "./formatting";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function svgToDataUri(svg: string): string {
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function normalizeToSvg(input?: string | null): string {
  if (!input) return "";
  if (input.startsWith("data:image/svg+xml;base64,")) {
    const base64 = input.replace("data:image/svg+xml;base64,", "");
    return Buffer.from(base64, "base64").toString("utf-8");
  }
  return input;
}

function downsample(data: number[], maxPoints = 60): number[] {
  if (data.length <= maxPoints) return data;
  const result: number[] = [];
  const step = data.length / maxPoints;
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < data.length; j++) {
      sum += data[j];
      count++;
    }
    result.push(count > 0 ? sum / count : data[start]);
  }
  if (result.length > 0 && data.length > 0) {
    result[result.length - 1] = data[data.length - 1];
  }
  return result;
}

export interface WarningPill {
  id: string;
  label: string;
  level: "critical" | "warning" | "caution";
}

export function generateWarningPills(warnings: WarningPill[], width = 760): string | null {
  if (!warnings || warnings.length === 0) return null;

  // Roughly quarter width of the application window (around 180px each)
  const gap = 10;
  const pillHeight = 28;
  const maxPillsPerRow = 4;
  const activeCount = Math.min(warnings.length, maxPillsPerRow);
  const pillWidth = Math.floor((width - (activeCount - 1) * gap) / activeCount);
  const height = pillHeight + 6;

  const renderedPills = warnings.slice(0, 4).map((w, i) => {
    const x = i * (pillWidth + gap);
    const y = 3;

    let stroke = "#FF9F0A";
    let fill = "rgba(255, 159, 10, 0.16)";
    let textColor = "#FFD60A";

    if (w.level === "critical") {
      stroke = "#FF453A";
      fill = "rgba(255, 69, 58, 0.18)";
      textColor = "#FF6961";
    } else if (w.level === "caution") {
      stroke = "#FFD60A";
      fill = "rgba(255, 214, 10, 0.14)";
      textColor = "#FFE066";
    }

    return `
      <g transform="translate(${x}, ${y})">
        <rect width="${pillWidth}" height="${pillHeight}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>
        <circle cx="14" cy="14" r="4" fill="${stroke}"/>
        <text x="25" y="18" fill="${textColor}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">${escapeXml(w.label)}</text>
      </g>
    `;
  });

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${renderedPills.join("\n")}
</svg>
  `.trim();

  return svgToDataUri(svg);
}

export function generateHeadlineCards(snapshot: SystemSnapshot, topology: MacTopology | null, width = 760): string {
  const height = 74;
  const padding = 12;
  const gap = 10;
  const cardCount = 4;
  const cardWidth = Math.floor((width - (cardCount - 1) * gap) / cardCount);

  const cpuPercent = (snapshot.cpuLoad * 100).toFixed(1);
  const pressureVal = snapshot.pressurePercent.toFixed(1);
  const pressureLabel =
    snapshot.pressurePercent >= 67 ? "Critical" : snapshot.pressurePercent >= 34 ? "Warning" : "Nominal";
  const pressureColor =
    snapshot.pressurePercent >= 67 ? "#FF453A" : snapshot.pressurePercent >= 34 ? "#FF9F0A" : "#30D158";

  const totalRam = topology?.memoryBytes || snapshot.totalRam || 1;
  const activeRamStr = formatBytes(snapshot.activeRam);
  const totalRamStr = formatBytes(totalRam);

  const powerStr = snapshot.batteryWatts > 0 ? formatWatts(snapshot.batteryWatts) : "AC Outlet";
  const batterySub = snapshot.batteryPresent ? `${Math.round(snapshot.batteryCharge)}% charge` : "Desktop power";

  const cardsData = [
    {
      title: "PROCESSOR",
      value: `${cpuPercent}%`,
      sub: `${snapshot.load1.toFixed(2)} 1m load`,
      color: "#BF5AF2",
    },
    {
      title: "PRESSURE",
      value: `${pressureVal}%`,
      sub: pressureLabel,
      color: pressureColor,
    },
    {
      title: "ACTIVE MEMORY",
      value: activeRamStr,
      sub: `of ${totalRamStr}`,
      color: "#0A84FF",
    },
    {
      title: "POWER DRAW",
      value: powerStr,
      sub: batterySub,
      color: "#FFD60A",
    },
  ];

  const renderedCards = cardsData.map((c, i) => {
    const x = i * (cardWidth + gap);
    return `
      <g transform="translate(${x}, 0)">
        <rect width="${cardWidth}" height="${height}" rx="10" fill="#161618" stroke="#28282C" stroke-width="1"/>
        <text x="${padding}" y="20" fill="#8E8E93" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="600" letter-spacing="0.5">${c.title}</text>
        <text x="${padding}" y="44" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="18" font-weight="700">${c.value}</text>
        <text x="${padding}" y="62" fill="${c.color}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">${c.sub}</text>
      </g>
    `;
  });

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${renderedCards.join("\n")}
</svg>
  `.trim();

  return svgToDataUri(svg);
}

export interface LeaderboardItem {
  name: string;
  value: string;
  color?: string;
}

export function generateMiniLeaderboardCard(
  title: string,
  items: LeaderboardItem[],
  accentColor = "#0A84FF",
  width = 374,
  height = 180,
): string {
  const visibleItems = items.slice(0, 5);
  const rowHeight = 26;
  const startY = 36;

  const rows = visibleItems.map((item, i) => {
    const y = startY + i * rowHeight + 17;
    const isEven = i % 2 === 0;
    const bg = isEven
      ? `<rect x="10" y="${y - 13}" width="${width - 20}" height="${rowHeight - 2}" rx="4" fill="#1C1C20" opacity="0.6"/>`
      : "";
    const cleanName = item.name.length > 20 ? item.name.slice(0, 19) + "..." : item.name;

    return `
      ${bg}
      <text x="16" y="${y}" fill="#6E6E73" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">${i + 1}</text>
      <text x="34" y="${y}" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(cleanName)}</text>
      <text x="${width - 16}" y="${y}" fill="${item.color || accentColor}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="700" text-anchor="end">${escapeXml(item.value)}</text>
    `;
  });

  const emptyState =
    visibleItems.length === 0
      ? `<text x="${width / 2}" y="${height / 2 + 4}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" text-anchor="middle">No active applications</text>`
      : "";

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="10" fill="#161618" stroke="#28282C" stroke-width="1"/>
  <text x="16" y="24" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600">${escapeXml(title)}</text>
  ${rows.join("\n")}
  ${emptyState}
</svg>
  `.trim();

  return svgToDataUri(svg);
}

export function renderCardRow(card1Input: string, card2Input?: string | null, width = 760, height = 180): string {
  const svg1 = normalizeToSvg(card1Input);
  const svg2 = normalizeToSvg(card2Input);

  const cardWidth = Math.floor((width - 12) / 2);
  const card2X = cardWidth + 12;

  const clean1 = svg1.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const clean2 = svg2 ? svg2.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "") : "";

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(0, 0)">
    ${clean1}
  </g>
  ${card2Svg(clean2, card2X)}
</svg>
  `.trim();

  return svgToDataUri(svg);
}

function card2Svg(clean2: string, card2X: number): string {
  if (!clean2) return "";
  return `<g transform="translate(${card2X}, 0)">\n    ${clean2}\n  </g>`;
}

export function generateTopAppsCard(apps: AppGroup[], width = 760): string {
  const visibleApps = apps.slice(0, 6);
  const rowHeight = 28;
  const headerHeight = 36;
  const tableHeaderY = 60;
  const height = tableHeaderY + visibleApps.length * rowHeight + 12;

  const colAppX = 16;
  const colCpuX = Math.floor(width * 0.44);
  const colMemX = Math.floor(width * 0.62);
  const colGpuX = Math.floor(width * 0.78);
  const colProcX = width - 20;

  const rowNodes = visibleApps.map((app, i) => {
    const y = tableHeaderY + i * rowHeight + 18;
    const isEven = i % 2 === 0;
    const bgRect = isEven
      ? `<rect x="10" y="${y - 14}" width="${width - 20}" height="${rowHeight}" rx="4" fill="#1C1C20" opacity="0.4"/>`
      : "";

    return `
      ${bgRect}
      <text x="${colAppX}" y="${y}" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(app.appName)}</text>
      <text x="${colCpuX}" y="${y}" fill="#BF5AF2" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${formatPercent(app.cpuPercent)}</text>
      <text x="${colMemX}" y="${y}" fill="#0A84FF" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12">${formatBytes(app.memoryBytes)}</text>
      <text x="${colGpuX}" y="${y}" fill="#30D158" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12">${formatPercent(app.gpuPercent)}</text>
      <text x="${colProcX}" y="${y}" fill="#8E8E93" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" text-anchor="end">${app.processCount}</text>
    `;
  });

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="10" fill="#161618" stroke="#28282C" stroke-width="1"/>
  
  <text x="16" y="24" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600">Top Active Applications</text>

  <!-- Table Header -->
  <text x="${colAppX}" y="${headerHeight + 8}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">APPLICATION</text>
  <text x="${colCpuX}" y="${headerHeight + 8}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">CPU</text>
  <text x="${colMemX}" y="${headerHeight + 8}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">MEMORY</text>
  <text x="${colGpuX}" y="${headerHeight + 8}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">GPU</text>
  <text x="${colProcX}" y="${headerHeight + 8}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" text-anchor="end">PROCESSES</text>
  
  <line x1="16" y1="${headerHeight + 14}" x2="${width - 16}" y2="${headerHeight + 14}" stroke="#2C2C32" stroke-width="1"/>

  ${rowNodes.join("\n")}
</svg>
  `.trim();

  return svgToDataUri(svg);
}

export function generateAreaChart(
  data: number[],
  options: {
    width?: number;
    height?: number;
    color?: string;
    label?: string;
    unit?: string;
    maxValue?: number;
    idPrefix?: string;
  } = {},
): string {
  const width = options.width || 760;
  const height = options.height || 180;
  const color = options.color || "#0A84FF";
  const label = options.label || "";
  const unit = options.unit || "%";

  const isCompact = width <= 400;
  const paddingLeft = isCompact ? 46 : 50;
  const paddingRight = 16;
  const paddingTop = 36;
  const paddingBottom = 24;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const rawPoints = data.length > 0 ? data : [0, 0];
  const points = downsample(rawPoints, 60);

  const maxData = Math.max(...points, 1);
  const max =
    options.maxValue !== undefined ? Math.max(options.maxValue, maxData) : Math.max(100, Math.ceil(maxData / 10) * 10);
  const latest = rawPoints[rawPoints.length - 1];

  // Coordinates
  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;
  const coords = points.map((val, i) => {
    const x = paddingLeft + i * stepX;
    const normalized = Math.min(1, Math.max(0, val / max));
    const y = paddingTop + chartHeight - normalized * chartHeight;
    return { x, y };
  });

  // Construct SVG path
  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpX1 = prev.x + (curr.x - prev.x) / 2;
    const cpX2 = cpX1;
    pathD += ` C ${cpX1} ${prev.y}, ${cpX2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const fillD = `${pathD} L ${coords[coords.length - 1].x} ${paddingTop + chartHeight} L ${coords[0].x} ${paddingTop + chartHeight} Z`;

  // Guideline values (0%, 50%, 100%)
  const y0 = paddingTop + chartHeight;
  const y50 = paddingTop + chartHeight / 2;
  const y100 = paddingTop;

  const gradId = `chartGrad_${color.replace("#", "")}_${(options.idPrefix || label).replace(/[^a-zA-Z0-9]/g, "")}`;

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.38"/>
      <stop offset="90%" stop-color="${color}" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.0"/>
    </linearGradient>
  </defs>

  <!-- Background Card -->
  <rect width="${width}" height="${height}" rx="10" fill="#161618" stroke="#28282C" stroke-width="1"/>

  <!-- Guidelines -->
  <line x1="${paddingLeft}" y1="${y100}" x2="${width - paddingRight}" y2="${y100}" stroke="#2C2C32" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="${paddingLeft}" y1="${y50}" x2="${width - paddingRight}" y2="${y50}" stroke="#2C2C32" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="${paddingLeft}" y1="${y0}" x2="${width - paddingRight}" y2="${y0}" stroke="#3A3A42" stroke-width="1"/>

  <!-- Y-Axis Labels -->
  <text x="${paddingLeft - 8}" y="${y100 + 4}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" text-anchor="end">${max}${unit}</text>
  <text x="${paddingLeft - 8}" y="${y50 + 4}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" text-anchor="end">${Math.round(max / 2)}${unit}</text>
  <text x="${paddingLeft - 8}" y="${y0 + 4}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" text-anchor="end">0${unit}</text>

  <!-- Area Fill -->
  <path d="${fillD}" fill="url(#${gradId})"/>

  <!-- Stroke Line -->
  <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Current Value Indicator -->
  <circle cx="${coords[coords.length - 1].x}" cy="${coords[coords.length - 1].y}" r="3.5" fill="#FFFFFF" stroke="${color}" stroke-width="2"/>

  <!-- Header Text -->
  <text x="16" y="24" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600">${escapeXml(label)}</text>
  <text x="${width - 16}" y="24" fill="${color}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="700" text-anchor="end">${latest.toFixed(1)}${unit}</text>
</svg>
  `.trim();

  return svgToDataUri(svg);
}

export function generateDualAreaChart(
  dataA: number[],
  dataB: number[],
  options: {
    width?: number;
    height?: number;
    title?: string;
    labelA: string;
    labelB: string;
    colorA: string;
    colorB: string;
    unit?: string;
    idPrefix?: string;
  },
): string {
  const width = options.width || 760;
  const height = options.height || 180;
  const isCompact = width <= 400;
  const paddingLeft = isCompact ? 46 : 55;
  const paddingRight = 16;
  const paddingTop = 36;
  const paddingBottom = 24;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const rawA = dataA.length > 0 ? dataA : [0, 0];
  const rawB = dataB.length > 0 ? dataB : [0, 0];

  const ptsA = downsample(rawA, 60);
  const ptsB = downsample(rawB, 60);
  const count = Math.max(ptsA.length, ptsB.length);

  const maxVal = Math.max(...ptsA, ...ptsB, 1);
  const max = Math.ceil(maxVal * 1.15);

  const stepX = count > 1 ? chartWidth / (count - 1) : chartWidth;

  const getPath = (pts: number[]) => {
    const coords = pts.map((val, i) => {
      const x = paddingLeft + i * stepX;
      const normalized = Math.min(1, Math.max(0, val / max));
      const y = paddingTop + chartHeight - normalized * chartHeight;
      return { x, y };
    });

    let pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cpX = prev.x + (curr.x - prev.x) / 2;
      pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    const fillD = `${pathD} L ${coords[coords.length - 1].x} ${paddingTop + chartHeight} L ${coords[0].x} ${paddingTop + chartHeight} Z`;
    return { pathD, fillD, last: coords[coords.length - 1] };
  };

  const curveA = getPath(ptsA);
  const curveB = getPath(ptsB);

  const y0 = paddingTop + chartHeight;
  const y50 = paddingTop + chartHeight / 2;
  const y100 = paddingTop;

  const latestA = rawA[rawA.length - 1] || 0;
  const latestB = rawB[rawB.length - 1] || 0;
  const unit = options.unit || "MB/s";
  const idSuffix = (options.idPrefix || "dual").replace(/[^a-zA-Z0-9]/g, "");

  const legendA = isCompact
    ? `
      <circle cx="16" cy="20" r="3.5" fill="${options.colorA}"/>
      <text x="24" y="24" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">${escapeXml(options.labelA)} <tspan fill="${options.colorA}" font-weight="700">${latestA.toFixed(1)}${unit}</tspan></text>
    `
    : `
      <circle cx="20" cy="19" r="4" fill="${options.colorA}"/>
      <text x="30" y="23" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(options.labelA)}:</text>
      <text x="120" y="23" fill="${options.colorA}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="700">${latestA.toFixed(1)} ${unit}</text>
    `;

  const legendB = isCompact
    ? `
      <circle cx="${width - 120}" cy="20" r="3.5" fill="${options.colorB}"/>
      <text x="${width - 112}" y="24" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">${escapeXml(options.labelB)} <tspan fill="${options.colorB}" font-weight="700">${latestB.toFixed(1)}${unit}</tspan></text>
    `
    : `
      <circle cx="240" cy="19" r="4" fill="${options.colorB}"/>
      <text x="250" y="23" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(options.labelB)}:</text>
      <text x="340" y="23" fill="${options.colorB}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="700">${latestB.toFixed(1)} ${unit}</text>
    `;

  const headerContent = options.title
    ? isCompact
      ? `
        <text x="16" y="24" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(options.title)}</text>
        <circle cx="${width - 132}" cy="20" r="3.5" fill="${options.colorA}"/>
        <text x="${width - 124}" y="24" fill="${options.colorA}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="700">${latestA.toFixed(1)}</text>
        <circle cx="${width - 70}" cy="20" r="3.5" fill="${options.colorB}"/>
        <text x="${width - 62}" y="24" fill="${options.colorB}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="700">${latestB.toFixed(1)}${unit}</text>
      `
      : `
        <text x="16" y="23" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600">${escapeXml(options.title)}</text>
        <circle cx="${width - 310}" cy="19" r="4" fill="${options.colorA}"/>
        <text x="${width - 300}" y="23" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(options.labelA)}: <tspan fill="${options.colorA}" font-weight="700">${latestA.toFixed(1)} ${unit}</tspan></text>
        <circle cx="${width - 150}" cy="19" r="4" fill="${options.colorB}"/>
        <text x="${width - 140}" y="23" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(options.labelB)}: <tspan fill="${options.colorB}" font-weight="700">${latestB.toFixed(1)} ${unit}</tspan></text>
      `
    : `${legendA}\n  ${legendB}`;

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradA_${idSuffix}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${options.colorA}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${options.colorA}" stop-opacity="0.0"/>
    </linearGradient>
    <linearGradient id="gradB_${idSuffix}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${options.colorB}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${options.colorB}" stop-opacity="0.0"/>
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" rx="10" fill="#161618" stroke="#28282C" stroke-width="1"/>

  <line x1="${paddingLeft}" y1="${y100}" x2="${width - paddingRight}" y2="${y100}" stroke="#2C2C32" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="${paddingLeft}" y1="${y50}" x2="${width - paddingRight}" y2="${y50}" stroke="#2C2C32" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="${paddingLeft}" y1="${y0}" x2="${width - paddingRight}" y2="${y0}" stroke="#3A3A42" stroke-width="1"/>

  <text x="${paddingLeft - 8}" y="${y100 + 4}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" text-anchor="end">${max}${unit}</text>
  <text x="${paddingLeft - 8}" y="${y50 + 4}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" text-anchor="end">${(max / 2).toFixed(0)}</text>
  <text x="${paddingLeft - 8}" y="${y0 + 4}" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" text-anchor="end">0</text>

  <!-- Curve A -->
  <path d="${curveA.fillD}" fill="url(#gradA_${idSuffix})"/>
  <path d="${curveA.pathD}" fill="none" stroke="${options.colorA}" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="${curveA.last.x}" cy="${curveA.last.y}" r="3" fill="#FFF" stroke="${options.colorA}" stroke-width="2"/>

  <!-- Curve B -->
  <path d="${curveB.fillD}" fill="url(#gradB_${idSuffix})"/>
  <path d="${curveB.pathD}" fill="none" stroke="${options.colorB}" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="${curveB.last.x}" cy="${curveB.last.y}" r="3" fill="#FFF" stroke="${options.colorB}" stroke-width="2"/>

  <!-- Legend & Values -->
  ${headerContent}
</svg>
  `.trim();

  return svgToDataUri(svg);
}

export function generateCoreGrid(cores: CoreUsage[], width = 760, height = 180): string {
  const pCores = cores.filter((c) => c.kind === "performance");
  const eCores = cores.filter((c) => c.kind === "efficiency");

  const isCompact = width <= 400;
  const colCount = isCompact ? 4 : Math.min(8, Math.max(4, Math.ceil(cores.length / 2)));
  const padding = 16;
  const availWidth = width - padding * 2;
  const gap = isCompact ? 6 : 8;
  const colWidth = Math.floor((availWidth - gap * (colCount - 1)) / colCount);
  const rowHeight = isCompact ? 28 : 44;
  const startY = isCompact ? 36 : 38;

  const renderCoreBar = (core: CoreUsage, x: number, y: number) => {
    const isP = core.kind === "performance";
    const color = isP ? "#BF5AF2" : "#30D158";
    const labelPrefix = isP ? "P" : "E";
    const coreLabel = `${labelPrefix}${core.index}`;
    const fillWidth = Math.max(3, Math.round(((colWidth - 12) * core.usage) / 100));

    if (isCompact) {
      return `
        <g transform="translate(${x}, ${y})">
          <rect width="${colWidth}" height="${rowHeight}" rx="5" fill="#1C1C20" stroke="#2A2A30" stroke-width="1"/>
          <text x="6" y="12" fill="#9898A2" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="9" font-weight="600">${coreLabel}</text>
          <text x="${colWidth - 6}" y="12" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="9" font-weight="700" text-anchor="end">${core.usage}%</text>
          <rect x="6" y="17" width="${colWidth - 12}" height="4" rx="2" fill="#282830"/>
          <rect x="6" y="17" width="${fillWidth}" height="4" rx="2" fill="${color}"/>
        </g>
      `;
    }

    return `
      <g transform="translate(${x}, ${y})">
        <rect width="${colWidth}" height="36" rx="6" fill="#1C1C20" stroke="#2A2A30" stroke-width="1"/>
        <text x="8" y="16" fill="#9898A2" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="600">${coreLabel}</text>
        <text x="${colWidth - 8}" y="16" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="700" text-anchor="end">${core.usage}%</text>
        <rect x="8" y="24" width="${colWidth - 16}" height="5" rx="2.5" fill="#282830"/>
        <rect x="8" y="24" width="${fillWidth}" height="5" rx="2.5" fill="${color}"/>
      </g>
    `;
  };

  const coreNodes: string[] = [];
  for (let i = 0; i < cores.length; i++) {
    const row = Math.floor(i / colCount);
    const col = i % colCount;
    const x = padding + col * (colWidth + gap);
    const y = startY + row * (rowHeight + (isCompact ? 4 : 0));
    coreNodes.push(renderCoreBar(cores[i], x, y));
  }

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="10" fill="#161618" stroke="#28282C" stroke-width="1"/>
  
  <text x="16" y="22" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600">CPU Cores</text>
  <text x="${width - 16}" y="22" fill="#9898A2" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" text-anchor="end">${pCores.length}P + ${eCores.length}E</text>

  ${coreNodes.join("\n")}
</svg>
  `.trim();

  return svgToDataUri(svg);
}

export function generateStackedBar(
  slices: { label: string; value: number; color: string; formatted?: string }[],
  total: number,
  title: string,
  width = 760,
  height = 90,
): string {
  const isCompact = width <= 400 || height >= 140;
  const padding = 16;
  const barY = isCompact ? 40 : 34;
  const barHeight = isCompact ? 16 : 14;
  const availWidth = width - padding * 2;

  let currentX = padding;
  const rects: string[] = [];
  const legendItems: string[] = [];

  const validTotal = total > 0 ? total : 1;

  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const sliceWidth = Math.max(s.value > 0 ? 2 : 0, (s.value / validTotal) * availWidth);
    if (sliceWidth > 0) {
      rects.push(`<rect x="${currentX}" y="${barY}" width="${sliceWidth}" height="${barHeight}" fill="${s.color}"/>`);
      currentX += sliceWidth;
    }
  }

  if (isCompact) {
    const colWidth = Math.floor(availWidth / 2);
    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const lx = padding + col * (colWidth + 8);
      const ly = 74 + row * 30;
      const displayVal = s.formatted || formatBytes(s.value);
      legendItems.push(`
        <circle cx="${lx + 4}" cy="${ly + 4}" r="3.5" fill="${s.color}"/>
        <text x="${lx + 14}" y="${ly + 6}" fill="#9898A2" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11">${escapeXml(s.label)}</text>
        <text x="${lx + 14}" y="${ly + 20}" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">${escapeXml(displayVal)}</text>
      `);
    }
  } else {
    const legendY = 68;
    const itemWidth = availWidth / Math.min(6, slices.length);

    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      const lx = padding + i * itemWidth;
      const displayVal = s.formatted || formatBytes(s.value);
      legendItems.push(`
        <circle cx="${lx + 4}" cy="${legendY - 3}" r="3.5" fill="${s.color}"/>
        <text x="${lx + 12}" y="${legendY}" fill="#9898A2" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10">${escapeXml(s.label)}</text>
        <text x="${lx + 12}" y="${legendY + 12}" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="600">${escapeXml(displayVal)}</text>
      `);
    }
  }

  const clipId = `barClip_${title.replace(/[^a-zA-Z0-9]/g, "_")}`;

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="10" fill="#161618" stroke="#28282C" stroke-width="1"/>
  
  <text x="16" y="24" fill="#E6E6EA" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600">${escapeXml(title)}</text>
  <text x="${width - 16}" y="24" fill="#787884" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" text-anchor="end">Total ${formatBytes(total)}</text>

  <!-- Segmented Track Background -->
  <clipPath id="${clipId}">
    <rect x="${padding}" y="${barY}" width="${availWidth}" height="${barHeight}" rx="4"/>
  </clipPath>

  <g clip-path="url(#${clipId})">
    <rect x="${padding}" y="${barY}" width="${availWidth}" height="${barHeight}" fill="#282830"/>
    ${rects.join("\n")}
  </g>

  <!-- Legend -->
  ${legendItems.join("\n")}
</svg>
  `.trim();

  return svgToDataUri(svg);
}
