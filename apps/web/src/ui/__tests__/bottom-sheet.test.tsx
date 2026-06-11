import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { BottomSheet } from "../BottomSheet";

/** A trigger that opens a sheet with two focusable children, closed by the backdrop.
 *  Mirrors how every real sheet (CompSheet, AssignSheet, SubstituteSheet, …) uses BottomSheet. */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="Hoja">
        <button type="button">Primero</button>
        <button type="button">Segundo</button>
      </BottomSheet>
    </div>
  );
}

/** A sheet whose content has no focusable children (e.g. WeekDetailSheet with perWeek === 0). */
function StaticHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="Estática">
        <p>Solo texto, sin elementos enfocables.</p>
      </BottomSheet>
    </div>
  );
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
}

test("mueve el foco al interior del diálogo al abrir", () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Abrir" });
  trigger.focus();

  open();

  const dialog = screen.getByRole("dialog");
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Primero" }),
  );
});

test("devuelve el foco al disparador al cerrar", () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Abrir" });
  trigger.focus();
  open();

  // While open, focus must have moved off the trigger and into the dialog —
  // otherwise "returns to trigger" would pass trivially without any restore logic.
  expect(document.activeElement).not.toBe(trigger);
  expect(
    screen.getByRole("dialog").contains(document.activeElement),
  ).toBe(true);

  // Close by clicking the backdrop (the dialog's parent overlay).
  const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
  fireEvent.click(backdrop);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.activeElement).toBe(trigger);
});

test("Escape cierra el diálogo y devuelve el foco al disparador", () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Abrir" });
  trigger.focus();
  open();
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  fireEvent.keyDown(window, { key: "Escape" });

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.activeElement).toBe(trigger);
});

test("atrapa Tab: desde el último elemento vuelve al primero", () => {
  render(<Harness />);
  open();
  const primero = screen.getByRole("button", { name: "Primero" });
  const segundo = screen.getByRole("button", { name: "Segundo" });

  segundo.focus();
  fireEvent.keyDown(segundo, { key: "Tab" });

  expect(document.activeElement).toBe(primero);
});

test("atrapa Shift+Tab: desde el primer elemento va al último", () => {
  render(<Harness />);
  open();
  const primero = screen.getByRole("button", { name: "Primero" });
  const segundo = screen.getByRole("button", { name: "Segundo" });

  primero.focus();
  fireEvent.keyDown(primero, { key: "Tab", shiftKey: true });

  expect(document.activeElement).toBe(segundo);
});

// W6/D8 (verificado en W8): el sheet es un modal fixed de viewport — abierto bloquea el scroll
// del body, cerrado/desmontado restaura EXACTAMENTE el valor previo (no lo pisa con "").
test("abrir bloquea el scroll del body y cerrar lo restaura", () => {
  render(<Harness />);
  expect(document.body.style.overflow).toBe("");

  open();
  expect(document.body.style.overflow).toBe("hidden");

  fireEvent.keyDown(window, { key: "Escape" });
  expect(document.body.style.overflow).toBe("");
});

test("desmontar con el sheet abierto restaura el overflow previo del body", () => {
  document.body.style.overflow = "scroll"; // valor previo no-vacío: el cleanup no debe pisarlo
  const { unmount } = render(<Harness />);
  open();
  expect(document.body.style.overflow).toBe("hidden");

  unmount();
  expect(document.body.style.overflow).toBe("scroll");
  document.body.style.overflow = "";
});

// Sheets ANIDADOS (SessionEditor abre MovementPicker encima): el scroll-lock usa un contador a
// nivel módulo — cerrar el primero NO restaura el overflow mientras el otro siga abierto.
test("dos sheets abiertos: cerrar el primero deja el body bloqueado; cerrar el segundo restaura", () => {
  function TwoSheets() {
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setA(true)}>Abrir A</button>
        <button type="button" onClick={() => setB(true)}>Abrir B</button>
        <BottomSheet open={a} onClose={() => setA(false)} ariaLabel="Hoja A">
          <button type="button" onClick={() => setA(false)}>Cerrar A</button>
        </BottomSheet>
        <BottomSheet open={b} onClose={() => setB(false)} ariaLabel="Hoja B">
          <button type="button" onClick={() => setB(false)}>Cerrar B</button>
        </BottomSheet>
      </div>
    );
  }
  document.body.style.overflow = "scroll"; // valor previo no-vacío: la restauración final no debe pisarlo
  render(<TwoSheets />);

  fireEvent.click(screen.getByRole("button", { name: "Abrir A" }));
  fireEvent.click(screen.getByRole("button", { name: "Abrir B" }));
  expect(document.body.style.overflow).toBe("hidden");

  // cerrar el primero → el segundo sigue abierto → el body sigue bloqueado
  fireEvent.click(screen.getByRole("button", { name: "Cerrar A" }));
  expect(document.body.style.overflow).toBe("hidden");

  // cerrar el segundo (el último) → recién ahí se restaura el overflow previo
  fireEvent.click(screen.getByRole("button", { name: "Cerrar B" }));
  expect(document.body.style.overflow).toBe("scroll");
  document.body.style.overflow = "";
});

test("sin hijos enfocables enfoca el contenedor y Tab no lo abandona", () => {
  render(<StaticHarness />);
  open();
  const dialog = screen.getByRole("dialog");

  // Fallback: focus lands on the dialog container itself (it has tabIndex={-1})…
  expect(document.activeElement).toBe(dialog);

  // …and Tab keeps focus on it rather than escaping the modal (no keyboard trap escape).
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(document.activeElement).toBe(dialog);
});
