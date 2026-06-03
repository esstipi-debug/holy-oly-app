/** A2 lands the real "Mi progreso" (charts vs su normal + HR-2 sheets). A1 ships an honest stub. */
export function ProgresoPlaceholder() {
  return (
    <>
      <div className="ho-greet"><div className="ho-greet__h">Mi progreso</div><div className="ho-greet__s">tus tendencias vs tu propia normal</div></div>
      <div className="ho-card">
        <div className="ho-nodata">
          <div className="ho-nodata__icon">·</div>
          <div className="ho-nodata__t">Llega pronto</div>
          <div className="ho-nodata__b">Acá vas a ver tu carga, tu recuperación vs tu normal y cómo venís — con el contexto de cómo leer cada gráfico.</div>
        </div>
      </div>
    </>
  );
}
