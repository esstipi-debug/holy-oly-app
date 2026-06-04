import type { CSSProperties } from "react";
import { simplerVariants, substitutesOf, getMovement } from "@holy-oly/core";
import { BottomSheet } from "./BottomSheet";

const item: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "9px 12px",
  borderRadius: 10,
  marginTop: 6,
  border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)",
  background: "var(--wl-surface)",
  color: "var(--wl-text)",
  fontFamily: "var(--wl-display)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const grp: CSSProperties = {
  fontFamily: "var(--wl-display)",
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--wl-muted)",
  marginTop: 14,
};

const empty: CSSProperties = {
  fontFamily: "var(--wl-display)",
  fontSize: 12,
  color: "var(--wl-muted)",
  marginTop: 6,
};

/** SP1-guided movement swap: "bajar complejidad" (simpler variants of the same base) +
 *  "sustituir" (alternative movements). Shared by the coach editor and the athlete Entreno.
 *  Uses only --wl-* / --wl-display tokens so it renders correctly in both shells.
 *
 *  Self-close contract: calls `onPick(id)` then `onClose()` on selection — the sheet
 *  self-closes on pick; callers only handle the pick, they need not close it. */
export function SubstituteSheet({
  open,
  onClose,
  movementId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  movementId: string;
  onPick: (id: string) => void;
}) {
  const simpler = simplerVariants(movementId);
  const subs = substitutesOf(movementId);

  const choose = (id: string): void => {
    onPick(id);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Cambiar movimiento">
      <div
        style={{
          fontFamily: "var(--wl-display)",
          fontWeight: 800,
          fontSize: 18,
          color: "var(--wl-text)",
        }}
      >
        Cambiar movimiento
      </div>
      <div
        style={{
          fontFamily: "var(--wl-display)",
          fontSize: 12,
          color: "var(--wl-muted)",
          marginTop: 2,
        }}
      >
        Actual: {getMovement(movementId)?.name ?? movementId}
      </div>
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        <div style={grp}>Bajar complejidad</div>
        {simpler.length > 0 ? (
          simpler.map((m) => (
            <button
              key={m.id}
              type="button"
              style={item}
              onClick={() => choose(m.id)}
            >
              {m.name}
            </button>
          ))
        ) : (
          <div style={empty}>Sin variantes más simples.</div>
        )}
        <div style={grp}>Sustituir por</div>
        {subs.length > 0 ? (
          subs.map((m) => (
            <button
              key={m.id}
              type="button"
              style={item}
              onClick={() => choose(m.id)}
            >
              {m.name}
            </button>
          ))
        ) : (
          <div style={empty}>Sin sustitutos sugeridos.</div>
        )}
      </div>
    </BottomSheet>
  );
}
