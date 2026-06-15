import { render, screen, fireEvent } from "@testing-library/react";
import { vi, beforeEach } from "vitest";
import type { MePlanView, MeRecorrido, MonitorSeries, MeHeatDays } from "@holy-oly/core";

vi.mock("../../../data/meClient", () => {
  const getMeSeries = vi.fn();
  const getMeRecorrido = vi.fn();
  const getMeHeatDays = vi.fn();
  const getMePlan = vi.fn();
  const getMeMacroHistory = vi.fn();
  return { getMeSeries, getMeRecorrido, getMeHeatDays, getMePlan, getMeMacroHistory, meClient: { getMeSeries, getMeRecorrido, getMeHeatDays, getMePlan, getMeMacroHistory } };
});
import * as me from "../../../data/meClient";
import { ProgresoScreen } from "../ProgresoScreen";

const SERIES: MonitorSeries = {
  weeks: 5,
  acute: [300, 320, 360, 700, 380],
  hrv: [72, 71, 70, 64, 69], hrvBase: 70,
  rhr: [50, 50, 51, 55, 50], rhrBase: 50,
  imr: [70, 72, 74, 86, 80],
  wellness: [82, 80, 78, 60, 70],
  recovery: [85, 84, 80, 62, 72],
  bodyweight: [81.1, 81.0, 80.8, 80.6, 80.7],
  weightBand: [80, 81],
};

const RECORRIDO: MeRecorrido = {
  semanas: [
    { week: 1, trabajoKg: 1000, calentamientoKg: 200, sesionesHechas: 3, sesionesTotales: 5 },
    { week: 2, trabajoKg: 800, calentamientoKg: 150, sesionesHechas: 2, sesionesTotales: 5 },
    { week: 3, trabajoKg: 0, calentamientoKg: 0, sesionesHechas: 0, sesionesTotales: 5 },
  ],
};

// Heatdays mínimo (rediseño 0110): una semana de días vacíos + un día entrenado. Sin macro →
// ventanas Año + 12 sem. Suficiente para verificar que el carrusel monta el MAPA DE CALOR.
const heatDay = (iso: string, over: Partial<MeHeatDays["weeks"][number]["days"][number]> = {}): MeHeatDays["weeks"][number]["days"][number] =>
  ({ iso, future: false, today: false, trained: false, kg: 0, sessions: 0, wellness: null, bw: null, hrv: null, rhr: null, ...over });
const HEATDAYS: MeHeatDays = {
  today: "2026-06-10",
  weeks: [{
    startIso: "2026-06-08",
    days: [
      heatDay("2026-06-08", { trained: true, kg: 8200, sessions: 1, wellness: 78, bw: 80.5, hrv: 70, rhr: 50 }),
      heatDay("2026-06-09"), heatDay("2026-06-10", { today: true }), heatDay("2026-06-11", { future: true }),
      heatDay("2026-06-12", { future: true }), heatDay("2026-06-13", { future: true }), heatDay("2026-06-14", { future: true }),
    ],
  }],
  anchorWeekIdx: 0, macroFromIdx: -1, macroToIdx: -1, weightBand: [80, 81], hrvBase: 70, rhrBase: 50,
};

const PLAN_NULL: MePlanView = { athlete: { nombre: "Kevin", iniciales: "KV", sexo: "M" }, plan: null };
const PLAN_W2: MePlanView = {
  athlete: { nombre: "Kevin", iniciales: "KV", sexo: "M" },
  plan: { macroName: "Ruso 5D", totalWeeks: 16, currentWeek: 2, currentPhase: "Fuerza", phases: [], comps: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: recorrido vacío → la card no aparece (los tests del recorrido la sobreescriben).
  vi.mocked(me.getMeRecorrido).mockResolvedValue({ semanas: [] });
  // Default: sin plan → la card degrada con gracia (sin marca de HOY ni atenuación).
  vi.mocked(me.getMePlan).mockResolvedValue(PLAN_NULL);
  // Default: sin ciclos cerrados → la card "Tus ciclos" no aparece.
  vi.mocked(me.getMeMacroHistory).mockResolvedValue({ entries: [], cyclesDone: 0, avgAdherencePct: 0 });
  // Default: mapa de calor con datos (rediseño 0110); los tests lo sobreescriben si hace falta.
  vi.mocked(me.getMeHeatDays).mockResolvedValue(HEATDAYS);
});

