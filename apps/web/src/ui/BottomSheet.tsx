import type { ReactNode } from "react";

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
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
