import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, vi } from "vitest";

vi.mock("../../../data/meClient", () => {
  const getMeSessions = vi.fn();
  return { getMeSessions, meClient: { getMeSessions } };
});

import * as me from "../../../data/meClient";
import { SemanaCard } from "../hoy/SemanaCard";

const MOCK_SESSIONS: import("@holy-oly/core").SessionView[] = [
  { week: 8, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64, actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false } }] },
  { week: 8, sessionIdx: 1, exercises: [{ movementId: "cargada", sets: 5, reps: 2, pct: 80, movementName: "Cargada", targetKg: 80 }] },
];

vi.mocked(me.getMeSessions).mockResolvedValue(MOCK_SESSIONS);

afterEach(() => vi.clearAllMocks());

function renderCard() {
  return render(
    <MemoryRouter initialEntries={["/atleta"]}>
      <Routes>
        <Route path="/atleta" element={<SemanaCard week={8} />} />
        <Route path="/atleta/entreno/:week/:idx" element={<div>ENTRENO</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("lista los días de la semana y navega al tocar uno", async () => {
  renderCard();
  expect(await screen.findByText(/Día 1/)).toBeInTheDocument();
  // Use aria-label to target the day-list button specifically (CTA also contains "Día 2")
  fireEvent.click(screen.getByRole("button", { name: "Día 2" }));
  await waitFor(() => expect(screen.getByText("ENTRENO")).toBeInTheDocument());
});

test("CTA primario apunta al siguiente día pendiente y navega", async () => {
  renderCard();
  // Día 1 está done, Día 2 está pendiente → CTA debe decir "Registrar entreno · Día 2"
  const cta = await screen.findByRole("button", { name: /Registrar entreno · Día 2/ });
  expect(cta).toBeInTheDocument();
  fireEvent.click(cta);
  await waitFor(() => expect(screen.getByText("ENTRENO")).toBeInTheDocument());
});

// ── Línea micro de la semana (recorrido D1) ──────────────────────────────────
test("con calentamiento en el acumulado → «~» en el total (rampa estimada, regla 06-11)", async () => {
  const KG_SESSIONS: import("@holy-oly/core").SessionView[] = [
    { week: 8, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64,
      warmup: [{ pct: 0, kg: 20, reps: 5, label: "barra" }],
      actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false,
        sets: [{ kg: 100, reps: 5, done: true }, { kg: 100, reps: 5, done: true }] } }] },
    { week: 8, sessionIdx: 1, exercises: [{ movementId: "cargada", sets: 5, reps: 2, pct: 80, movementName: "Cargada", targetKg: 80 }] },
  ];
  vi.mocked(me.getMeSessions).mockResolvedValueOnce(KG_SESSIONS);
  renderCard();
  // trabajo 1.000 + calentamiento 100 (rampa del ejercicio hecho) = ~1.100; 1 de 2 sesiones
  expect(await screen.findByText("Esta semana: ~1.100 kg · 1/2 sesiones")).toBeInTheDocument();
});

test("sin calentamiento (calentamientoKg === 0) → total exacto, SIN «~»", async () => {
  const SOLO_TRABAJO: import("@holy-oly/core").SessionView[] = [
    { week: 8, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64,
      actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false,
        sets: [{ kg: 100, reps: 5, done: true }, { kg: 100, reps: 5, done: true }] } }] },
    { week: 8, sessionIdx: 1, exercises: [{ movementId: "cargada", sets: 5, reps: 2, pct: 80, movementName: "Cargada", targetKg: 80 }] },
  ];
  vi.mocked(me.getMeSessions).mockResolvedValueOnce(SOLO_TRABAJO);
  renderCard();
  expect(await screen.findByText("Esta semana: 1.000 kg · 1/2 sesiones")).toBeInTheDocument();
});

test("sin kg movidos → no muestra la línea micro (0 → nada, sin culpa)", async () => {
  renderCard(); // MOCK_SESSIONS: hecho sin kg registrado → totalKg 0
  await screen.findByText(/Día 1/);
  expect(screen.queryByText(/Esta semana:/)).not.toBeInTheDocument();
});

// ── Agrupación por día real (D8) + fecha en días hechos (D1) ──────────────────
const exDone = () => ({
  movementId: "arranque", sets: 1, reps: 1, movementName: "Arranque",
  actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false },
});
const exPend = () => ({ movementId: "arranque", sets: 1, reps: 1, movementName: "Arranque" });

test("día doble: filas hermanas «Día 1 · AM» / «Día 1 · PM» (D6/D8)", async () => {
  const biDailySessions: import("@holy-oly/core").SessionView[] = [
    { week: 9, sessionIdx: 0, day: 1, turno: "AM", exercises: [exDone()] },
    { week: 9, sessionIdx: 1, day: 1, turno: "PM", exercises: [exPend()] },
    { week: 9, sessionIdx: 2, day: 2, exercises: [exPend()] },
  ];
  vi.mocked(me.getMeSessions).mockResolvedValueOnce(biDailySessions);
  renderCard();
  expect(await screen.findByText("Día 1 · AM")).toBeInTheDocument();
  expect(screen.getByText("Día 1 · PM")).toBeInTheDocument();
  expect(screen.getByText("Día 2")).toBeInTheDocument();
});

test("día hecho muestra su fecha; CTA usa day/turno del próximo pendiente", async () => {
  const fechaSessions: import("@holy-oly/core").SessionView[] = [
    { week: 9, sessionIdx: 0, fecha: "2026-06-09", exercises: [exDone()] },
    { week: 9, sessionIdx: 1, exercises: [exPend()] },
  ];
  vi.mocked(me.getMeSessions).mockResolvedValueOnce(fechaSessions);
  renderCard();
  expect(await screen.findByText(/hecho · 2026-06-09/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Registrar entreno · Día 2/ })).toBeInTheDocument();
});