test("con serie: carrusel con Camino + las 4 señales, en voz de atleta (sin copy de coach)", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  render(<ProgresoScreen />);
  // Camino es el primer slide (activo)
  expect(await screen.findByText("Camino a la competencia")).toBeInTheDocument();
  // las 4 señales están en el carrusel (todas montadas; las inactivas quedan aria-hidden)
  expect(screen.getByText("Tu carga")).toBeInTheDocument();
  expect(screen.getByText("Tu recuperación")).toBeInTheDocument();
  expect(screen.getByText("Tu bienestar")).toBeInTheDocument();
  expect(screen.getByText("Tu peso")).toBeInTheDocument();
  // navegación por dots (uno por señal)
  expect(screen.getByRole("tab", { name: "carga" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "peso" })).toBeInTheDocument();
  // coach-voiced title must NOT appear
  expect(screen.queryByText("Carga aguda vs crónica")).not.toBeInTheDocument();
});

test("con heatdays: la señal activa muestra el MAPA DE CALOR (ventanas + leyenda), no la línea", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  const { container } = render(<ProgresoScreen />);
  await screen.findByText("Camino a la competencia");
  // navego al slide de Carga → su mapa de calor queda visible (los demás siguen aria-hidden)
  fireEvent.click(screen.getByRole("tab", { name: "carga" }));
  // control de ventana del heatmap (no existe en el gráfico de línea viejo)
  expect(screen.getByRole("tab", { name: "12 sem" })).toBeInTheDocument();
  expect(screen.getAllByText("competencia").length).toBeGreaterThanOrEqual(1);
  // intocable: ni una mención de RPE en toda la pantalla
  expect(container.textContent ?? "").not.toMatch(/\brpe\b/i);
});

test("la «i» de carga no enseña ACWR (regla del atleta) y no hay RPE en pantalla", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  const { container } = render(<ProgresoScreen />);
  await screen.findByText("Camino a la competencia");
  // sin RPE en NINGUNA superficie del atleta (intocable)
  expect(container.textContent ?? "").not.toMatch(/\brpe\b/i);
  // navego al slide de Carga (su ⓘ deja de estar aria-hidden) y abro el "cómo se lee"
  fireEvent.click(screen.getByRole("tab", { name: "carga" }));
  fireEvent.click(screen.getByRole("button", { name: "Cómo se lee: Tu carga" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog.textContent ?? "").not.toMatch(/acwr/i);
});

test("sin serie: estado vacío honesto, sin gráficos", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  render(<ProgresoScreen />);
  expect(await screen.findByText(/Cuando registres/i)).toBeInTheDocument();
  expect(screen.queryByText("Tu carga")).not.toBeInTheDocument();
});

test("error de red: muestra role=alert, sin gráficos", async () => {
  vi.mocked(me.getMeSeries).mockRejectedValue(new Error("network"));
  render(<ProgresoScreen />);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText("Tu carga")).not.toBeInTheDocument();
});

test("sin bodyweight: no hay pill ni gráfico de «Tu peso»", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue({ ...SERIES, bodyweight: undefined, weightBand: undefined });
  render(<ProgresoScreen />);
  await screen.findByText("Tu carga");
  expect(screen.queryByRole("button", { name: "Peso" })).not.toBeInTheDocument();
  expect(screen.queryByText("Tu peso")).not.toBeInTheDocument();
});

// ── Card «Tu recorrido» (recorrido D1, altura macro) ─────────────────────────
test("con recorrido: card con total acumulado, desglose y semanas con registro (es-CL)", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  vi.mocked(me.getMeRecorrido).mockResolvedValue(RECORRIDO);
  render(<ProgresoScreen />);
  expect(await screen.findByText("Tu recorrido")).toBeInTheDocument();
  expect(screen.getByText("2.150")).toBeInTheDocument(); // 1.000+200+800+150
  expect(screen.getByText(/trabajo 1\.800 kg · calentamiento ~350 kg/)).toBeInTheDocument();
  expect(screen.getByText(/2 semanas con registro/)).toBeInTheDocument();
});

