/**
 * Mi Progreso · mapa de calor de calendario por señal (port del mock 0110). Ventanas Año/Macro/12
 * sem, detalle al tocar el día y diamante de competencia. Lee MeHeatDays (datos REALES por día) +
 * el HeatSpec de la señal (nivel/valor/leyenda). Presentacional puro. NUNCA muestra RPE.
 */
import { useState, useMemo, useCallback, useEffect, type CSSProperties } from "react";
import type { MeHeatDays, HeatWeekRow, HeatDayCell } from "@holy-oly/core";
import { heatSpecFor, type SignalKey } from "./heatSpecs";
import "./heatmap.css";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DOW_LABELS = ["", "lun", "", "mié", "", "vie", ""]; // como GitHub: filas alternas (lunes-first)
const STORAGE = "ho:heat-window";

const monthOf = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCMonth();
function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MES[d.getUTCMonth()]}`;
}

interface WinDef { key: string; label: string }
// dimensiones por ventana: [gap px, alto banda meses px, alto/ancho de celda px]
const DIMS: Record<string, { gap: number; monh: number; cell: number }> = {
  ano: { gap: 1.6, monh: 13, cell: 3.8 },
  macro: { gap: 3.2, monh: 14, cell: 14.5 },
  "12": { gap: 4, monh: 14, cell: 20 },
};

function MonthLabels({ weeks }: { weeks: HeatWeekRow[] }) {
  const marks: { i: number; m: number }[] = [];
  let prev = -1;
  weeks.forEach((wk, i) => {
    const m = monthOf(wk.startIso);
    if (m !== prev) { marks.push({ i, m }); prev = m; }
  });
  const n = weeks.length || 1;
  return (
    <div className="hm-months">
      {marks.map((mk, k) => {
        if (k > 0 && mk.i - marks[k - 1]!.i < 2) return null; // evita pisar etiquetas en vistas anchas
        return <span key={k} className="hm-month" style={{ left: `${(mk.i / n) * 100}%` }}>{MES[mk.m]}</span>;
      })}
    </div>
  );
}

export function SignalHeat({ data, signal, active = true }: { data: MeHeatDays; signal: SignalKey; active?: boolean }) {
  const spec = useMemo(() => heatSpecFor(signal, data), [signal, data]);
  const windows = useMemo<WinDef[]>(() => {
    const w: WinDef[] = [{ key: "ano", label: "Año" }];
    if (data.macroFromIdx >= 0) w.push({ key: "macro", label: "Macro" });
    w.push({ key: "12", label: "12 sem" });
    return w;
  }, [data.macroFromIdx]);
  const defaultWin = data.macroFromIdx >= 0 ? "macro" : "12";

  const [win, setWin] = useState<string>(() => {
    try { const v = localStorage.getItem(STORAGE); if (v && DIMS[v]) return v; } catch { /* noop */ }
    return defaultWin;
  });
  // la ventana elegida puede no existir para este atleta (p.ej. "macro" sin macro) → cae al default
  const winKey = windows.some((w) => w.key === win) ? win : defaultWin;
  const [selIso, setSelIso] = useState<string | null>(null);

  const weeks = useMemo<HeatWeekRow[]>(() => {
    const all = data.weeks;
    if (winKey === "macro" && data.macroFromIdx >= 0) return all.slice(data.macroFromIdx, data.macroToIdx + 1);
    if (winKey === "12") return all.slice(Math.max(0, all.length - 12));
    return all;
  }, [data, winKey]);

  const chooseWin = useCallback((k: string) => {
    setWin(k);
    try { localStorage.setItem(STORAGE, k); } catch { /* noop */ }
  }, []);

  const sel = useMemo<HeatDayCell | null>(() => {
    if (!selIso) return null;
    for (const wk of weeks) {
      const d = wk.days.find((x) => x.iso === selIso);
      if (d) return d;
    }
    return null;
  }, [selIso, weeks]);
  useEffect(() => { if (selIso && !sel) setSelIso(null); }, [selIso, sel]);

  const dims = DIMS[winKey] ?? DIMS["12"]!;
  const styleVars = { "--hm-gap": `${dims.gap}px`, "--hm-monh": `${dims.monh}px`, "--hm-cell": `${dims.cell}px` } as CSSProperties;
  const allCells = useMemo(() => weeks.flatMap((w) => w.days), [weeks]);

  return (
    <div className="hm">
      <div className="hm-windows" role="tablist" aria-label="Ventana de tiempo">
        {windows.map((w) => (
          <button key={w.key} type="button" role="tab" aria-selected={winKey === w.key}
            className={"hm-win" + (winKey === w.key ? " is-on" : "")} onClick={() => chooseWin(w.key)}>{w.label}</button>
        ))}
      </div>

      <div className={"hm-cal" + (active ? " is-draw" : "")} key={winKey} style={styleVars}>
        <div className="hm-dows" aria-hidden>
          {DOW_LABELS.map((d, i) => <span key={i} className="hm-dow">{d}</span>)}
        </div>
        <div className="hm-main">
          <MonthLabels weeks={weeks} />
          <div className="hm-grid">
            {weeks.map((wk, wi) => (
              <div key={wi} className="hm-col">
                {wk.days.map((day) => {
                  const lv = spec.level(day);
                  const isSel = day.iso === selIso;
                  const cls = "hm-cell"
                    + (lv < 0 ? " is-future" : " l" + lv)
                    + (day.comp ? " is-comp" : "")
                    + (day.today ? " is-today" : "")
                    + (isSel ? " is-sel" : "");
                  const clickable = lv >= 0 || day.comp != null;
                  return (
                    <button key={day.iso} type="button" className={cls}
                      aria-label={`${fmtDate(day.iso)}${day.comp ? ` · ${day.comp.name}` : ""}`}
                      onClick={clickable ? () => setSelIso(isSel ? null : day.iso) : undefined}
                      tabIndex={clickable ? 0 : -1} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hm-legend">
        <span>{spec.legendLo}</span>
        <span className="hm-scale">{[0, 1, 2, 3, 4].map((l) => <span key={l} className={"hm-swatch l" + l} />)}</span>
        <span>{spec.legendHi}</span>
        <span className="hm-legend__comp"><span className="hm-legend__diam" />competencia</span>
      </div>

      <div className={"hm-detail" + (sel?.comp ? " is-comp" : "")} key={selIso ?? "none"}>
        {sel ? (
          <>
            <div className="hm-detail__date">{fmtDate(sel.iso)}{sel.today ? " · hoy" : ""}</div>
            <div className="hm-detail__val">{spec.value(sel)}</div>
            {sel.comp && <div className="hm-detail__comp">{sel.comp.name} · {sel.comp.note}</div>}
          </>
        ) : (
          <div className="hm-detail__hint">{spec.summary(allCells)}</div>
        )}
      </div>
    </div>
  );
}
