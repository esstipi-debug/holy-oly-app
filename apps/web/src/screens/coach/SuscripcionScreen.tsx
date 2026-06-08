import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatClp } from "@holy-oly/core";
import { billingCheckout, billingPlans, billingStatus, mockActivate, type BillingPlan, type BillingStatus } from "../../billing/billingClient";
import { resendVerificationEmail } from "../../auth/authClient";
import { useAuth } from "../../auth/AuthContext";

export function SuscripcionScreen() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlan["id"]>("basico");
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    setStatus(await billingStatus());
  }

  useEffect(() => {
    void Promise.all([billingPlans(), refresh()])
      .then(([p]) => setPlans(p))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  useEffect(() => {
    if (params.get("mockCheckout") === "1") {
      void mockActivate().then(refresh).catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"));
    }
  }, [params]);

  async function onCheckout(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await billingCheckout(selectedPlanId);
      if (checkoutUrl.startsWith("http")) window.location.href = checkoutUrl;
      else await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const activePlan = status?.planId ? plans.find((p) => p.id === status.planId) : null;
  const isDemo = status?.provider === "mock" || !import.meta.env.PROD;

  return (
    <div style={{ padding: "14px 13px 84px", maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: "var(--wl-bg)", color: "var(--wl-text)" }}>
      <Link to="/coach/cuenta" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>← Cuenta</Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 6px" }}>Suscripción</h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>
        Los atletas son gratis. El coach necesita plan activo para editar programas.
      </p>

      {user && user.emailVerified === false && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-accent) 30%,transparent)" }}>
          <div style={{ fontWeight: 700 }}>Verificá tu email</div>
          <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 4 }}>Sin verificación no podés confirmar atletas en el roster.</div>
          <button type="button" onClick={() => void resendVerificationEmail()} style={{ marginTop: 8, padding: "8px 12px", borderRadius: 10, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontWeight: 700, cursor: "pointer" }}>
            Reenviar email
          </button>
        </div>
      )}

      {status && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "var(--wl-surface)" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>Estado</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{status.active ? "Activa" : status.status}</div>
          {activePlan && (
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Plan: {activePlan.name} ({formatClp(activePlan.priceClp)}/mes)
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
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {plans.map((plan) => {
            const selected = plan.id === selectedPlanId;
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
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{plan.name}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700 }}>{formatClp(plan.priceClp)}/mes</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 4 }}>{plan.description}</div>
                {plan.maxAthletes != null && (
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 6 }}>
                    Hasta {plan.maxAthletes} atletas
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && <div role="alert" style={{ marginTop: 12, color: "#ff3b46", fontSize: 12 }}>{error}</div>}

      <button
        type="button"
        disabled={busy || (!status?.active && plans.length === 0)}
        onClick={() => void onCheckout()}
        style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 12, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontWeight: 800, cursor: busy ? "default" : "pointer" }}
      >
        {status?.active ? "Gestionar plan" : isDemo ? `Activar ${plans.find((p) => p.id === selectedPlanId)?.name ?? "plan"} (demo)` : "Ir a pagar con Mercado Pago"}
      </button>
    </div>
  );
}
