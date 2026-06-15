/** Radar poligonal de bienestar: Hoy (relleno) vs tu Promedio (punteado). Valores 0..1 por vértice.
 *  Si no hay datos del día (caso común — el autorreporte vive en DayLog), el caller muestra el
 *  empty-state. `avg: null` = no hay histórico semanal → se dibuja SÓLO Hoy (jamás un promedio falso). */
export interface RadarData { labels: string[]; today: number[]; avg: number[] | null }

export function Radar({ size = 180, data }: { size?: number; data: RadarData }) {
  const { labels, today, avg } = data;
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 30;
  const n = labels.length;
  const ang = (i: number): number => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number): [number, number] => [cx + R * v * Math.cos(ang(i)), cy + R * v * Math.sin(ang(i))];
  const polyStr = (arr: number[]): string => arr.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1].map((r) => labels.map((_, i) => pt(i, r).map((x) => x.toFixed(1)).join(",")).join(" "));

  return (
    <svg className="cel-radar__svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={avg ? "Tu bienestar de hoy vs tu promedio" : "Tu bienestar de hoy"}>
      {rings.map((pts, i) => <polygon key={`r${i}`} className="rd-ring" points={pts} />)}
      {labels.map((_, i) => { const [x, y] = pt(i, 1); return <line key={`s${i}`} className="rd-spoke" x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} />; })}
      {avg && <polygon className="rd-avg" points={polyStr(avg)} />}
      <polygon className="rd-today" points={polyStr(today)} />
      {today.map((v, i) => { const [x, y] = pt(i, v); return <circle key={`d${i}`} className="rd-dot" cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.2" />; })}
      {labels.map((lab, i) => {
        const [x, y] = pt(i, 1.22);
        const anchor = Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end";
        const dy = y < cy - 6 ? -2 : y > cy + 6 ? 9 : 3;
        return <text key={`l${i}`} className="rd-label" x={x.toFixed(1)} y={(y + dy).toFixed(1)} textAnchor={anchor}>{lab}</text>;
      })}
    </svg>
  );
}
