import { useEffect, type ReactNode } from "react";
import { useFocusTrap } from "./useFocusTrap";

// Scroll-lock con sheets ANIDADOS (SessionEditor abre MovementPicker encima): contador a nivel
// módulo — sólo el PRIMER sheet abierto guarda/pisa el overflow del body y sólo el ÚLTIMO en
// cerrarse lo restaura. Sin esto, el cleanup del sheet interior restauraba el scroll con el
// exterior todavía abierto.
let lockCount = 0;
let prevOverflow = "";

export function BottomSheet({
  open,
  onClose,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  // WCAG 2.2: move focus into the sheet on open, trap it, restore it to the trigger on close.
  const dialogRef = useFocusTrap(open);
  // ARIA dialog pattern / WCAG 2.1.2: Escape dismisses the modal. Re-subscribes per render so the
  // latest onClose is used (no stale closure); cheap and correct for an open modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  // Modal de viewport (overlay fixed): bloquear el scroll del body mientras está abierto —
  // sin esto el contenido de atrás sigue scrolleable debajo del backdrop.
  useEffect(() => {
    if (!open) return;
    if (++lockCount === 1) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (--lockCount === 0) document.body.style.overflow = prevOverflow;
    };
  }, [open]);
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        // fixed (no absolute): el sheet ancla SIEMPRE al viewport, no al ancestro posicionado
        // de turno — antes el backdrop cubría sólo el primer viewport en pantallas largas.
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 40,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460, // misma columna que .ho-shell/.ho-nav — en desktop no se estira al viewport
          background: "var(--wl-surface)",
          borderRadius: "var(--wl-radius) var(--wl-radius) 0 0",
          padding: "16px 16px 18px",
          maxHeight: "90%",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}
