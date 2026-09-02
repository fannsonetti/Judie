import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_INSTALLATION, InstallationConfig } from "../lib/config";
import { applyUnitsPreset, migrateUnitsPreset } from "../lib/units";

interface SettingsState extends InstallationConfig {
  update: (patch: Partial<InstallationConfig>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_INSTALLATION,
      update: (patch) => set(patch),
      reset: () => set(DEFAULT_INSTALLATION),
    }),
    {
      name: "judie-settings",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<InstallationConfig>;
        const units = applyUnitsPreset(
          migrateUnitsPreset(
            p.tempUnit ?? current.tempUnit,
            p.distanceUnit ?? current.distanceUnit,
            p.units ?? current.units,
          ),
        );
        return {
          ...current,
          ...p,
          lockAspect1610: p.lockAspect1610 ?? false,
          ...units,
          preferredNet: p.preferredNet ?? current.preferredNet,
          dhcp: p.dhcp ?? current.dhcp,
          proactive: { ...DEFAULT_INSTALLATION.proactive, ...p.proactive },
        };
      },
    }
  )
);
