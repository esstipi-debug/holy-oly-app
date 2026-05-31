export function Toast({ message, show }: { message: string; show: boolean }) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        bottom: 16,
        zIndex: 41,
        background: "var(--wl-accent)",
        color: "var(--wl-bg)",
        fontFamily: "var(--wl-display)",
        fontWeight: 700,
        fontSize: 13,
        padding: "13px 16px",
        borderRadius: 12,
        textAlign: "center",
        boxShadow: "0 14px 40px -12px rgba(0,0,0,.7)",
      }}
    >
      {message}
    </div>
  );
}
