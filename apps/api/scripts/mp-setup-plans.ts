/**
 * Crea los `preapproval_plan` de Mercado Pago para cada tier × período (8 planes) leyendo la grilla
 * de `@holy-oly/core` (montos GROSS = net + IVA). Imprime las líneas MERCADOPAGO_PLAN_* para pegar
 * en el env del API.
 *
 * Previsualizar (sin tocar MP):
 *   pnpm --filter @holy-oly/api exec tsx scripts/mp-setup-plans.ts --dry-run
 * Crear de verdad (sandbox o prod según el token):
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-... APP_ORIGIN=https://tu-dominio node ... (vía tsx)
 *   pnpm --filter @holy-oly/api exec tsx scripts/mp-setup-plans.ts
 */
import { COACH_PLANS, formatClp, mercadoPagoPlanEnvKey, type BillingPeriod } from "@holy-oly/core";
import { buildPreapprovalPlanBody, createPreapprovalPlan } from "../src/billing/mercadopago";

const PERIODS: readonly BillingPeriod[] = ["monthly", "annual"];
const dryRun = process.argv.includes("--dry-run");
const origin = process.env.APP_ORIGIN ?? "http://localhost:8765";

async function main(): Promise<void> {
  if (!dryRun && !process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
    console.error("Falta MERCADOPAGO_ACCESS_TOKEN. Probá primero con --dry-run para ver los montos.");
    process.exit(1);
  }
  console.log(dryRun ? "# DRY RUN — montos que se crearían (no se llama a MP):\n" : "# Pegá estas líneas en el env del API (Render/Railway):\n");
  for (const plan of COACH_PLANS) {
    for (const period of PERIODS) {
      const body = buildPreapprovalPlanBody(plan, period, origin);
      const tag = `${plan.name}/${period} ${formatClp(body.auto_recurring.transaction_amount)} (IVA incl., ${body.auto_recurring.frequency_type})`;
      if (dryRun) {
        console.log(`# ${mercadoPagoPlanEnvKey(plan.id, period)} → ${tag}`);
        continue;
      }
      try {
        const id = await createPreapprovalPlan(body);
        console.log(`${mercadoPagoPlanEnvKey(plan.id, period)}="${id}"   # ${tag}`);
      } catch (e) {
        console.error(`# FAIL ${plan.id}/${period}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
