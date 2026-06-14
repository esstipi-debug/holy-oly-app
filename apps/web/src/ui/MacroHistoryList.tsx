import type { MacroHistoryEntry, MacroHistoryView } from "@holy-oly/core";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Rango de fechas legible: "ene–abr 2025" (mismo año) o "nov 2024 – feb 2025" (cruza año). */
function formatRange(startIso: string, endIso: string): string {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  const sm = MESES[s.getUTCMonth()] ?? "";
  const em = MESES[e.getUTCMonth()] ?? "";
  const sy = s.getUTCFullYear();
  const ey = e.getUTCFullYear();
  return sy === ey ? `${sm}–${em} ${ey}` : `${sm} ${sy} – ${em} ${ey}`;
}

/** Pastilla de adherencia: el % con una barra de progreso en dorado (identidad), NO el semáforo
 *  de readiness — la constancia es otra señal. Sin dato → no se inventa. */
function AdherenceChip({ pct }: { pct: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 56 }}>
      <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 19, lineHeight: 1, color: "var(--wl-text)" }}>
        {pct}<span style={{ fontSize: 11, color: "var(--wl-muted)" }}>%</span>
      </span>
      <div style={{ width: 52, height: 4, borderRadius: 2, background: "color-mix(in srgb, var(--wl-text) 12%, transparent)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--wl-accent)" }} />
      </div>
    </div>
  );
}

function CycleRow({ entry, audience }: { entry: MacroHistoryEntry; audience: "coach" | "atleta" }) {
  const rm = entry.rmEnd;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "11px 0", borderTop: "1px solid color-mix(in srgb, var(--wl-text) 8%, transparent)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--wl-cond, var(--wl-display))", fontWeight: 700, fontSize: 14, letterSpacing: .2, color: "var(--wl-text)" }}>
          {entry.macroName}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 3 }}>
          {formatRange(entry.startDate, entry.endDate)} · {entry.weeks} sem · {entry.sessionsDone}/{entry.sessionsTotal} sesiones
        </div>
        {/* RM al cierre: COACH-only (HR-1: el atleta jamás ve RMs en superficie). */}
        {audience === "coach" && rm && (
          <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 4, opacity: .85 }}>
            RM cierre · arr {rm.arranque} · env {rm.envion} · sent {rm.sentadilla} · fr {rm.frente}
          </div>
        )}
      </div>
      <AdherenceChip pct={entry.adherencePct} />
    </div>
  );
}

type Props = {
  view: MacroHistoryView;
  /** "coach" muestra RM de cierre; "atleta" jamás (HR-1). */
  audience: "coach" | "atleta";
  /** Título de la tarjeta. */
  title?: string;
};

/** Lista presentacional del historial de ciclos cerrados. Sin fetch — el contenedor pasa la vista.
 *  Reusada por el drill-down del coach y por "Progreso" del atleta (audience cambia qué se muestra). */
export function MacroHistoryList({ view, audience, title = "Historial de ciclos" }: Props) {
  if (view.cyclesDone === 0) {
    return (
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
        Sin ciclos cerrados todavía.
      </div>
    );
  }
  const cyclesLabel = view.cyclesDone === 1 ? "1 ciclo" : `${view.cyclesDone} ciclos`;
  return (
    <section
      aria-label={title}
      style={{ borderRadius: 16, padding: "14px 15px", background: "linear-gradient(158deg, var(--wl-surface-2) 0%, var(--wl-surface) 60%, var(--wl-bg) 100%)", border: "1px solid rgba(255,255,255,.08)" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, letterSpacing: .8, textTransform: "uppercase", color: "var(--wl-muted)" }}>
          {title}
        </h3>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>
          {cyclesLabel} · {view.avgAdherencePct}% adherencia
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        {view.entries.map((e) => (
          <CycleRow key={e.ordinal} entry={e} audience={audience} />
        ))}
      </div>
    </section>
  );
}
