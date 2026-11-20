/**
 * Labels and colors for the four workload categories (AI, display, media, other).
 */

import { Color } from "@raycast/api";
import { WorkloadCategory } from "../data/types";

/** The categories in display order. */
export const WORKLOAD_CATEGORIES: WorkloadCategory[] = ["aiMl", "displayUi", "media", "other"];

export function workloadLabel(category: WorkloadCategory): string {
  switch (category) {
    case "aiMl":
      return "AI & ML";
    case "displayUi":
      return "Display & UI";
    case "media":
      return "Media";
    case "other":
      return "General App";
  }
}

/** Tag color used in list rows and detail panels. */
export function workloadColor(category: WorkloadCategory): Color {
  switch (category) {
    case "aiMl":
      return Color.Purple;
    case "displayUi":
      return Color.Blue;
    case "media":
      return Color.Orange;
    case "other":
      return Color.SecondaryText;
  }
}

/** Hex color used by the SVG breakdown bars, matching the tag colors above. */
export function workloadHexColor(category: WorkloadCategory): string {
  switch (category) {
    case "aiMl":
      return "#BF5AF2";
    case "displayUi":
      return "#0A84FF";
    case "media":
      return "#FF9F0A";
    case "other":
      return "#8E8E93";
  }
}
