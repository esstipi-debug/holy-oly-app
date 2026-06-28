import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MACROCYCLES, availableWeeksToComp, dnaForFamily, type Atleta, type Plan } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { BackButton } from "../../../ui/BackButton";
import { Toast } from "../../../ui/Toast";
import { MacroPeriodization } from "../../../ui/charts/MacroPeriodization";
import { LoadMeters } from "./LoadMeters";
import { MacroComposition } from "./MacroComposition";
import { MacroTypicalWeek } from "./MacroTypicalWeek";
import { hasTypicalWeek } from "./composition";
import { MacroTemplateMap } from "./MacroTemplateMap";
import { AssignSheet, type AssignComp } from "./AssignSheet";
import { levelLabel } from "./macroFilter";

const page: CSSProperties = {
  padding: "12px 14px 84px", color: "var(--wl-text)", background: "var(--wl-bg)",
  minHeight: "100vh", maxWidth: 390, margin: "0 auto",
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
const assignBtn: CSSProperties = {
  width: "100%", padding: 14, borderRadius: 14, border: 0, cursor: "pointer",
  background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15,
};

export function MacroDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(["macros", "domain"]);
  const [params] = useSearchParams();
  // Atleta del que vino el coach (drill-down → "Asignar macro" pasa `?atleta=`). Pre-selecciona el
  // sheet y se conserva al volver al catálogo, así no se pierde el contexto al elegir otro macro.
  const preselectAtletaId = params.get("atleta") ?? undefined;
  const catalogHref = preselectAtletaId ? `/coach/macros?atleta=${encodeURIComponent(preselectAtletaId)}` : "/coach/macros";
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
  if (!macro) return <Navigate to={catalogHref} replace />;
  const m = macro;
  const dna = dnaForFamily(macro.family);

  async function onAssign(plan: Plan, comp?: AssignComp): Promise<void> {
    // Las compes deben PERSISTIR antes de instanciar: el backend periodiza leyendo las compes
    // guardadas (verdad anclada a fecha) → setComps va ANTES que savePlan. Las semanas se DERIVAN
    // del startDate con availableWeeksToComp (modelo adaptativo: el plan arranca hoy y se ajusta).
    const existing = await repo.getComps(plan.atletaId);
    const recomputed = plan.startDate != null
      ? existing.map((c) => (c.date != null ? { ...c, week: availableWeeksToComp(plan.startDate!, c.date) } : c))
      : existing;
    const next = comp
      ? [...recomputed.filter((c) => !(c.date === comp.date && c.name === comp.name)), comp]
      : recomputed;
    await repo.setComps(plan.atletaId, next);
    await repo.savePlan(plan); // ahora instancia adaptativo con las compes ya persistidas
    setAssignOpen(false);
    setToast(t("mdAssignToast", { macro: t(`domain:macro.${m.id}.name`), athlete: athletes.find((a) => a.id === plan.atletaId)?.nombre ?? t("mdAssignToastFallback") }));
    window.setTimeout(() => setToast(null), 2800);
  }

  // Mismo CTA arriba (al entrar al macro, sin scrollear) y abajo (tras leer el detalle).
  const cta = (marginTop: number) => (
    <button type="button" onClick={() => setAssignOpen(true)} style={{ ...assignBtn, marginTop }}>
      {t("mdAssignCta")}
    </button>
  );

  return (
    <div style={page}>
      <BackButton onClick={() => navigate(catalogHref)} />

      <h1 style={titleStyle}>{t(`domain:macro.${macro.id}.name`)}</h1>
      <div style={tagsRow}>
        <span style={famTag}>{t(`domain:school.${macro.family}.name`)}</span>
        <span style={lvTag}>{levelLabel(macro.level)}</span>
        {macro.peaks && macro.peakWeek != null
          ? <span style={pkTag}>{t("mdPeakWeek", { week: macro.peakWeek })}</span>
          : <span style={lvTag}>{t("mdNoPeak")}</span>}
      </div>
      <p style={descStyle}>{t(`domain:macro.${macro.id}.desc`)}</p>

      {cta(16)}

      {dna != null && (
        <>
          <div style={sec}>{t("mdSecMethod")}</div>
          <div style={{ background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "12px 13px", border: "1px solid color-mix(in srgb,var(--wl-accent) 18%,transparent)" }}>
            <p style={{ fontFamily: "var(--wl-display)", fontSize: 13, lineHeight: 1.5, color: "var(--wl-text)", margin: 0, fontStyle: "italic" }}>
              &ldquo;{t(`domain:school.${dna.family}.character`)}&rdquo;
            </p>
            {dna.sources.length > 0 && (
              <p style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", margin: "8px 0 0", lineHeight: 1.45 }}>
                {dna.sources.slice(0, 2).join(" · ")}
              </p>
            )}
          </div>
        </>
      )}

      {dna != null && (
        <>
          <div style={sec}>{t("mdSecComposition")}</div>
          <MacroComposition dna={dna} />
        </>
      )}

      {hasTypicalWeek(macro) && (
        <>
          <div style={sec}>{t("mdSecTypicalWeek")}</div>
          <MacroTypicalWeek macro={macro} />
        </>
      )}

      <div style={statsRow}>
        <div style={statBox}><b style={statN}>{macro.duration.replace(/\s*semanas?/i, "")}</b><span style={statL}>{t("mdStatWeeks")}</span></div>
        <div style={statBox}><b style={statN}>{macro.frequency.replace(/d\/sem/i, "")}</b><span style={statL}>{t("mdStatDays")}</span></div>
        <div style={statBox}><b style={statN}>{macro.phaseProfile.length}</b><span style={statL}>{t("mdStatPhases")}</span></div>
      </div>

      <div style={sec}>{t("mdSecLoad")}</div>
      <LoadMeters macro={macro} />

      <MacroPeriodization macro={macro} />

      <div style={sec}>{t("mdSecInside")}</div>
      <MacroTemplateMap macro={macro} />

      <div style={sec}>{t("mdSecBestFor")}</div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--wl-text)", margin: 0 }}>{t(`domain:macro.${macro.id}.bestFor`)}</p>

      {cta(20)}

      <AssignSheet open={assignOpen} onClose={() => setAssignOpen(false)} macro={macro} athletes={athletes} onAssign={onAssign}
        rosterError={rosterError} onRetryRoster={() => setRosterReload((r) => r + 1)} preselectAtletaId={preselectAtletaId} />
      <Toast message={toast ?? ""} show={toast != null} />
    </div>
  );
}
