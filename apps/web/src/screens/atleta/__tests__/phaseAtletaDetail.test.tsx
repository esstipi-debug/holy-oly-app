import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MACROCYCLES, type SessionView } from "@holy-oly/core";
import { PhaseAtletaDetail } from "../PhaseAtletaDetail";
import type { MeClient } from "../../../data/meClient";

const macro = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
const PHASE = { name: "Hipertrofia", from: 1, to: 4, imrLo: 65, imrHi: 72, volRel: 100, focus: "hipertrofia · GPP" };
const session = (week: number, kg = 56): SessionView => ({
  week, sessionIdx: 0, exercises: [{ movementId: "arranque", movementName: "Arranque", sets: 5, reps: 2, pct: 70, targetKg: kg }],
});

function stubClient(over: Partial<MeClient> = {}): MeClient {
  return {
    getMePlan: async () => ({ athlete: { nombre: "A", iniciales: "A", sexo: "F" as const }, plan: null }),
    getMeSeries: async () => undefined,
    getDayLog: async () => ({ entry: null, streak: 0, days: [], today: "2026-06-10" }),
    putDayLog: async () => ({ entry: { date: "2026-06-10", fatiga: 3, dolor: 1, estres: 2, humor: 4, motivacion: 4, sueno: 4 }, streak: 1 }),
    getMeSessions: async (week: number) => [session(week)],
    getMeHeat: async () => [],
    getMeRecorrido: async () => ({ semanas: [] }),
    putMeSession: async () => {},
    getMeCycle: async () => ({ share: "none" as const, state: "regular" as const }),
    putMeCycle: async () => {},
    ...over,
  };
}

test("con macro: muestra «qué vas a trabajar» desde el ADN de la escuela", () => {
  render(<PhaseAtletaDetail phase={PHASE} macro={macro} currentWeek={2} />);
  expect(screen.getByText("Sobre esta fase")).toBeInTheDocument();
  expect(screen.getByText("Qué vas a trabajar")).toBeInTheDocument();
});

test("semana tipo con kg+discos REALES vía /me/sessions(phase.from), DiscRow oficial, sin RPE", async () => {
  const calls: number[] = [];
  const client = stubClient({ getMeSessions: async (w: number) => { calls.push(w); return [session(w, 56)]; } });
  const { container } = render(<PhaseAtletaDetail phase={PHASE} macro={macro} client={client} sexo="F" currentWeek={2} />);
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
  expect(screen.getByText("56 kg")).toBeInTheDocument();
  expect(container.querySelectorAll("svg").length).toBeGreaterThan(0); // DiscRow dibuja discos
  expect(calls).toContain(1); // phase.from = 1, la semana representativa
  // \b: token RPE real, no el ruido de concatenación (textContent une "posterior"+"Peso" → "rPe").
  expect(container.textContent ?? "").not.toMatch(/\brpe\b/i);
});

test("sin macro: omite el ADN sin romper; el «qué significa %» sigue presente", () => {
  render(<PhaseAtletaDetail phase={PHASE} macro={null} currentWeek={2} />);
  expect(screen.queryByText("Qué vas a trabajar")).not.toBeInTheDocument();
  expect(screen.getByText(/qué significa 65–72% de tus marcas/)).toBeInTheDocument();
});

test("«qué significa %» es TAP (HR-2): el toggle muestra/oculta la explicación", () => {
  render(<PhaseAtletaDetail phase={PHASE} macro={macro} currentWeek={2} />);
  expect(screen.queryByText(/porcentaje de tus marcas/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /qué significa/ }));
  expect(screen.getByText(/porcentaje de tus marcas/i)).toBeInTheDocument();
});

test("error de carga → mensaje honesto + Reintentar (sin falso-verde)", async () => {
  let fail = true;
  const client = stubClient({ getMeSessions: async (w: number) => { if (fail) throw new Error("boom"); return [session(w)]; } });
  render(<PhaseAtletaDetail phase={PHASE} macro={macro} client={client} sexo="F" currentWeek={2} />);
  expect(await screen.findByText(/No se pudo cargar/)).toBeInTheDocument();
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
});

test("sin sesiones (sin receta) → omite la sección entera, sin encabezado huérfano", async () => {
  const client = stubClient({ getMeSessions: async () => [] });
  render(<PhaseAtletaDetail phase={PHASE} macro={macro} client={client} sexo="F" currentWeek={2} />);
  await waitFor(() => expect(screen.queryByText("Cómo se ve un entreno típico")).not.toBeInTheDocument());
});
