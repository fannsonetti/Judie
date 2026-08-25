export type WidgetType =
  | "weather"
  | "lights"
  | "media"
  | "calendar"
  | "climate"
  | "purifier"
  | "quickControls"
  | "server"
  | "activity"
  | "timers"
  | "system"
  | "custom";

export type WidgetSize = "1x1" | "1x2" | "2x2";

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  page: number;
  size: WidgetSize;
  order: number;
  /** Grid column (0-based). When set with row, empty cells can remain empty. */
  col?: number;
  /** Grid row (0-based). */
  row?: number;
  customId?: string;
}

export interface SizeDims {
  cols: number;
  rows: number;
}

export const SIZE_DIMS: Record<WidgetSize, SizeDims> = {
  "1x1": { cols: 1, rows: 1 },
  "1x2": { cols: 2, rows: 1 },
  "2x2": { cols: 2, rows: 2 },
};

export const WIDGET_SUPPORTED_SIZES: Record<WidgetType, WidgetSize[]> = {
  activity: ["1x1", "1x2", "2x2"],
  calendar: ["1x1", "1x2", "2x2"],
  climate: ["1x1", "1x2"],
  lights: ["1x1", "1x2", "2x2"],
  media: ["1x1", "1x2", "2x2"],
  purifier: ["1x1", "1x2", "2x2"],
  quickControls: ["1x1", "1x2"],
  server: ["1x1", "1x2"],
  timers: ["1x1", "1x2"],
  system: ["1x1", "1x2", "2x2"],
  weather: ["1x1", "1x2", "2x2"],
  custom: ["1x1", "1x2", "2x2"],
};

export const WIDGET_LABELS: Record<WidgetType, string> = {
  weather: "Weather",
  lights: "Lights",
  media: "Media",
  calendar: "Calendar",
  climate: "Climate",
  purifier: "Air Purifier",
  quickControls: "Quick Controls",
  server: "Server Status",
  activity: "Activity",
  timers: "Timers",
  system: "System",
  custom: "Custom",
};

export const GRID_COLS = 6;
export const GRID_ROWS = 4;
export const MAX_PAGES = 6;

export interface PlacedWidget extends WidgetInstance {
  col: number;
  row: number;
}

export type ExpandableWidgetType = "weather" | "lights" | "media" | "purifier" | "calendar";
