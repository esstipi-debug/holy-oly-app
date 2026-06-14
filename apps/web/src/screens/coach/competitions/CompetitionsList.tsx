import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { type CompetitionListItem, type CompetitionInput } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { RetryButton } from "../../../ui/RetryButton";
import { Loading } from "../../../ui/Loading";
import { CompetitionFormSheet } from "./CompetitionFormSheet";
import { today, countdownLabel } from "./utils";

/** Catálogo de competencias del coach (slice 2026-06-14): crear una vez, acoplar atletas. */
export function CompetitionsList() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [items, setItems] = useState<CompetitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(false);
    repo.getCompetitions()
      .then((r) => { if (on) { setItems(r); setLoading(false); } })
      .catch(() => { if (on) { setError(true); setLoading(false); } });
    return () => { on = false; };
  }, [repo, reload]);

  const t = today();
  const proximas = items.filter((c) => c.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const pasadas = items.filter((c) => c.date < t).sort((a, b) => b.date.localeCompare(a.date));

  async function onCreate(input: CompetitionInput): Promise<void> {
    const c = await repo.createCompetition(input);
    setShowNew(false);
    navigate(`/coach/competencias/${c.id}`);
  }

  const card = (c: CompetitionListItem) => (
    <button key={c.id} type="button" onClick={() => navigate(`/coach/competencias/${c.id}`)}
      style={{ width: "100%", textAlign: "left", display: "block", marginBottom: 9, padding: "13px 15px", borderRadius: "var(--wl-radius)",
        border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)", background: "var(--wl-surface)", color: "var(--wl-text)", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16 }}>{c.name}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: c.date < t ? "var(--wl-muted)" : "var(--wl-accent)", whiteSpace: "nowrap" }}>{countdownLabel(c.date)}</span>
      </div>
      <div style={{ marginTop: 4, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span>{c.date}</span>
        {c.place && <span>{c.place}</span>}
        <span>{c.athleteCount} {c.athleteCount === 1 ? "atleta" : "atletas"}</span>
      </div>
    </button>
  );

  return (
    <div style={{ padding: "14px 18px 26px", color: "var(--wl-text)", minHeight: "100vh", maxWidth: 390, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <Link to="/coach" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", textDecoration: "none" }}>‹ Plantel</Link>
          <h1 style={{ margin: "4px 0 0", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 24, letterSpacing: -.4 }}>Competencias</h1>
        </div>
        <button type="button" onClick={() => setShowNew(true)}
          style={{ marginTop: 4, padding: "8px 13px", borderRadius: 10, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          + Nueva
        </button>
      </div>

      {error ? (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)", padding: "16px 0" }}>
          No se pudieron cargar las competencias.{" "}
          <RetryButton onClick={() => setReload((r) => r + 1)} />
        </div>
      ) : loading ? (
        <Loading style={{ fontFamily: "var(--mono)", fontSize: 11, padding: "16px 0" }}>Cargando competencias…</Loading>
      ) : items.length === 0 ? (
        <div style={{ marginTop: 30, textAlign: "center", color: "var(--wl-muted)" }}>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 15, color: "var(--wl-text)" }}>Todavía no creaste competencias</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
            Creá una competencia y acoplá a varios atletas de una.<br />A cada uno podés marcarle si es su pico o una compe de paso.
          </div>
          <button type="button" onClick={() => setShowNew(true)}
            style={{ marginTop: 16, padding: "11px 18px", borderRadius: 12, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            + Nueva competencia
          </button>
        </div>
      ) : (
        <>
          {proximas.length > 0 && (
            <>
              <SectionLabel>Próximas</SectionLabel>
              {proximas.map(card)}
            </>
          )}
          {pasadas.length > 0 && (
            <>
              <SectionLabel>Finalizadas</SectionLabel>
              {pasadas.map(card)}
            </>
          )}
        </>
      )}

      {showNew && <CompetitionFormSheet open onClose={() => setShowNew(false)} onSubmit={onCreate} />}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 11px" }}>
      <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, letterSpacing: 1, color: "var(--wl-muted)", textTransform: "uppercase" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
    </div>
  );
}
