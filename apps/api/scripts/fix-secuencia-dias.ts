/**
 * Fix de datos — secuencia de días (2026-06-13).
 *
 * La regla nueva exige resolver los días de cada semana EN ORDEN (completar o anular; un día doble
 * AM/PM se resuelve cuando AMBOS turnos lo están). La data de prueba de mv/kv quedó de antes de la
 * regla y puede violarla: días resueltos "adelante" de un día anterior sin resolver, o dos entrenos
 * en la misma fecha (regla 1×fecha). Este script detecta y limpia esas violaciones para los atletas
 * indicados, dejando el PREFIJO válido en orden de cada semana.
 *
 * Uso (DATABASE_URL apunta a la DB a corregir):
 *   tsx scripts/fix-secuencia-dias.ts            # DRY-RUN: solo reporta qué borraría
 *   tsx scripts/fix-secuencia-dias.ts --apply    # aplica los borrados (transaccional)
 *   tsx scripts/fix-secuencia-dias.ts --apply mv kv otros…   # atletas explícitos
 *
 * Seguro de re-correr (idempotente): tras --apply, una segunda corrida no encuentra violaciones.
 */
import { PrismaClient } from "@prisma/client";
import { MACROCYCLES, dayLayoutFor } from "@holy-oly/core";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const ATHLETES = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const TARGETS = ATHLETES.length > 0 ? ATHLETES : ["mv", "kv"];

interface Reg { week: number; sessionIdx: number; fecha: string; estado: string }
interface DropTarget extends Reg { reason: string }

/** Las violaciones de UNA semana contra el set `weekRegs` ACTUAL (no transitivo). */
function weekViolations(weekRegs: Reg[], allIdxs: number[], dayOf: (i: number) => number): DropTarget[] {
  const drops: DropTarget[] = [];
  const resolved = new Set(weekRegs.map((r) => r.sessionIdx));
  const days = [...new Set(allIdxs.map(dayOf))].sort((a, b) => a - b);
  // Secuencia: primer día NO totalmente resuelto → cutoff; sesión resuelta más allá = violación.
  let cutoff = Infinity;
  for (const d of days) {
    if (!allIdxs.filter((i) => dayOf(i) === d).every((i) => resolved.has(i))) { cutoff = d; break; }
  }
  for (const r of weekRegs) {
    if (dayOf(r.sessionIdx) > cutoff) drops.push({ ...r, reason: `día ${dayOf(r.sessionIdx)} resuelto con el día ${cutoff} sin terminar` });
  }
  // 1×fecha: registros NO anulados, misma fecha, distinto día → conservar el día menor.
  const dropped = new Set(drops.map((d) => d.sessionIdx));
  const byFecha = new Map<string, Reg[]>();
  for (const r of weekRegs) {
    if (dropped.has(r.sessionIdx) || r.estado === "anulado") continue;
    (byFecha.get(r.fecha) ?? byFecha.set(r.fecha, []).get(r.fecha)!).push(r);
  }
  for (const [fecha, rs] of byFecha) {
    if (new Set(rs.map((r) => dayOf(r.sessionIdx))).size <= 1) continue; // mismo día (AM/PM) → permitido
    const minDay = Math.min(...rs.map((r) => dayOf(r.sessionIdx)));
    for (const r of rs) {
      if (dayOf(r.sessionIdx) > minDay) drops.push({ ...r, reason: `fecha ${fecha} compartida por días distintos (1×fecha)` });
    }
  }
  return drops;
}

async function analyzeAthlete(athleteId: string): Promise<DropTarget[]> {
  const plan = await prisma.plan.findUnique({ where: { athleteId } });
  const registros = await prisma.sessionRegistro.findMany({ where: { athleteId }, orderBy: [{ week: "asc" }, { sessionIdx: "asc" }] });
  if (registros.length === 0) return [];
  const macro = plan ? MACROCYCLES.find((m) => m.id === plan.macroId) : undefined;
  const pres = await prisma.prescribedExercise.findMany({ where: { athleteId }, select: { week: true, sessionIdx: true } });
  const dayOfFor = (week: number) => {
    const layout = macro ? dayLayoutFor(macro, week) : null;
    return (idx: number): number => layout?.[idx]?.day ?? idx + 1;
  };
  const idxsByWeek = new Map<number, Set<number>>();
  for (const p of pres) (idxsByWeek.get(p.week) ?? idxsByWeek.set(p.week, new Set()).get(p.week)!).add(p.sessionIdx);

  // Fixpoint en memoria: borrar un día puede dejar el siguiente "adelantado" → iterar hasta estable.
  let live: Reg[] = registros.map((r) => ({ week: r.week, sessionIdx: r.sessionIdx, fecha: r.fecha, estado: r.estado }));
  const weeks = [...new Set(live.map((r) => r.week))].sort((a, b) => a - b);
  const all: DropTarget[] = [];
  for (let iter = 0; iter < 100; iter++) {
    let any = false;
    for (const week of weeks) {
      const dayOf = dayOfFor(week);
      const weekRegs = live.filter((r) => r.week === week);
      const allIdxs = [...(idxsByWeek.get(week) ?? new Set(weekRegs.map((r) => r.sessionIdx)))];
      const drops = weekViolations(weekRegs, allIdxs, dayOf);
      if (drops.length === 0) continue;
      any = true;
      const ds = new Set(drops.map((d) => d.sessionIdx));
      all.push(...drops);
      live = live.filter((r) => !(r.week === week && ds.has(r.sessionIdx)));
    }
    if (!any) break;
  }
  return all.sort((a, b) => a.week - b.week || a.sessionIdx - b.sessionIdx);
}

async function main(): Promise<void> {
  console.log(`\n=== Fix secuencia de días · ${APPLY ? "APLICAR" : "DRY-RUN"} · atletas: ${TARGETS.join(", ")} ===\n`);
  let totalDrops = 0;
  for (const athleteId of TARGETS) {
    const drops = await analyzeAthlete(athleteId);
    if (drops.length === 0) { console.log(`• ${athleteId}: sin violaciones ✓`); continue; }
    console.log(`• ${athleteId}: ${drops.length} sesión(es) a limpiar:`);
    for (const d of drops) console.log(`    sem ${d.week} · idx ${d.sessionIdx} · ${d.estado} · ${d.fecha} — ${d.reason}`);
    totalDrops += drops.length;
    if (APPLY) {
      await prisma.$transaction(async (tx) => {
        for (const d of drops) {
          await tx.sessionActual.deleteMany({ where: { athleteId, week: d.week, sessionIdx: d.sessionIdx } });
          await tx.sessionRegistro.deleteMany({ where: { athleteId, week: d.week, sessionIdx: d.sessionIdx } });
        }
      });
      console.log(`    → aplicado (registros + actuals borrados).`);
    }
  }
  console.log(`\n${APPLY ? "Aplicado" : "Detectado"}: ${totalDrops} sesión(es).${APPLY ? "" : " Corré con --apply para limpiar."}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
