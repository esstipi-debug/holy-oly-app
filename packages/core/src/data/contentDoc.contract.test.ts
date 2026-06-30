import { describe, test, expect } from "vitest";
import { validatePublishedContentDoc } from "./contentDoc";

const VALID: Record<string, unknown> = {
  id: "sleep-morning-light",
  slug: "luz-matinal-y-rendimiento",
  lang: "es",
  title: "Luz matinal y rendimiento",
  summary: "Exponerse a luz natural temprano ordena el reloj biológico.",
  topic: "circadian_rhythm",
  tags: ["sueño"],
  states: ["warn"],
  items: ["sueno"],
  body: "Ver luz natural dentro de los 30–60 minutos de despertarte ayuda al reloj biológico.",
  primary_sources: [{ title: "Light as a central modulator", year: 2017, doi: "10.1038/nrn.2016.171" }],
  applications: { weightlifting: ["Sostiene energía para fuerza temprano"] },
  contraindications: [],
};

describe("validatePublishedContentDoc", () => {
  test("doc publicado limpio pasa sin violaciones", () => {
    expect(validatePublishedContentDoc(VALID)).toEqual([]);
  });

  test("rechaza provenance embarcada", () => {
    const errs = validatePublishedContentDoc({ ...VALID, _provenance: { huermn_card: "x" } });
    expect(errs.some((e) => e.includes("provenance"))).toBe(true);
  });

  test("rechaza nombrar la fuente o mencionar RPE (intocables)", () => {
    const named = validatePublishedContentDoc({ ...VALID, body: "Según Huberman, ver luz..." });
    expect(named.some((e) => e.includes("banned"))).toBe(true);
    const rpe = validatePublishedContentDoc({ ...VALID, summary: "mantené RPE 8" });
    expect(rpe.some((e) => e.includes("banned"))).toBe(true);
  });

  test("rechaza campos requeridos faltantes", () => {
    const { body, ...noBody } = VALID;
    expect(validatePublishedContentDoc(noBody).some((e) => e.includes("body"))).toBe(true);
  });
});
