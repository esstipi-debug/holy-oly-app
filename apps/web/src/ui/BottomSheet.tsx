import { useEffect, type ReactNode } from "react";
import { useFocusTrap } from "./useFocusTrap";

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
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        alignItems: "flex-end",
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
          background: "var(--wl-surface)",
          borderRadius: "18px 18px 0 0",
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
