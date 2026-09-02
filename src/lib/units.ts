export type UnitsPresetId = "c-km" | "f-mi" | "k-fur";

export type UnitsFields = {
  tempUnit: "c" | "f" | "k";
  distanceUnit: "km" | "mi" | "fur";
  units: "metric" | "imperial";
};

export const UNITS_PRESETS: { id: UnitsPresetId; label: string }[] = [
  { id: "c-km", label: "Celsius and kilometres" },
  { id: "f-mi", label: "Fahrenheit and miles" },
  { id: "k-fur", label: "Kelvin and furlongs" },
];

export function applyUnitsPreset(id: UnitsPresetId): UnitsFields {
  if (id === "f-mi") return { tempUnit: "f", distanceUnit: "mi", units: "imperial" };
  if (id === "k-fur") return { tempUnit: "k", distanceUnit: "fur", units: "metric" };
  return { tempUnit: "c", distanceUnit: "km", units: "metric" };
}

/** Map stored temp/distance/units (including old split choices) onto one preset. */
export function migrateUnitsPreset(
  tempUnit?: string,
  distanceUnit?: string,
  units?: string,
): UnitsPresetId {
  const t = (tempUnit ?? "").toLowerCase();
  const d = (distanceUnit ?? "").toLowerCase();
  const u = (units ?? "").toLowerCase();
  if ((t === "c" || t === "celsius") && (d === "km" || d === "kilometres" || d === "kilometers")) {
    return "c-km";
  }
  if ((t === "f" || t === "fahrenheit") && (d === "mi" || d === "mile" || d === "miles")) {
    return "f-mi";
  }
  if ((t === "k" || t === "kelvin") && (d === "fur" || d === "furlong" || d === "furlongs")) {
    return "k-fur";
  }
  if (t === "f" || t === "fahrenheit") return "f-mi";
  if (t === "k" || t === "kelvin") return "k-fur";
  if (t === "c" || t === "celsius") return "c-km";
  if (d === "mi" || d === "nm" || d === "mile" || d === "miles" || d === "nautical") return "f-mi";
  if (d === "fur" || d === "furlong" || d === "furlongs") return "k-fur";
  if (u === "imperial") return "f-mi";
  return "c-km";
}

export function unitsPresetFromConfig(cfg: {
  tempUnit?: string;
  distanceUnit?: string;
  units?: string;
}): UnitsPresetId {
  return migrateUnitsPreset(cfg.tempUnit, cfg.distanceUnit, cfg.units);
}
