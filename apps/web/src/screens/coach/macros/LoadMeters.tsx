import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Macrocycle } from "@holy-oly/core";
import { deriveRecovery } from "./macroFilter";

const label: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 8, letterSpacing: ".3px", color: "var(--wl-muted)", width: 64, flexShrink: 0,
};
const value: CSSProperties = { fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", flexShrink: 0 };

// paleta de atributos de plantilla — deliberadamente DISTINTA del semáforo (rulebook §4: color=estado):
// tonos vecinos pero NO los tokens --ok/--warn/--alert, para que un meter de plantilla jamás se lea como estado.
const METER = { intensidad: "#e05656", volumen: "#2dd4e6", recuperacion: "#4caf78" } as const;

function Meter({ name, val, color }: { name: string; val: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 12, marginBottom: 5 }}>
      <span style={label}>{name}</span>
      <span style={{ display: "flex", gap: 2.5, flex: 1 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} style={{
            width: 7, height: 7, borderRadius: 1.5,
            background: i < val ? color : "rgba(127,134,148,.18)",
            boxShadow: i < val ? `0 0 5px color-mix(in srgb, ${color} 40%, transparent)` : "none",
          }} />
        ))}
      </span>
      <span style={value}>{val}/5</span>
    </div>
  );
}

/** The three load meters (intensity, volume, derived recovery) — ports the mockup's `meter` row. */
export function LoadMeters({ macro }: { macro: Macrocycle }) {
  const { t } = useTranslation("macros");
  return (
    <div>
      <Meter name={t("lmIntensity")} val={macro.intensity} color={METER.intensidad} />
      <Meter name={t("lmVolume")} val={macro.volume} color={METER.volumen} />
      <Meter name={t("lmRecovery")} val={deriveRecovery(macro)} color={METER.recuperacion} />
    </div>
  );
}
