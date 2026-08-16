import { describe, test, expect } from "vitest";
import { programmableName } from "@holy-oly/core";
import { composeMovementName } from "./movementName";

/**
 * El composer de nombres de movimiento es la base de la Fase 5d (nomenclatura EN/ES). Invariante
 * clave: en ES devuelve EXACTAMENTE lo mismo que el core (programmableName) — así ninguna superficie
 * cambia de comportamiento en español. En EN compone con el orden gramatical inglés (glosario §4).
 */
describe("composeMovementName", () => {
  test("es delega en el core verbatim (cero drift)", () => {
    for (const id of [
      "arranque", "arranque.potencia.colgado.rodilla", "envion.tijera",
      "tiron-arranque.bloques.rodilla", "sentadilla-frente", "cargada-envion",
      "cx.cargada+frontal+2t", "cx.tiron-arranque+arranque",
    ]) {
      expect(composeMovementName(id, "es")).toBe(programmableName(id));
    }
  });

  test("en compone la base + modificadores en orden inglés (sentence-case)", () => {
    expect(composeMovementName("arranque", "en")).toBe("Snatch");
    expect(composeMovementName("arranque.potencia", "en")).toBe("Power snatch");
    expect(composeMovementName("arranque.potencia.colgado.rodilla", "en")).toBe("Hang power snatch (knee)");
    expect(composeMovementName("tiron-arranque.bloques.rodilla", "en")).toBe("Block snatch pull (knee)");
    expect(composeMovementName("envion.tijera", "en")).toBe("Split jerk");
    expect(composeMovementName("envion.empuje", "en")).toBe("Push jerk");
    expect(composeMovementName("sentadilla-frente", "en")).toBe("Front squat");
    expect(composeMovementName("cargada-envion", "en")).toBe("Clean and jerk");
  });

  test("en usa los nombres curados de complejos (notación intacta)", () => {
    expect(composeMovementName("cx.cargada+frontal+2t", "en")).toBe("Clean + Front squat + Jerk (1+1+1)");
    expect(composeMovementName("cx.tiron-arranque+arranque", "en")).toBe("Snatch pull + Snatch (2+1)");
  });

  test("id desconocido → se devuelve tal cual (fallback honesto)", () => {
    expect(composeMovementName("no-existe", "en")).toBe("no-existe");
    expect(composeMovementName("cx.no-existe", "en")).toBe("cx.no-existe");
  });
});
