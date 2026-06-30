/**
 * Provisión NO-DESTRUCTIVA de cuentas de LOGIN para los atletas demo (para producción). `enrich-demo`
 * deja los datos de los atletas (mv/kv/…) pero NO crea sus cuentas de usuario; el demo público de
 * atleta (GET /auth/demo?as=atleta) necesita un User(role=atleta) vinculado a un atleta ya poblado.
 * Este script crea/asegura ese login y lo enlaza al atleta existente (no toca sus datos).
 *
 * Correr (con DATABASE_URL apuntando a la DB destino):
 *   DATABASE_URL=... pnpm --filter @holy-oly/api exec tsx scripts/ensure-demo-atleta.ts
 *
 * Seguridad: aborta si no encuentra el coach demo (coach@holyoly.dev) → evita correr contra otra DB.
 * Idempotente: si el user ya existe / ya está vinculado, no duplica nada.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_COACH_EMAIL = "coach@holyoly.dev";

// (email de login, id del atleta ya poblado). Kevin (kv, masc) es el default de DEMO_ATLETA_EMAIL;
// Mara (mv, fem) muestra el módulo de ciclo. Ambos ya tienen plan + historial vía enrich-demo.
const PAIRS: Array<{ email: string; athleteId: string }> = [
  { email: (process.env.DEMO_ATLETA_EMAIL ?? process.env.SEED_KEVIN_EMAIL ?? "kevin@holyoly.dev").trim().toLowerCase(), athleteId: "kv" },
  { email: (process.env.SEED_MARA_EMAIL ?? "mara@holyoly.dev").trim().toLowerCase(), athleteId: "mv" },
];

async function ensureAtletaLogin(email: string, athleteId: string): Promise<void> {
  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
  if (!athlete) {
    console.log(`· ${athleteId}: no existe en esta DB — se omite`);
    return;
  }
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Sin password: la cuenta SOLO se alcanza vía GET /auth/demo (passwordless) → no es loginnable
    // públicamente por contraseña. role=atleta + emailVerified para que /atleta no pida verificación.
    user = await prisma.user.create({ data: { email, passwordHash: null, role: "atleta", emailVerified: true } });
  }
  if (athlete.userId !== user.id) {
    await prisma.athlete.update({ where: { id: athleteId }, data: { userId: user.id } });
  }
  console.log(`✓ ${email} ↔ atleta ${athleteId} (login listo)`);
}

async function main(): Promise<void> {
  const coach = await prisma.user.findUnique({ where: { email: DEMO_COACH_EMAIL } });
  if (!coach) {
    throw new Error(`Coach demo (${DEMO_COACH_EMAIL}) no encontrado — abortando para no tocar una DB equivocada.`);
  }
  for (const { email, athleteId } of PAIRS) {
    await ensureAtletaLogin(email, athleteId);
  }
  console.log("\nProvisión de logins demo de atleta completa. Nada fuera del demo fue tocado.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
