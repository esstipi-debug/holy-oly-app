import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  type Atleta, type CompRole, type CompetitionDetailView,
  type CompetitionEntryInput, type CompetitionEntryView, type CompetitionInput,
} from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { RetryButton } from "../../../ui/RetryButton";
import { Loading } from "../../../ui/Loading";
import { SegmentedToggle } from "../../../ui/SegmentedToggle";
import { CompetitionFormSheet } from "./CompetitionFormSheet";
import { AcoplarSheet } from "./AcoplarSheet";
import { today, countdownLabel, type CountdownT } from "./utils";

function roleSub(e: CompetitionEntryView, t: CountdownT): string {
  if (e.role === "pico") return e.peakWeek != null ? t("roleSubPicoWeek", { week: e.peakWeek }) : t("roleSubPicoUnanchored");
  return t("roleSubPaso");
}

export function CompetitionDetail() {
  const { id = "" } = useParams();
  const repo = useRepository();
  const navigate = useNavigate();
  const { t } = useTranslation(["coach", "common"]);
  const roleOpts: readonly (readonly [CompRole, string])[] = [["pico", t("rolePico")], ["paso", t("rolePaso")]];
  const [detail, setDetail] = useState<CompetitionDetailView | undefined>(undefined);
  const [roster, setRoster] = useState<Atleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [showAcoplar, setShowAcoplar] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(false);
    Promise.all([repo.getCompetition(id), repo.getRoster()])
      .then(([d, r]) => { if (on) { setDetail(d); setRoster(r); setLoading(false); } })
      .catch(() => { if (on) { setError(true); setLoading(false); } });
    return () => { on = false; };
  }, [repo, id, reload]);

  async function run(fn: () => Promise<void>): Promise<void> {
    setActionErr(null); setBusy(true);
    try { await fn(); setReload((r) => r + 1); }
    catch (e) { setActionErr(e instanceof Error ? e.message : t("compSaveError")); }
    finally { setBusy(false); }
  }
  const onAcoplar = (entries: CompetitionEntryInput[]) =>
    run(async () => { await repo.acoplarAtletas(id, entries); setShowAcoplar(false); });
  const onChangeRole = (athleteId: string, role: CompRole) => {
    if (busy) return; // evita disparar otro cambio mientras uno está en vuelo
    void run(() => repo.acoplarAtletas(id, [{ athleteId, role }]));
  };
  const onDesacoplar = (athleteId: string) =>
    run(() => repo.desacoplarAtleta(id, athleteId));
  const onEdit = (input: CompetitionInput) =>
    run(async () => { await repo.updateCompetition(id, input); setShowEdit(false); });
  function onDelete(): void {
    if (!window.confirm(t("detailDeleteConfirm"))) return;
    void (async () => {
      setActionErr(null); setBusy(true);
      try { await repo.deleteCompetition(id); navigate("/coach/competencias"); }
      catch (e) { setActionErr(e instanceof Error ? e.message : t("detailDeleteError")); setBusy(false); }
    })();
  }

  if (loading) return <Shell><Loading style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "16px 0" }}>{t("common:loading")}</Loading></Shell>;
  if (error) return (
    <Shell>
      <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)", padding: "16px 0" }}>
        {t("detailLoadError")} <RetryButton onClick={() => setReload((r) => r + 1)} />
      </div>
    </Shell>
  );
  if (!detail) return (
    <Shell>
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)", padding: "16px 0" }}>
        {t("detailNotExist")} <Link to="/coach/competencias" style={{ color: "var(--wl-accent)" }}>{t("common:back")}</Link>
      </div>
    </Shell>
  );

  const yaAcoplados = new Set(detail.entries.map((e) => e.athleteId));

  return (
    <Shell>
      <Link to="/coach/competencias" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", textDecoration: "none" }}>{t("backToComps")}</Link>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
        <h1 style={{ margin: 0, fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 23, letterSpacing: -.4 }}>{detail.name}</h1>
        <button type="button" aria-label={t("formEdit")} onClick={() => setShowEdit(true)}
          style={{ flex: "0 0 auto", marginTop: 3, padding: "6px 11px", borderRadius: 9, border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent", color: "var(--wl-muted)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" }}>
          {t("editShort")}
        </button>
      </div>
      <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--wl-muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span>{detail.date}</span>
        {detail.place && <span>{detail.place}</span>}
        <span style={{ color: detail.date < today() ? "var(--wl-muted)" : "var(--wl-accent)" }}>{countdownLabel(detail.date, t)}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 6px" }}>
        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, letterSpacing: 1, color: "var(--wl-muted)", textTransform: "uppercase" }}>
          {t("attachedCount", { count: detail.entries.length })}
        </span>
        <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
      </div>

      {detail.entries.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--wl-muted)", padding: "8px 0 4px" }}>
          {t("detailEmptyEntries")}
        </div>
      ) : (
        detail.entries.map((e) => (
          <div key={e.athleteId} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderTop: "1px solid color-mix(in srgb,var(--wl-text) 7%,transparent)" }}>
            <div aria-hidden style={{ width: 34, height: 34, flex: "0 0 auto", borderRadius: "50%", background: "var(--wl-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 12, color: "var(--wl-text)" }}>{e.iniciales}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)" }}>{e.nombre}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: e.role === "pico" ? "var(--wl-accent)" : "var(--wl-muted)" }}>{roleSub(e, t)}</div>
            </div>
            <SegmentedToggle ariaLabel={t("roleAria", { name: e.nombre })} size="sm" options={roleOpts} value={e.role} onChange={(r) => void onChangeRole(e.athleteId, r)} />
            <button type="button" aria-label={t("desacoplarAria", { name: e.nombre })} disabled={busy} onClick={() => void onDesacoplar(e.athleteId)}
              style={{ width: 32, height: 32, flex: "0 0 auto", padding: 0, border: 0, background: "transparent", color: "var(--wl-muted)", cursor: busy ? "default" : "pointer", fontSize: 16 }}>
              ✕
            </button>
          </div>
        ))
      )}

      {actionErr && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{actionErr}</div>}

      <button type="button" onClick={() => setShowAcoplar(true)}
        style={{ width: "100%", marginTop: 18, padding: 12, borderRadius: 12, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        {t("addAthletes")}
      </button>
      <button type="button" onClick={onDelete} disabled={busy}
        style={{ width: "100%", marginTop: 10, padding: 10, border: 0, background: "transparent", color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11.5, cursor: busy ? "default" : "pointer" }}>
        {t("deleteComp")}
      </button>

      {showAcoplar && <AcoplarSheet open onClose={() => setShowAcoplar(false)} roster={roster} yaAcoplados={yaAcoplados} onAcoplar={onAcoplar} />}
      {showEdit && <CompetitionFormSheet open onClose={() => setShowEdit(false)} initial={{ name: detail.name, date: detail.date, place: detail.place }} onSubmit={onEdit} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "14px 18px 26px", color: "var(--wl-text)", minHeight: "100vh", maxWidth: 390, margin: "0 auto" }}>{children}</div>;
}
