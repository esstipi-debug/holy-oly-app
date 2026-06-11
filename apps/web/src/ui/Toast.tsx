/**
 * Toast compartido — anclado al viewport (fixed), no al ancestro posicionado de turno.
 * `bottomOffset` default 78 deja libre el BottomNav; las pantallas sin nav pueden bajarlo.
 */
export function Toast({ message, show, bottomOffset = 78 }: {
  message: string;
  show: boolean;
  bottomOffset?: number;
}) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 14,
        right: 14,
        bottom: bottomOffset,
        zIndex: 41,
        maxWidth: 362,
        margin: "0 auto",
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
