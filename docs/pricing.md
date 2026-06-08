# Precios coach — Holy Oly (Chile)

Referencia de producto para suscripciones B2B. **Los atletas no pagan**; sólo el coach necesita plan activo para editar programas.

> Valores en **CLP, netos + IVA (19%)** (convención B2B). **Anual = "2 meses gratis"** (pagás 10 meses → ahorro 16,7%). Fuente de verdad en código: `packages/core/src/billing/plans.ts` (`COACH_PLANS` + `MULTISEDE`).

## Tabla de precios

| Plan (`planId`) | Atletas | Coaches | Mensual (+IVA) | Anual (+IVA) | Ahorro anual | Costo/atleta/mes (al tope) |
|-----------------|---------|---------|----------------|--------------|--------------|----------------------------|
| `coach` Coach | 1–15 | 1 | $19.900 | $199.000 | $39.800 | ~$1.327 |
| `pro` Pro | 16–40 | 1–2 | $39.900 | $399.000 | $79.800 | ~$1.000 |
| `elite` Elite | 41–80 | hasta 3 | $69.900 | $699.000 | $139.800 | ~$874 |
| `box` Box/Club | 81–250 | ilimitados | $129.900 | $1.299.000 | $259.800 | ~$650 |
| Multi-sede | 250+ | ilimitados | Personalizado (desde ~$199.900) | Personalizado | — | <$650 |

Multi-sede es **contacto** (no self-serve): card "Contactanos" en la UI, no pasa por checkout.

### Por qué estos cortes (15 / 40 / 80 / 250)
- **15 (Coach→Pro):** macrociclos 1:1 son alta dedicación; un coach individualiza ~15 antes de necesitar plantillas. Tramo de entrada generoso (vs 5 de TrueCoach/Everfit) para el coach part-time chileno.
- **40 (Pro→Elite):** el "libro completo" de un full-time con plantillas; extiende el estándar de 20 y evita el salto castigador 20→50 de TrueCoach.
- **80 (Elite→Box):** deja de ser "para un coach" → "para un equipo" (coaches asistentes + dashboard multi-coach). Coincide con 50–100 de TrainHeroic/TeamBuildr.
- **250 (Box→Multi-sede):** tope de BoxMagic Silver; techo de un box grande de una sede en Chile.

### Box/Club (instalaciones)
Coaches ilimitados + dashboard multi-coach con **roster compartido** (diferenciador vs Volt/TrainHeroic que cobran por coach asistente). Onboarding asistido + soporte prioritario. Add-ons: marca blanca/app con logo, pago local (Webpay/MACH/Khipu). $129.900+IVA ≈ $650/atleta a 200.

## Posicionamiento (resumen)
- **vs Volt:** Volt ~$736.000/año por ~20 atletas + cargos por atleta; Holy Oly **Pro** cubre 40 por $399.000/año (mitad de costo/atleta), en español, pasarelas locales, foco halterofilia.
- **vs TrueCoach/TrainHeroic:** TrueCoach US$57,99/mes por 20; Pro da 40 por $39.900, sin comisión 5% por transacción.
- **vs BoxMagic/CrossHero:** misma banda CLP, pero con **periodización real** que esas (gestión) no tienen. Mensaje: *"funcionalidad internacional a precio chileno, en tu idioma."*

## Recomendaciones (estrategia)
- **Anual = opción por defecto** en la página de precios, etiqueta "2 meses gratis" (✅ ya en `SuscripcionScreen`). **No** empujar anual en el registro; ofrecerlo **día 60–90** cuando el coach ya vio valor (anual: +50–60% ingreso/usuario, −3–5× rotación). *(El nudge día-60 es pendiente de implementar.)*
- **Promo de lanzamiento:** descuento anual a **20%** los primeros 6 meses para fundadores (precio grandfathered) → caja temprana + prueba social. *(Pendiente.)*
- **Banda plana, todas las funciones en cada nivel**; la única variable es el nº de atletas (✅ así está modelado).
- **Upgrade automático prorrateado** al superar el tope. *(Pendiente.)*
- **Add-on marca blanca** para Box/Club. *(Pendiente.)*

### Umbrales que cambiarían esto
- Si los coaches cobran <$30.000/atleta/mes → bajar Coach a $14.900 y cortes 10/25/60.
- Si rotación mensual >6–8% → descuento anual 20–25% permanente.
- Si >40% de ventas son boxes → invertir foco a Box/Club, precio por sede.

## Mercado Pago (go-live)
- Producto: [Suscripciones](https://www.mercadopago.cl/developers/es/docs/subscriptions/overview) (`preapproval_plan` + `preapproval`), **CLP**.
- Comisión: 3,19% al instante · 2,89% a 10 días (+IVA sobre comisión).
- Webhook: `x-signature` con `MERCADOPAGO_WEBHOOK_SECRET` (`apps/api/src/billing/mercadopago.ts`).
- **Crear un `preapproval_plan` por tier × período** (8 planes) y pegar los ids:

```env
BILLING_PROVIDER="mercadopago"
MERCADOPAGO_ACCESS_TOKEN=""
MERCADOPAGO_WEBHOOK_SECRET=""
MERCADOPAGO_PLAN_COACH_MONTHLY=""   MERCADOPAGO_PLAN_COACH_ANNUAL=""
MERCADOPAGO_PLAN_PRO_MONTHLY=""     MERCADOPAGO_PLAN_PRO_ANNUAL=""
MERCADOPAGO_PLAN_ELITE_MONTHLY=""   MERCADOPAGO_PLAN_ELITE_ANNUAL=""
MERCADOPAGO_PLAN_BOX_MONTHLY=""     MERCADOPAGO_PLAN_BOX_ANNUAL=""
```
**Crear los 8 planes automáticamente** (lee la grilla + IVA y devuelve los `MERCADOPAGO_PLAN_*`):
```bash
# previsualizar los montos (no llama a MP):
pnpm --filter @holy-oly/api exec tsx scripts/mp-setup-plans.ts --dry-run
# crear de verdad (sandbox o prod según el token) e imprimir los ids para el env:
MERCADOPAGO_ACCESS_TOKEN=APP_USR-... APP_ORIGIN=https://tu-dominio pnpm --filter @holy-oly/api exec tsx scripts/mp-setup-plans.ts
```
> El monto que se carga en MP es el **bruto** (net × 1,19, vía `withIva()`). En dev, `BILLING_PROVIDER=mock` (checkout demo sin MP).

## Caveats (de la investigación)
- Precios de competidores provienen en parte de blogs/agregadores (las páginas oficiales ocultan precios) → indicativos, sujetos a cambio.
- Volt: piso US$800/año confirmado (GetApp); tabla completa de tiers de baja autoridad (aijourney.so), no verificada en Capterra/SoftwareAdvice.
- TrainHeroic tier de 5: fuentes en conflicto (US$30 vs US$49); cortes 20/50/100 sí consistentes.
- TAM Chile: sin cifra pública exacta; ~cientos de cuentas (boxes CrossFit + clubes Fechipe + coaches independientes), no miles. USD→CLP fluctúa.
