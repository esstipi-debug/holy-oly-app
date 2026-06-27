import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { weekOfDate, dateOfWeek, type Competencia } from "@holy-oly/core";
import { BottomSheet } from "../../ui/BottomSheet";

const input: CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-surface)",
  color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 15,
};
const label: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
  color: "var(--wl-muted)", marginTop: 12, display: "block",
};

/** Coach assigns/removes the athlete's target competitions BY DATE; the picked date is placed on
 *  the macro week (via the plan's startDate) and reshapes the timeline (volume taper toward it). */
export function CompSheet({
  open, onClose, comps, startDate, totalWeeks, onAdd, onRemove,
}: {
  open: boolean;
  onClose: () => void;
  comps: Competencia[];
  startDate: string;      // ISO date of macro week 1 for this athlete
  totalWeeks: number;     // macro duration
  onAdd: (name: string, date: string) => Promise<void>;
  onRemove: (index: number) => Promise<void>;
}) {
  const { t } = useTranslation("coach");
  const nextName = `COMP ${String.fromCharCode(65 + comps.length)}`;
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => dateOfWeek(startDate, totalWeeks)); // default: the last week (peak)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const week = weekOfDate(startDate, date, totalWeeks);
  const minDate = dateOfWeek(startDate, 1);
  const maxDate = dateOfWeek(startDate, totalWeeks);

  async function run(fn: () => Promise<void>): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("compSaveError"));
    } finally {
      setBusy(false);
    }
  }

  const sorted = comps.map((c, i) => ({ c, i })).sort((a, b) => a.c.week - b.c.week);
  const show = (c: Competencia): string => (c.date ? c.date : t("compWeekLabel", { week: c.week }));

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t("compsAria")}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>{t("compsTitle")}</div>

      <label style={label}>{t("compsAssigned")}</label>
      {sorted.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 6 }}>{t("compsNone")}</div>
      ) : (
        sorted.map(({ c, i }) => (
          <div key={`${c.week}-${c.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
            <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: "var(--wl-text)" }}>🚩 {c.name} · {show(c)}</span>
            {/* Hit-area 44px (padding transparente, margen negativo lo cancela en el layout); el ✕ visible sigue 26px. */}
            <button type="button" aria-label={t("compRemove")} disabled={busy} onClick={() => void run(() => onRemove(i))}
              style={{ width: 44, height: 44, padding: 9, margin: -9, border: 0, background: "transparent", color: "var(--wl-muted)", cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</span>
            </button>
          </div>
        ))
      )}

      <label style={label}>{t("compsAdd")}</label>
      <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={nextName} />

      <label style={label}>{t("compDateLabel")}</label>
      <input type="date" aria-label={t("compDateLabel")} style={input} value={date} min={minDate} max={maxDate}
        onChange={(e) => setDate(e.target.value)} />
      <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-accent)" }}>
        {t("compFallsPre")} <b>{t("compFallsWeek", { week })}</b> {t("compFallsPost", { total: totalWeeks })}
      </div>

      {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

      <button type="button" disabled={busy} onClick={() => void run(async () => { await onAdd(name || nextName, date); setName(""); })}
        style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, border: 0, cursor: busy ? "default" : "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, opacity: busy ? 0.6 : 1 }}>
        {busy ? "..." : t("compAddBtn")}
      </button>
      <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.5, color: "var(--wl-muted)" }}>
        <b style={{ color: "var(--wl-text)" }}>{t("compRestructureTitle")}</b> {t("compRestructureBody")}
      </div>
      <button type="button" onClick={onClose}
        style={{ width: "100%", marginTop: 10, padding: 10, border: 0, background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }}>
        {t("compDone")}
      </button>
    </BottomSheet>
  );
}
