import { calendarWeeks } from "@holy-oly/core";

function CalendarHeatmap({ days, today }: { days: string[]; today: string }) {
  const set = new Set(days);
  const grid = calendarWeeks(today, 8);
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <div>
      <div className="ho-calhd">{labels.map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="ho-cal">
        {grid.flatMap((week) =>
          week.map((date) => {
            const cls = date > today ? "fut" : set.has(date) ? "on" : "miss";
            return <div key={date} className={`ho-cal__c ${cls}`} title={date} />;
          }),
        )}
      </div>
    </div>
  );
}

/** Racha + heatmap. Empty (no logged days) → honest "tu racha empieza hoy". */
export function ConstanciaCard({ streak, days, today }: { streak: number; days: string[]; today: string }) {
  if (days.length === 0) {
    return (
      <div className="ho-card">
        <div className="ho-card__head"><span className="ho-card__t">Constancia de registro</span></div>
        <div className="ho-nodata">
          <div className="ho-nodata__icon">·</div>
          <div className="ho-nodata__t">Tu racha empieza hoy</div>
          <div className="ho-nodata__b">Registrá un día y arranca a contar. El descanso planificado no la rompe.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="ho-card">
      <div className="ho-card__head"><span className="ho-card__t">Constancia de registro</span></div>
      <div className="ho-card__sub">filas = semanas · 7 columnas = días</div>
      <div className="ho-streak">
        <b>{streak}</b>
        <span>días de racha<br />el descanso no la rompe</span>
      </div>
      <CalendarHeatmap days={days} today={today} />
    </div>
  );
}
