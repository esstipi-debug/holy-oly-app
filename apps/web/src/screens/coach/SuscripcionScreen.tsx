import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MULTISEDE } from "@holy-oly/core";
import { useFormat } from "../../lib/useFormat";
import { billingCheckout, billingPlans, billingStatus, mockActivate, type BillingPeriod, type BillingPlan, type BillingStatus } from "../../billing/billingClient";
import { useAuth } from "../../auth/AuthContext";
import { BackButton } from "../../ui/BackButton";
import { RetryButton } from "../../ui/RetryButton";
import { VerifyEmailBanner } from "../../ui/VerifyEmailBanner";

const monthsFree = (p: BillingPlan): number => Math.round((p.priceClpMonthly * 6 - p.priceClpSemiannual) / p.priceClpMonthly);

const ALL_PERIODS: readonly BillingPeriod[] = ["monthly", "semiannual"];
// Un combo plan+período se paga "por interno" cuando MP no lo puede cobrar (semestral de tiers altos > $350K).
const isManualPayment = (p: BillingPlan, per: BillingPeriod): boolean =>
  !(p.mpCheckoutPeriods ?? ALL_PERIODS).includes(per);

export function SuscripcionScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("roster");
  const fmt = useFormat();
  // CLP localizado: es-419/es-AR → "$19.990" (es-CL), en → "CLP 19,990", pt-BR → "CLP 19.990".
  const clp = (amount: number): string => fmt.currency(amount, "CLP", { maximumFractionDigits: 0 });
  const coachesLabel = (n: number | null): string => (n == null ? t("subCoachesUnlimited") : t("subCoaches", { count: n }));
  // Email para coordinar los pagos que no entran a MP (PayPal/transferencia).
  const coordinarPagoHref = (planName: string): string =>
    `mailto:esstipi@gmail.com?subject=${encodeURIComponent(t("subPayEmailSubject", { plan: planName }))}`;
  const [params] = useSearchParams();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlan["id"]>("coach");
  const [period, setPeriod] = useState<BillingPeriod>("semiannual"); // semestral-first (caja)
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [reload, setReload] = useState(0);
  const refresh = useCallback(async (): Promise<void> => {
    setStatus(await billingStatus());
  }, []);

  useEffect(() => {
    let on = true;
    setError(null);
    void Promise.all([billingPlans(), refresh()])
      .then(([p]) => { if (on) setPlans(p); })
      // Error en español fijo (no el crudo del server, posible inglés). El reintento re-corre el load.
      .catch(() => { if (on) setError(t("subLoadError")); });
    return () => { on = false; };
  }, [refresh, reload, t]);

  useEffect(() => {
    if (params.get("mockCheckout") !== "1") return;
    let on = true;
    mockActivate()
      .then(() => { if (on) return refresh(); })
      .catch((e: unknown) => { if (on) setError(e instanceof Error ? e.message : t("subError")); });
    return () => { on = false; };
  }, [params, refresh, t]);

  async function onCheckout(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await billingCheckout(selectedPlanId, period);
      // Sólo http(s) reales navegan — bloquea javascript:/data: si el backend devolviera una URL hostil.
      let isWebUrl = false;
      try {
        const u = new URL(checkoutUrl);
        isWebUrl = u.protocol === "https:" || u.protocol === "http:";
      } catch {
        isWebUrl = false; // relativa o malformada → flujo mock (refresh)
      }
      if (isWebUrl) window.location.href = checkoutUrl;
      else await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("subError"));
    } finally {
      setBusy(false);
    }
  }

  const activePlan = status?.planId ? plans.find((p) => p.id === status.planId) : null;
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const checkoutIsManual = selectedPlan ? isManualPayment(selectedPlan, period) : false;
  const isDemo = status?.provider === "mock" || !import.meta.env.PROD;
  const periodBtn = (p: BillingPeriod, label: string) => (
    <button
      type="button"
      onClick={() => setPeriod(p)}
      style={{
        flex: 1, padding: "9px 10px", borderRadius: 10, cursor: "pointer",
        border: period === p ? "2px solid var(--wl-accent)" : "1px solid color-mix(in srgb,var(--wl-muted) 25%,transparent)",
        background: period === p ? "color-mix(in srgb,var(--wl-accent) 12%,var(--wl-surface))" : "var(--wl-surface)",
        color: "var(--wl-text)", fontWeight: 700, fontSize: 13,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: "14px 13px 26px", maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: "var(--wl-bg)", color: "var(--wl-text)" }}>
      <BackButton ariaLabel={t("subBackAria")} onClick={() => navigate("/coach/cuenta")} />
      <h1 style={{ fontFamily: "var(--wl-display)", fontSize: 22, fontWeight: 800, margin: "10px 0 6px" }}>{t("subTitle")}</h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>
        {t("subIntro")}
      </p>

      {user && user.emailVerified === false && <VerifyEmailBanner />}

      {status && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "var(--wl-surface)" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>{t("subStatus")}</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{status.active ? t("subActive") : status.status}</div>
          {activePlan && (
            <div style={{ fontSize: 13, marginTop: 6 }}>
              {t("subPlanLine", { name: activePlan.name, price: clp(activePlan.priceClpMonthly) })}
            </div>
          )}
          {status.currentPeriodEnd && (
            <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 6 }}>
              {t("subExpires", { date: fmt.date(status.currentPeriodEnd, { year: "numeric", month: "long", day: "numeric" }) })}
            </div>
          )}
        </div>
      )}

      {!status?.active && plans.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {periodBtn("semiannual", t("subSemiannual"))}
            {periodBtn("monthly", t("subMonthly"))}
          </div>

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {plans.map((plan) => {
              const selected = plan.id === selectedPlanId;
              const manualSemi = period === "semiannual" && isManualPayment(plan, "semiannual");
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 12,
                    border: selected ? "2px solid var(--wl-accent)" : "1px solid color-mix(in srgb,var(--wl-muted) 25%,transparent)",
                    background: "var(--wl-surface)",
                    color: "var(--wl-text)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16 }}>{plan.name}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700 }}>
                      {/* Headline siempre por mes → escalera comparable entre planes (sem y mensual no se mezclan). */}
                      {period === "semiannual"
                        ? t("subPerMonthApprox", { price: clp(Math.round(plan.priceClpSemiannual / 6)) })
                        : t("subPerMonth", { price: clp(plan.priceClpMonthly) })}
                    </span>
                  </div>
                  {period === "semiannual" && (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-accent)", marginTop: 3 }}>
                      {t("subSemiDetail", { price: clp(plan.priceClpSemiannual), months: monthsFree(plan) })}
                    </div>
                  )}
                  {manualSemi && (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 3 }}>
                      {t("subManualNote")}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 4 }}>{plan.description}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 6 }}>
                    {plan.maxAthletes != null ? t("subAthletesMax", { count: plan.maxAthletes }) : t("subAthletesUnlimited")} · {coachesLabel(plan.maxCoaches)}
                  </div>
                </button>
              );
            })}

            {/* Multi-sede: precio personalizado (contacto), no self-serve */}
            <div style={{ padding: 14, borderRadius: 12, border: "1px dashed color-mix(in srgb,var(--wl-muted) 35%,transparent)", background: "var(--wl-surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16 }}>{MULTISEDE.name}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)" }}>{t("subFromPerMonth", { price: clp(MULTISEDE.fromClpMonthly) })}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 4 }}>{MULTISEDE.description}</div>
              <a href="mailto:esstipi@gmail.com?subject=Plan%20Multi-sede" style={{ display: "inline-block", marginTop: 8, fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-accent)", fontWeight: 700 }}>
                {t("subContact")}
              </a>
            </div>
          </div>
        </>
      )}

      {error && (
        <div role="alert" style={{ marginTop: 12, color: "var(--wl-danger)", fontSize: 12 }}>
          {error}{plans.length === 0 && <> <RetryButton onClick={() => setReload((r) => r + 1)} /></>}
        </div>
      )}

      {status?.active ? (
        // D6: suscripción activa → nada de CTA falso que re-dispare checkout. Cambios = contacto.
        <div style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", lineHeight: 1.6 }}>
          {t("subChangePlan")}{" "}
          <a href="mailto:esstipi@gmail.com?subject=Cambio%20de%20plan" style={{ color: "var(--wl-accent)", fontWeight: 700 }}>
            esstipi@gmail.com
          </a>
        </div>
      ) : checkoutIsManual ? (
        <>
          <a
            href={coordinarPagoHref(selectedPlan?.name ?? "plan")}
            style={{
              display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box",
              width: "100%", marginTop: 16, padding: 14, borderRadius: 12, border: 0,
              background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800,
            }}
          >
            {t("subCoordinatePay")}
          </a>
          <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", lineHeight: 1.5 }}>
            {t("subManualBody")}
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={busy || plans.length === 0}
          onClick={() => void onCheckout()}
          style={{
            width: "100%", marginTop: 16, padding: 14, borderRadius: 12, border: 0,
            background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800,
            cursor: busy || plans.length === 0 ? "default" : "pointer",
            opacity: busy || plans.length === 0 ? 0.45 : 1,
          }}
        >
          {busy ? t("subOpening") : isDemo ? t("subActivateDemo", { name: plans.find((p) => p.id === selectedPlanId)?.name ?? "plan" }) : t("subPayMp")}
        </button>
      )}
    </div>
  );
}
