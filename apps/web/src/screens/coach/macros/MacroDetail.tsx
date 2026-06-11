import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { MACROCYCLES, weekOfDate, type Atleta, type Plan } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { MacroPeriodization } from "../../../ui/charts/MacroPeriodization";
import { LoadMeters } from "./LoadMeters";
import { MacroTemplateMap } from "./MacroTemplateMap";
import { AssignSheet, type AssignComp } from "./AssignSheet";
import { levelLabel } from "./macroFilter";

const page: CSSProperties = {
  padding: "12px 14px 84px", color: "var(--wl-text)", background: "var(--wl-bg)",
  minHeight: "100vh", maxWidth: 390, margin: "0 auto",
};
const back: CSSProperties = {
  width: 34, height: 34, borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 15%,transparent)",
  background: "var(--wl-surface)", color: "var(--wl-text)", fontSize: 19, lineHeight: 1, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 25, lineHeight: 1, textTransform: "uppercase",
  color: "var(--wl-text)", margin: "12px 0 0",
};
const tagsRow: CSSProperties = { display: "flex", gap: 8, margin: "11px 0 0", flexWrap: "wrap", alignItems: "center" };
const tagBase: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 99,
};
const famTag: CSSProperties = { ...tagBase, background: "color-mix(in srgb,var(--wl-accent) 16%,transparent)", color: "var(--wl-accent)" };
const lvTag: CSSProperties = { ...tagBase, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", color: "var(--wl-muted)" };
const pkTag: CSSProperties = { ...tagBase, background: "color-mix(in srgb,var(--wl-accent) 12%,transparent)", color: "var(--wl-accent)", fontWeight: 700 };
const descStyle: CSSProperties = { fontSize: 12.5, lineHeight: 1.55, color: "var(--wl-muted)", margin: "14px 0 0" };
const statsRow: CSSProperties = { display: "flex", gap: 9, margin: "16px 0 4px" };
const statBox: CSSProperties = { flex: 1, background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "10px 8px", textAlign: "center" };
const statN: CSSProperties = { fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)", display: "block" };
const statL: CSSProperties = { fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--wl-muted)" };
const sec: CSSProperties = {
  fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase",
  color: "var(--wl-muted)", margin: "22px 0 10px",
};

export function MacroDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const repo = useRepository();
  const [assignOpen, setAssignOpen] = useState(false);
  const [athletes, setAthletes] = useState<Atleta[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  // Error ≠ vacío (D5): si el roster falla, el sheet NO puede decir "No tenés atletas vinculados".
  const [rosterError, setRosterError] = useState(false);
  const [rosterReload, setRosterReload] = useState(0);
  useEffect(() => {
    let on = true;
    setRosterError(false);
    repo.getRoster()
      .then((r) => { if (on) setAthletes(r); })
      .catch(() => { if (on) setRosterError(true); });
    return () => { on = false; };
  }, [repo, rosterReload]);

  const macro = MACROCYCLES.find((m) => m.id === id);
  if (!macro) return <Navigate to="/coach/macros" replace />;
  const m = macro;

  async function onAssign(plan: Plan, comp?: AssignComp): Promise<void> {
    await repo.savePlan(plan); // throws propagate to the sheet's submit handler
    // Las semanas de las comps se DERIVAN del startDate: al (re)anclar el plan hay que
    // recalcularlas (si no quedan desincronizadas), y la asignación por competencia crea la
    // suya — timeline, calendario-mapa y taper la ven al instante.
    const totalWeeks = m.phaseProfile[m.phaseProfile.length - 1]?.weeks[1] ?? 0;
    const existing = await repo.getComps(plan.atletaId);
    const recomputed = plan.startDate != null && totalWeeks > 0
      ? existing.map((c) => (c.date != null ? { ...c, week: weekOfDate(plan.startDate!, c.date, totalWeeks) } : c))
      : existing;
    const next = comp
      ? [...recomputed.filter((c) => !(c.date === comp.date && c.name === comp.name)), comp]
      : recomputed;
    await repo.setComps(plan.atletaId, next);
    setAssignOpen(false);
    setToast(`✓ ${m.name} asignado a ${athletes.find((a) => a.id === plan.atletaId)?.nombre ?? "el atleta"}`);
    window.setTimeout(() => setToast(null), 2800);
  }

  return (
    <div style={page}>
      <button type="button" aria-label="volver" style={back} onClick={() => navigate("/coach/macros")}>‹</button>

      <h1 style={titleStyle}>{macro.name}</h1>
      <div style={tagsRow}>
        <span style={famTag}>{macro.family}</span>
        <span style={lvTag}>{levelLabel(macro.level)}</span>
        {macro.peaks && macro.peakWeek != null
          ? <span style={pkTag}>▲ pico sem {macro.peakWeek}</span>
          : <span style={lvTag}>sin pico</span>}
      </div>
      <p style={descStyle}>{macro.desc}</p>

      <div style={statsRow}>
        <div style={statBox}><b style={statN}>{macro.duration.replace(/\s*semanas?/i, "")}</b><span style={statL}>semanas</span></div>
        <div style={statBox}><b style={statN}>{macro.frequency.replace(/d\/sem/i, "")}</b><span style={statL}>días/sem</span></div>
        <div style={statBox}><b style={statN}>{macro.phaseProfile.length}</b><span style={statL}>fases</span></div>
      </div>

      <div style={sec}>Carga</div>
      <LoadMeters macro={macro} />

      <MacroPeriodization macro={macro} />

      <div style={sec}>Adentro del plan · intensidad por día</div>
      <MacroTemplateMap macro={macro} />

      <div style={sec}>Ideal para</div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--wl-text)", margin: 0 }}>{macro.bestFor}</p>

      <button type="button" onClick={() => setAssignOpen(true)}
        style={{ width: "100%", marginTop: 20, padding: 14, borderRadius: 14, border: 0, cursor: "pointer",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15 }}>
        + Asignar a un atleta
      </button>

      <AssignSheet open={assignOpen} onClose={() => setAssignOpen(false)} macro={macro} athletes={athletes} onAssign={onAssign}
        rosterError={rosterError} onRetryRoster={() => setRosterReload((r) => r + 1)} />
      {toast && (
        <div role="status" style={{
          position: "fixed", left: 14, right: 14, bottom: 78, zIndex: 40, maxWidth: 362, margin: "0 auto",
          background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13,
          padding: "13px 16px", borderRadius: 12, textAlign: "center", boxShadow: "0 14px 40px -12px rgba(0,0,0,.7)",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
