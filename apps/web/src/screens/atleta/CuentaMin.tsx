import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { VinculoEstado } from "@holy-oly/core";
import { useAuth } from "../../auth/AuthContext";
import * as vc from "../../data/vinculoClient";
import { exportMe, deleteMyAccount } from "../../data/meClient";
import { useAtletaCtx } from "./AthleteShell";
import { CicloSection } from "./CicloSection";

const HO_SKINS: Array<{ id: string; nm: string; sw: [string, string, string] }> = [
  { id: "neon", nm: "Neon PR", sw: ["#07070f", "#c8ff2d", "#1fe7ff"] },
  { id: "neonlight", nm: "Neon Bloom", sw: ["#fdeef6", "#ff2e9a", "#8a5cff"] },
  { id: "plates", nm: "Plates", sw: ["#15171a", "#e23b2e", "#2274d4"] },
  { id: "premium", nm: "Premium", sw: ["#0d1016", "#e9b365", "#37d6b8"] },
  { id: "chalk", nm: "Chalk", sw: ["#e7e3d8", "#ff5400", "#2b59ff"] },
];

/** Estado real del vínculo (W5/D7): en API consulta GET /me/vinculo y rinde 3 ramas
 *  (activo / pendiente / sin vínculo → form). En demo no hay vínculo real → card estática. */
function VincularSection() {
  const { apiEnabled } = useAuth();
  const [code, setCode] = useState("");
  const [estado, setEstado] = useState<VinculoEstado | null>(null);
  const [coachNombre, setCoachNombre] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!apiEnabled) return;
    let on = true;
    vc.getMyVinculo()
      .then((v) => {
        if (!on) return;
        if (v) { setEstado(v.estado); setCoachNombre(v.coachNombre); }
        setLoaded(true);
      })
      .catch(() => {
        // Error del fetch → caemos al form con una línea muted; no bloquea la pantalla.
        if (on) { setFetchFailed(true); setLoaded(true); }
      });
    return () => { on = false; };
  }, [apiEnabled]);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await vc.acceptCode(code.trim().toUpperCase());
      setEstado(r.estado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  if (!apiEnabled) {
    return (
      <div className="ho-acct__group">
        <div className="ho-acct__label">Mi coach</div>
        <div className="ho-card">
          <b style={{ fontFamily: "var(--wl-display)" }}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "var(--ok)", marginRight: 7 }} />
            Vinculada a tu coach (demo)
          </b>
          <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>En la app real acá ves el estado del vínculo.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ho-acct__group">
      <div className="ho-acct__label">Mi coach</div>
      {!loaded ? (
        <div className="ho-card"><div className="ho-acct__rowsub">Cargando…</div></div>
      ) : estado === "activo" ? (
        <div className="ho-card">
          <b style={{ fontFamily: "var(--wl-display)" }}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "var(--ok)", marginRight: 7 }} />
            Tu coach: {coachNombre}
          </b>
          <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>Vínculo activo — tu coach ve tu entrenamiento.</div>
        </div>
      ) : estado === "pendiente" ? (
        <div className="ho-card">
          <b style={{ fontFamily: "var(--wl-display)" }}>Solicitud enviada ✓</b>
          <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>Esperando confirmación de tu coach.</div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="ho-card">
          {fetchFailed && (
            <div className="ho-acct__rowsub" style={{ marginBottom: 8 }}>No pudimos cargar el estado de tu vínculo — igual podés enviar un código.</div>
          )}
          <div className="ho-acct__rowsub" style={{ marginBottom: 10 }}>Ingresá el código que te pasó tu coach. Cuando lo confirme, queda hecho el vínculo.</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CÓDIGO"
            aria-label="Código de invitación"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: "var(--wl-radius)", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 18, letterSpacing: ".18em", textAlign: "center" }}
          />
          {error && <div role="alert" style={{ color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11, marginTop: 10 }}>{error}</div>}
          <button type="submit" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 12 }} disabled={busy || !code.trim()}>
            {busy ? "..." : "Enviar solicitud"}
          </button>
        </form>
      )}
    </div>
  );
}

/** "Tus datos" (W5/D6): las promesas de Privacidad se cumplen — export y borrado contra los
 *  endpoints reales (GET /me/export · DELETE /me/account). 100% API: en demo NO se muestra. */
function TusDatosSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onExport(): Promise<void> {
    setExporting(true);
    setExportError(null);
    try {
      const data = await exportMe();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "holy-oly-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("No se pudo exportar. Probá de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  async function onDelete(): Promise<void> {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      // El server ya mató la sesión (clearCookie); el logout local sólo limpia el estado del front.
      await logout().catch(() => undefined);
      navigate("/login");
    } catch {
      setDeleteError("No se pudo eliminar la cuenta. Probá de nuevo.");
      setDeleting(false);
    }
  }

  return (
    <div className="ho-acct__group">
      <div className="ho-acct__label">Tus datos</div>
      <div className="ho-card">
        <div className="ho-acct__rowsub" style={{ marginBottom: 10 }}>Todo lo tuyo es tuyo: bajalo cuando quieras o borralo para siempre.</div>
        <button type="button" className="wl-btn wl-btn--ghost" style={{ width: "100%" }} disabled={exporting} onClick={() => void onExport()}>
          {exporting ? "Exportando…" : "Exportar mis datos"}
        </button>
        {exportError && <div role="alert" style={{ color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11, marginTop: 8 }}>{exportError}</div>}

        {!confirming ? (
          <button type="button" className="wl-btn wl-btn--ghost" style={{ width: "100%", marginTop: 10, color: "var(--wl-danger)" }} onClick={() => setConfirming(true)}>
            Eliminar mi cuenta
          </button>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div role="alert" style={{ color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.5 }}>
              ¿Segura? Esto borra todo y no se puede deshacer.
            </div>
            <button
              type="button"
              className="wl-btn"
              style={{ width: "100%", marginTop: 8, background: "var(--wl-danger)", color: "var(--wl-bg)", border: 0 }}
              disabled={deleting}
              onClick={() => void onDelete()}
            >
              {deleting ? "Eliminando…" : "Sí, eliminar definitivamente"}
            </button>
            <button type="button" className="wl-btn wl-btn--ghost" style={{ width: "100%", marginTop: 8 }} disabled={deleting} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
            {deleteError && <div role="alert" style={{ color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11, marginTop: 8 }}>{deleteError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function CuentaMin() {
  const { apiEnabled, user, logout } = useAuth();
  const { skin, setSkin, variant, setVariant } = useAtletaCtx();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  function onLogout(): void {
    setLogoutError(null);
    logout().catch(() => setLogoutError("No se pudo cerrar la sesión. Probá de nuevo."));
  }
  return (
    <>
      <div className="ho-greet"><div className="ho-greet__h">Cuenta</div><div className="ho-greet__s">tus datos son tuyos</div></div>

      {apiEnabled && user && (
        <div className="ho-acct__group">
          <div className="ho-acct__label">Tu cuenta</div>
          <div className="ho-card">
            {/* /auth/me no expone el nombre de la atleta todavía — el email ES la identidad de la cuenta. */}
            <b style={{ fontFamily: "var(--wl-display)", overflowWrap: "anywhere" }}>{user.email ?? "Sin email"}</b>
            <div className="ho-acct__rowsub" style={{ marginTop: 4 }}>Sesión activa · atleta</div>
          </div>
        </div>
      )}

      <VincularSection />

      <div className="ho-acct__group">
        <div className="ho-acct__label">Check-in · interacción</div>
        <div className="ho-seg">
          {([["tap", "Toque"], ["dial", "Dial"]] as const).map(([v, l]) => (
            <button key={v} className={variant === v ? "on" : ""} onClick={() => setVariant(v)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="ho-acct__group">
        <div className="ho-acct__label">Apariencia · skin</div>
        <div className="ho-skins">
          {HO_SKINS.map((s) => (
            <button key={s.id} className={"ho-skin" + (skin === s.id ? " on" : "")} onClick={() => setSkin(s.id)} aria-label={`Skin ${s.nm}`}>
              <div className="ho-skin__sw">{s.sw.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
              <div className="ho-skin__nm">{s.nm}</div>
            </button>
          ))}
        </div>
      </div>

      <CicloSection />

      {apiEnabled && <TusDatosSection />}

      {apiEnabled && (
        <div className="ho-acct__group">
          <button type="button" onClick={onLogout} className="wl-btn wl-btn--ghost" style={{ width: "100%", color: "var(--wl-danger)" }}>Cerrar sesión</button>
          {logoutError && (
            <div role="alert" style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>{logoutError}</div>
          )}
        </div>
      )}

      <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", margin: "22px 0 4px", lineHeight: 1.5 }}>
        <Link to="/privacidad" style={{ color: "inherit" }}>Privacidad</Link>
        {" · "}
        <Link to="/terminos" style={{ color: "inherit" }}>Términos</Link>
      </div>
      <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", margin: "0 0 4px", letterSpacing: ".04em" }}>
        HOLY OLY · smart training · zero burnout
      </div>
    </>
  );
}
