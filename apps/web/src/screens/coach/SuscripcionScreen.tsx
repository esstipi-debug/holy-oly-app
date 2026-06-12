import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatClp, MULTISEDE } from "@holy-oly/core";
import { billingCheckout, billingPlans, billingStatus, mockActivate, type BillingPeriod, type BillingPlan, type BillingStatus } from "../../billing/billingClient";
import { useAuth } from "../../auth/AuthContext";
import { BackButton } from "../../ui/BackButton";
import { VerifyEmailBanner } from "../../ui/VerifyEmailBanner";

const monthsFree = (p: BillingPlan): number => Math.round((p.priceClpMonthly * 6 - p.priceClpSemiannual) / p.priceClpMonthly);
const coachesLabel = (n: number | null): string => (n == null ? "Coaches ilimitados" : n === 1 ? "1 coach" : `Hasta ${n} coaches`);

export function SuscripcionScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlan["id"]>("coach");
  const [period, setPeriod] = useState<BillingPeriod>("semiannual"); // semestral-first (caja)
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setStatus(await billingStatus());
  }, []);

  useEffect(() => {
    void Promise.all([billingPlans(), refresh()])
      .then(([p]) => setPlans(p))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"));
  }, [refresh]);

  useEffect(() => {
    if (params.get("mockCheckout") !== "1") return;
    let on = true;
    mockActivate()
      .then(() => { if (on) return refresh(); })
      .catch((e: unknown) => { if (on) setError(e instanceof Error ? e.message : "Error"); });
    return () => { on = false; };
  }, [params, refresh]);

  async function onCheckout(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const selectedPlan = plans.find((p) => p.id === selectedPlanId);
      const hasSemiannual = selectedPlan?.availablePeriods?.includes("semiannual") ?? true;
      const effectivePeriod = period === "semiannual" && !hasSemiannual ? "monthly" : period;
      const { checkoutUrl } = await billingCheckout(selectedPlanId, effectivePeriod);
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
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const activePlan = status?.planId ? plans.find((p) => p.id === status.planId) : null;
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
      <BackButton ariaLabel="Volver a Cuenta" onClick={() => navigate("/coach/cuenta")} />
      <h1 style={{ fontFamily: "var(--wl-display)", fontSize: 22, fontWeight: 800, margin: "10px 0 6px" }}>Suscripción</h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>
        Los atletas son gratis. El coach necesita plan activo para editar programas. Precios + IVA.
      </p>

      {user && user.emailVerified === false && <VerifyEmailBanner />}

      {status && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "var(--wl-surface)" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>Estado</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{status.active ? "Activa" : status.status}</div>
          {activePlan && (
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Plan: {activePlan.name} (desde {formatClp(activePlan.priceClpMonthly)} + IVA/mes)
            </div>
          )}
          {status.currentPeriodEnd && (
            <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 6 }}>
              Vence: {new Date(status.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {!status?.active && plans.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {periodBtn("semiannual", "Semestral · 1 mes gratis")}
            {periodBtn("monthly", "Mensual")}
          </div>

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {plans.map((plan) => {
              const selected = plan.id === selectedPlanId;
              const hasSemiannual = plan.availablePeriods?.includes("semiannual") ?? true;
              const effectivePeriod = period === "semiannual" && !hasSemiannual ? "monthly" : period;
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
                      {effectivePeriod === "semiannual"
                        ? `≈ ${formatClp(Math.round(plan.priceClpSemiannual / 6))} + IVA/mes`
                        : `${formatClp(plan.priceClpMonthly)} + IVA/mes`}
                    </span>
                  </div>
                  {effectivePeriod === "semiannual" && (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-accent)", marginTop: 3 }}>
                      {formatClp(plan.priceClpSemiannual)} + IVA cada 6 meses · {monthsFree(plan)} mes gratis
                    </div>
                  )}
                  {period === "semiannual" && !hasSemiannual && (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 3 }}>
                      Facturación mensual
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 4 }}>{plan.description}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 6 }}>
                    {plan.maxAthletes != null ? `Hasta ${plan.maxAthletes} atletas` : "Atletas ilimitados"} · {coachesLabel(plan.maxCoaches)}
                  </div>
                </button>
              );
            })}

            {/* Multi-sede: precio personalizado (contacto), no self-serve */}
            <div style={{ padding: 14, borderRadius: 12, border: "1px dashed color-mix(in srgb,var(--wl-muted) 35%,transparent)", background: "var(--wl-surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16 }}>{MULTISEDE.name}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)" }}>desde {formatClp(MULTISEDE.fromClpMonthly)} + IVA/mes</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 4 }}>{MULTISEDE.description}</div>
              <a href="mailto:hola@holyoly.app?subject=Plan%20Multi-sede" style={{ display: "inline-block", marginTop: 8, fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-accent)", fontWeight: 700 }}>
                Contactanos →
              </a>
            </div>
          </div>
        </>
      )}

      {error && <div role="alert" style={{ marginTop: 12, color: "var(--wl-danger)", fontSize: 12 }}>{error}</div>}

      {status?.active ? (
        // D6: suscripción activa → nada de CTA falso que re-dispare checkout. Cambios = contacto.
        <div style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", lineHeight: 1.6 }}>
          Para cambios de plan escribinos:{" "}
          <a href="mailto:hola@holyoly.app?subject=Cambio%20de%20plan" style={{ color: "var(--wl-accent)", fontWeight: 700 }}>
            hola@holyoly.app
          </a>
        </div>
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
          {busy ? "Abriendo el pago…" : isDemo ? `Activar ${plans.find((p) => p.id === selectedPlanId)?.name ?? "plan"} (demo)` : "Ir a pagar con Mercado Pago"}
        </button>
      )}
    </div>
  );
}
