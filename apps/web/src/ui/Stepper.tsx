const BTN: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 14%,transparent)",
  background: "transparent",
  color: "var(--wl-text)",
  fontFamily: "var(--wl-display)",
  fontWeight: 800,
  fontSize: 18,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export function Stepper({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button type="button" style={BTN} onClick={() => onChange(value - step)}>−</button>
      <span
        style={{
          fontFamily: "var(--wl-display)",
          fontWeight: 800,
          fontSize: 18,
          color: "var(--wl-text)",
          minWidth: 32,
          textAlign: "center",
        }}
      >
        {value}
      </span>
      <button type="button" style={BTN} onClick={() => onChange(value + step)}>+</button>
    </div>
  );
}
