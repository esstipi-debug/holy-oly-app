import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import type { MePlanView } from "@holy-oly/core";
import type { MeClient } from "../../../data/meClient";
import { PlanDetailSheet } from "../PlanDetailSheet";
import { PhaseTrack } from "./PhaseTrack";

/** Countdown a la próxima comp + cinta de fases. Empty (no plan) → honest empty variant. */
export function CaminoCard({ plan, client, sexo }: { plan: MePlanView["plan"]; client?: MeClient; sexo?: "M" | "F" }) {
  const { t } = useTranslation("atleta");
  // Hook must precede the early-return (Rules of Hooks); only meaningful when plan != null
  // (the no-plan branch renders no trigger/sheet, so `open` stays dormant there).
  const [open, setOpen] = useState(false);
  if (!plan) {
    return (
      <div className="ho-card">
        <div className="ho-card__head"><span className="ho-card__t">{t("caminoTitle")}</span><span className="ho-card__end" style={{ color: "var(--wl-muted)" }}>{t("caminoEnd")}</span></div>
        <div className="ho-nodata">
          <div className="ho-nodata__icon">·</div>
          <div className="ho-nodata__t">{t("caminoNoPlanTitle")}</div>
          <div className="ho-nodata__b">{t("caminoNoPlanBody")}</div>
        </div>
      </div>
    );
  }
  const next = [...plan.comps].sort((a, b) => a.week - b.week).find((c) => c.week >= plan.currentWeek) ?? plan.comps[plan.comps.length - 1];
  const faltan = next ? next.week - plan.currentWeek : null;
  return (
    <div className="ho-card">
      <div className="ho-card__head"><span className="ho-card__t">{t("caminoTitle")}</span><span className="ho-card__end" style={{ color: "var(--wl-muted)" }}>{t("caminoEnd")}</span></div>
      <div className="ho-card__sub" style={{ marginTop: 4 }}>{t("caminoSub")}</div>
      {next && faltan != null ? (
        <div className="ho-count">
          <b>{Math.max(0, faltan)}</b>
          <span>{faltan === 0
            ? <Trans t={t} i18nKey="caminoCountThisWeek" values={{ name: next.name }} components={{ b: <b /> }} />
            : faltan < 0
            ? <Trans t={t} i18nKey="caminoCountPast" values={{ name: next.name }} components={{ b: <b /> }} />
            : <Trans t={t} i18nKey="caminoCountFuture" values={{ name: next.name, week: next.week, total: plan.totalWeeks }} components={{ b: <b />, br: <br /> }} />}</span>
        </div>
      ) : null}
      <PhaseTrack plan={plan} />
      <button type="button" className="ho-plan__trigger" onClick={() => setOpen(true)}>
        {t("caminoDetailCta")} <span aria-hidden>›</span>
      </button>
      <PlanDetailSheet plan={plan} open={open} onClose={() => setOpen(false)} client={client} sexo={sexo} />
    </div>
  );
}
