/**
 * "Ver como atleta" (P1, demo-only) — the coach drill-down's swap-in-place preview of how the
 * SAME athlete sees their prescribed week, discs and all. The money shot: edit a plan/weight as
 * coach, flip the toggle, watch the prescription land with the official IWF discs.
 *
 * Approach: inject an id-scoped athlete client (default `new LocalMeClient(athleteId)`), so this
 * reads the SAME localStorage the coach just wrote — no global singleton mutation, no router
 * coupling. Reuses the INTOCABLE `DiscRow` for plate fidelity. Gated to demo mode by the caller
 * (the toggle only renders when `!API_ENABLED`).
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { barKgForSexo, type SessionView } from "@holy-oly/core";
import { Loading } from "../../ui/Loading";
import { LocalMeClient } from "../../data/LocalMeClient";
import { DiscRow } from "../../ui/Disc";
import { useMovementName } from "../../i18n/useMovementLang";
import { LeadCaptureButton } from "./LeadCaptureButton";

/** The slice of the athlete client this preview needs (lets tests inject a fake). */
export interface AthletePreviewClient {
  getMeSessions(week: number): Promise<SessionView[]>;
}

type Load = "loading" | "ready" | "error";

export function AtletaPreview({
  athleteId,
  week,
  sexo,
  client,
}: {
  athleteId: string;
  week: number;
  sexo?: "M" | "F";
  client?: AthletePreviewClient;
}) {
  const { t } = useTranslation("coach");
  const mn = useMovementName();
  const me = useMemo<AthletePreviewClient>(() => client ?? new LocalMeClient(athleteId), [client, athleteId]);
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [load, setLoad] = useState<Load>("loading");

  useEffect(() => {
    let on = true;
    setLoad("loading");
    me.getMeSessions(week)
      .then((s) => { if (on) { setSessions(s); setLoad("ready"); } })
      .catch(() => { if (on) setLoad("error"); });
    return () => { on = false; };
  }, [me, week]);

  const barKg = barKgForSexo(sexo ?? "M");

  if (load === "loading") {
    return <Loading style={{ padding: 20 }}>{t("previewLoading")}</Loading>;
  }
  if (load === "error") {
    return <div role="alert" style={{ padding: 20, color: "var(--wl-muted)" }}>{t("previewError")}</div>;
  }
  if (!sessions || sessions.length === 0) {
    return (
      <div className="wls" data-testid="atleta-preview">
        <p className="wls__sectiontitle">{t("previewTitle")}</p>
        <p className="wls__hint">{t("previewEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="wls" data-testid="atleta-preview">
      <p className="wls__sectiontitle">{t("previewTitleWeek", { week })}</p>
      {sessions.map((s) => (
        <section key={s.sessionIdx} className="ho-card">
          <div className="ho-card__head"><span className="ho-card__t">{t("previewDay", { n: s.sessionIdx + 1 })}</span></div>
          {s.exercises.map((e, i) => (
            <div key={`${s.sessionIdx}-${i}`} className="wls__row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <span className="wls__rowlabel">{mn(e.movementId)}</span>
              <span className="wls__reps">{e.sets}×{e.reps}{e.pct != null ? ` · ${e.pct}%` : ""}</span>
              <span style={{ flex: 1 }} />
              {e.targetKg != null ? <DiscRow kg={e.targetKg} barKg={barKg} /> : <span className="wls__hint">—</span>}
              {e.targetKg != null && <span className="wls__kg">{e.targetKg} kg</span>}
            </div>
          ))}
        </section>
      ))}
      <p style={{ fontSize: 12.5, color: "var(--wl-muted)", margin: "14px 0 0", textAlign: "center" }}>{t("previewFooter")}</p>
      <LeadCaptureButton variant="primary" />
    </div>
  );
}
