import { useParams } from "react-router-dom";
export function DrilldownPlaceholder() {
  const { id } = useParams();
  return (
    <div style={{ padding: 24, color: "var(--wl-text)", fontFamily: "var(--wl-display)" }}>
      <h1 style={{ color: "var(--wl-accent)" }}>Drill-down · {id}</h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>Pantalla del atleta (M4).</p>
    </div>
  );
}
