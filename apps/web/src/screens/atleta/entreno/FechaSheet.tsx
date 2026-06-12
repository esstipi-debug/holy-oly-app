import { useState, type CSSProperties } from "react";
import { BottomSheet } from "../../../ui/BottomSheet";

const addDays = (iso: string, d: number): string =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + d * 86_400_000)
    .toISOString()
    .slice(0, 10);

const mono: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  color: "var(--wl-muted)",
};

/** Selector de la fecha del entreno (spec 2026-06-12 D2/D5). Aparece SOLO al entrar con hoy
 *  ocupada (motivo "conflicto") o al tocar «Entreno del … ▾» (motivo "editar"). Tap, jamás
 *  hover; jamás futuro (input max=hoy); ocupada elegida a mano → bloquea confirmar con copy
 *  honesto; fuera de la semana del plan → AVISO suave, deja pasar (D2). */
export function FechaSheet({
  open,
  hoy,
  ocupadas,
  motivo,
  fueraDeSemana,
  onPick,
  onClose,
}: {
  open: boolean;
  hoy: string;
  ocupadas: string[];
  motivo: "conflicto" | "editar";
  fueraDeSemana?: (fecha: string) => boolean;
  onPick: (fecha: string) => void;
  onClose: () => void;
}) {
  const [manual, setManual] = useState<string>("");
  const ayer = addDays(hoy, -1);
  const ocupada = manual !== "" && ocupadas.includes(manual);
  const fuera = manual !== "" && !ocupada && (fueraDeSemana?.(manual) ?? false);

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Fecha del entreno">
      <div
        style={{
          fontFamily: "var(--wl-display)",
          fontWeight: 800,
          fontSize: 18,
          color: "var(--wl-text)",
        }}
      >
        {motivo === "conflicto"
          ? "Ya registraste un entreno hoy"
          : "¿Cuándo hiciste este entreno?"}
      </div>
      <div style={{ ...mono, marginTop: 6 }}>
        {motivo === "conflicto"
          ? "Este registro necesita su propia fecha — ¿cuándo lo hiciste?"
          : "El registro queda con la fecha real del entreno."}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {!ocupadas.includes(hoy) && (
          <button
            type="button"
            className="wl-btn wl-btn--primary"
            style={{ flex: 1 }}
            onClick={() => onPick(hoy)}
          >
            Hoy
          </button>
        )}
        {!ocupadas.includes(ayer) && (
          <button
            type="button"
            className="wl-btn"
            style={{ flex: 1 }}
            onClick={() => onPick(ayer)}
          >
            Ayer
          </button>
        )}
      </div>
      <label style={{ ...mono, display: "block", marginTop: 14 }}>
        Elegir fecha
        <input
          type="date"
          max={hoy}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: "var(--wl-radius)",
            border:
              "1px solid color-mix(in srgb,var(--wl-text) 14%,transparent)",
            background: "var(--wl-bg)",
            color: "var(--wl-text)",
            fontFamily: "var(--mono)",
            fontSize: 13,
            boxSizing: "border-box",
          }}
        />
      </label>
      {ocupada && (
        <div
          role="alert"
          style={{ ...mono, color: "var(--wl-danger)", marginTop: 8 }}
        >
          Esa fecha ya tiene un entreno registrado.
        </div>
      )}
      {fuera && (
        <div role="status" style={{ ...mono, marginTop: 8 }}>
          Ojo: queda fuera de la semana del plan — se permite igual.
        </div>
      )}
      <button
        type="button"
        className="wl-btn wl-btn--primary"
        disabled={manual === "" || ocupada}
        style={{
          width: "100%",
          marginTop: 12,
          opacity: manual === "" || ocupada ? 0.5 : 1,
        }}
        onClick={() => {
          if (manual !== "" && !ocupada) onPick(manual);
        }}
      >
        Usar esta fecha
      </button>
    </BottomSheet>
  );
}
