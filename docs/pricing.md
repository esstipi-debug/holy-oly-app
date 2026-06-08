# Precios coach — Holy Oly (Chile)

Referencia de producto para suscripciones B2B. **Los atletas no pagan**; solo el coach necesita plan activo para editar programas.

> Estado: tiers acordados con el owner (jun 2026). Límites de atletas son **provisionales** hasta confirmación final.

## Planes

| ID (`planId`) | Nombre | CLP/mes | Atletas (provisional) | Mercado Pago |
|---------------|--------|---------|------------------------|--------------|
| `basico` | Básico | $50.000 | 10 | `MERCADOPAGO_PLAN_BASICO` → `preapproval_plan_id` |
| `equipo` | Equipo | $80.000 | 30 | `MERCADOPAGO_PLAN_EQUIPO` → `preapproval_plan_id` |

Fuente de verdad en código: `packages/core/src/billing/plans.ts` (`COACH_PLANS`).

## Mercado Pago Chile

- Producto: [Suscripciones](https://www.mercadopago.cl/developers/es/docs/subscriptions/overview) (`preapproval_plan` + `preapproval`).
- Moneda: **CLP**.
- Comisiones (referencia owner, suscripciones): **3,19%** al instante · **2,89%** a 10 días (+ IVA sobre comisión).
- Webhook: validar header `x-signature` con `MERCADOPAGO_WEBHOOK_SECRET` (ver `apps/api/src/billing/mercadopago.ts`).

### Setup en MP (manual, una vez por tier)

1. Crear plan recurrente mensual en CLP con el monto del tier.
2. Copiar el `preapproval_plan_id` a las variables de entorno del API.
3. Configurar URL de webhook → `POST /billing/webhook` con eventos `subscription_preapproval`.

## Variables de entorno (API)

```env
BILLING_PROVIDER="mercadopago"
MERCADOPAGO_ACCESS_TOKEN=""
MERCADOPAGO_WEBHOOK_SECRET=""
MERCADOPAGO_PLAN_BASICO=""
MERCADOPAGO_PLAN_EQUIPO=""
```

En desarrollo, `BILLING_PROVIDER=mock` sigue disponible (checkout demo sin MP).

## Pendiente owner

- [ ] Confirmar límites por tier (atletas, features).
- [ ] ¿Tercer tier (ej. club) y precio?
- [ ] Crear planes en cuenta MP producción y pegar IDs en Render.