test("recorrido vacío → la card no se renderiza (sin culpa)", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  render(<ProgresoScreen />); // default: { semanas: [] }
  await screen.findByText("Tu carga");
  expect(screen.queryByText("Tu recorrido")).not.toBeInTheDocument();
});

test("recorrido sin monitoreo: la card aparece igual junto al estado vacío", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  vi.mocked(me.getMeRecorrido).mockResolvedValue(RECORRIDO);
  render(<ProgresoScreen />);
  expect(await screen.findByText(/Cuando registres/i)).toBeInTheDocument();
  expect(await screen.findByText("Tu recorrido")).toBeInTheDocument();
});

test("error del recorrido → alert con Reintentar; el retry recupera la card", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  vi.mocked(me.getMeRecorrido)
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(RECORRIDO);
  render(<ProgresoScreen />);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText("2.150")).toBeInTheDocument();
});

// ── Detail-on-tap + marca de HOY (review de dominio 06-11) ───────────────────
test("tap en una barra → detalle role=status; tocar la misma la cierra; sin tooltips (title)", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  vi.mocked(me.getMeRecorrido).mockResolvedValue(RECORRIDO);
  const { container } = render(<ProgresoScreen />);
  await screen.findByText("Tu recorrido");
  // rulebook §4: tap, no hover — ninguna barra (ni nada de la pantalla) lleva `title`
  expect(container.querySelector("[title]")).toBeNull();
  const barra = screen.getByRole("button", { name: "Semana 1: 1.200 kg" });
  fireEvent.click(barra);
  expect(screen.getByRole("status")).toHaveTextContent("Semana 1 · 1.200 kg · 3/5 sesiones");
  // toggle: tocar otra semana cambia el detalle…
  fireEvent.click(screen.getByRole("button", { name: "Semana 2: 950 kg" }));
  expect(screen.getByRole("status")).toHaveTextContent("Semana 2 · 950 kg · 2/5 sesiones");
  // …y tocar la misma lo cierra
  fireEvent.click(screen.getByRole("button", { name: "Semana 2: 950 kg" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("con plan: la semana actual lleva marca de HOY y las futuras van atenuadas", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  vi.mocked(me.getMeRecorrido).mockResolvedValue(RECORRIDO);
  vi.mocked(me.getMePlan).mockResolvedValue(PLAN_W2); // currentWeek = 2
  render(<ProgresoScreen />);
  await screen.findByText("Tu recorrido");
  const hoy = screen.getByRole("button", { name: "Semana 2: 950 kg" });
  expect(hoy).toHaveAttribute("aria-current", "step");
  // tick bajo la barra de HOY en var(--wl-accent)
  expect((hoy.lastElementChild as HTMLElement).style.background).toBe("var(--wl-accent)");
  // futura (> currentWeek): atenuada (no debe leerse como semana fallada) y sin marca
  const futura = screen.getByRole("button", { name: "Semana 3: 0 kg" });
  expect(futura).not.toHaveAttribute("aria-current");
  expect((futura.firstElementChild as HTMLElement).style.opacity).toBe("0.35");
  // pasada-sin-registro queda con la muted normal, NO atenuada extra
  const pasada = screen.getByRole("button", { name: "Semana 1: 1.200 kg" });
  expect((pasada.firstElementChild as HTMLElement).style.opacity).toBe("1");
});

test("sin plan (o plan caído): sin marca de HOY ni atenuación — la card degrada con gracia", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  vi.mocked(me.getMeRecorrido).mockResolvedValue(RECORRIDO);
  vi.mocked(me.getMePlan).mockRejectedValue(new Error("network"));
  render(<ProgresoScreen />);
  await screen.findByText("Tu recorrido");
  expect(screen.getByText("2.150")).toBeInTheDocument(); // el recorrido sobrevive sin plan
  for (const name of ["Semana 1: 1.200 kg", "Semana 2: 950 kg", "Semana 3: 0 kg"]) {
    const barra = screen.getByRole("button", { name });
    expect(barra).not.toHaveAttribute("aria-current");
    expect((barra.firstElementChild as HTMLElement).style.opacity).toBe("1");
  }
});
