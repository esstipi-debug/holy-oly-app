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

interface DropTarget { week: number; sessionIdx: number; fecha: string; estado: string; reason: string }

async function analyzeAthlete(athleteId: string): Promise<DropTarget[]> {
  const plan = await prisma.plan.findUnique({ where: { athleteId } });
  const registros = await prisma.sessionRegistro.findMany({ where: { athleteId }, orderBy: [{ week: "asc" }, { sessionIdx: "asc" }] });
  if (registros.length === 0) return [];
  const macro = plan ? MACROCYCLES.find((m) => m.id === plan.macroId) : undefined;
  const pres = await prisma.prescribedExercise.findMany({ where: { athleteId }, select: { week: true, sessionIdx: true } });

  // dayOf por semana (layout de la receta; sin layout → día = idx+1).
  const dayOfFor = (week: number) => {
    const layout = macro ? dayLayoutFor(macro, week) : null;
    return (idx: number): number => layout?.[idx]?.day ?? idx + 1;
  };
  // Todos los sessionIdx prescriptos por semana.
  const idxsByWeek = new Map<number, Set<number>>();
  for (const p of pres) {
    if (!idxsByWeek.has(p.week)) idxsByWeek.set(p.week, new Set());
    idxsByWeek.get(p.week)!.add(p.sessionIdx);
  }

  const drops: DropTarget[] = [];
  const weeks = [...new Set(registros.map((r) => r.week))].sort((a, b) => a - b);
  for (const week of weeks) {
    const dayOf = dayOfFor(week);
    const weekRegs = registros.filter((r) => r.week === week);
    const resolved = new Set(weekRegs.map((r) => r.sessionIdx));
    // allIdxs: prescripción si existe; si no, los propios registros (defensivo).
    const allIdxs = [...(idxsByWeek.get(week) ?? new Set(weekRegs.map((r) => r.sessionIdx)))];
    const days = [...new Set(allIdxs.map(dayOf))].sort((a, b) => a - b);

    // Primer día NO totalmente resuelto (alguna de sus sesiones sin registro) → cutoff.
    let cutoff = Infinity;
    for (const d of days) {
      const dayIdxs = allIdxs.filter((i) => dayOf(i) === d);
      const fullyResolved = dayIdxs.every((i) => resolved.has(i));
      if (!fullyResolved) { cutoff = d; break; }
    }
    // Violación de secuencia: sesión resuelta en un día POSTERIOR al cutoff.
    for (const r of weekRegs) {
      if (dayOf(r.sessionIdx) > cutoff) {
        drops.push({ week, sessionIdx: r.sessionIdx, fecha: r.fecha, estado: r.estado, reason: `día ${dayOf(r.sessionIdx)} resuelto con el día ${cutoff} sin terminar` });
      }
    }

    // Violación 1×fecha: dos registros NO anulados, misma fecha, distinto día → conservar el día menor.
    const kept = weekRegs.filter((r) => !drops.some((d) => d.week === week && d.sessionIdx === r.sessionIdx));
    const byFecha = new Map<string, typeof kept>();
    for (const r of kept) {
      if (r.estado === "anulado") continue;
      if (!byFecha.has(r.fecha)) byFecha.set(r.fecha, []);
      byFecha.get(r.fecha)!.push(r);
    }
    for (const [fecha, rs] of byFecha) {
      const dias = new Set(rs.map((r) => dayOf(r.sessionIdx)));
      if (dias.size <= 1) continue; // mismo día (AM/PM) → permitido
      const minDay = Math.min(...rs.map((r) => dayOf(r.sessionIdx)));
      for (const r of rs) {
        if (dayOf(r.sessionIdx) > minDay) {
          drops.push({ week, sessionIdx: r.sessionIdx, fecha, estado: r.estado, reason: `fecha ${fecha} compartida por días distintos (1×fecha)` });
        }
      }
    }
  }
  return drops;
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
