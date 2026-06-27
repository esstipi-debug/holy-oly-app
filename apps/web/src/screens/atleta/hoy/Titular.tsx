import { useTranslation, Trans } from "react-i18next";
import type { CellState } from "@holy-oly/core";
import { STATUS } from "../../../ui/status";

// Color = estado (the ONLY place color = estado on Hoy) — derivado de la paleta oficial ui/status.ts.
const ST: Record<"ok" | "warn" | "alert", string> = { ok: STATUS.ok, warn: STATUS.warn, alert: STATUS.alert };
const ST_KEY: Record<"ok" | "warn" | "alert", { st: string; msg: string }> = {
  ok: { st: "titularOkSt", msg: "titularOkMsg" },
  warn: { st: "titularWarnSt", msg: "titularWarnMsg" },
  alert: { st: "titularAlertSt", msg: "titularAlertMsg" },
};

/** Estado de hoy. `none` → honest empty variant (new athlete); never a false-green. */
export function Titular({ state }: { state: CellState }) {
  const { t } = useTranslation("atleta");
  if (state === "none") {
    return (
      <div className="ho-titular" style={{ background: "color-mix(in srgb, var(--wl-text) 5%, transparent)", borderColor: "color-mix(in srgb, var(--wl-text) 14%, transparent)" }}>
        <div className="ho-titular__row">
          <span className="ho-titular__dot" style={{ background: "color-mix(in srgb, var(--wl-text) 20%, transparent)" }} />
          <div>
            <div className="ho-titular__lbl">{t("titularLbl")}</div>
            <div className="ho-titular__st" style={{ color: "var(--wl-muted)" }}>{t("titularNoneSt")}</div>
          </div>
        </div>
        <p className="ho-titular__msg"><Trans t={t} i18nKey="titularNoneMsg" components={{ b: <b /> }} /></p>
      </div>
    );
  }
  const col = ST[state];
  const k = ST_KEY[state];
  return (
    <div className="ho-titular" style={{ background: `color-mix(in srgb, ${col} 14%, transparent)`, borderColor: `color-mix(in srgb, ${col} 45%, transparent)` }}>
      <div className="ho-titular__row">
        <span className="ho-titular__dot" style={{ background: col, boxShadow: `0 0 18px ${col}99` }} />
        <div>
          <div className="ho-titular__lbl">{t("titularLbl")}</div>
          <div className="ho-titular__st" style={{ color: col }}>{t(k.st)}</div>
        </div>
      </div>
      <p className="ho-titular__msg"><Trans t={t} i18nKey={k.msg} components={{ b: <b /> }} /></p>
    </div>
  );
}
