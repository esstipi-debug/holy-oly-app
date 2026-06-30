import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminOverview, type AdminOverview, type AdminAthlete } from "../../admin/adminClient";
import { countryLabel } from "../../admin/country";
import { Loading } from "../../ui/Loading";
import { RetryButton } from "../../ui/RetryButton";

const MONO = "var(--mono)";
const muted = (size: number) => ({ fontFamily: MONO, fontSize: size, color: "var(--wl-muted)" });

function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "22px 0 11px" }}>
      <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13, letterSpacing: 1, color: "var(--wl-muted)", textTransform: "uppercase" }}>
        {children}
      </span>
      {count != null && <span style={muted(11)}>{count}</span>}
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
    </div>
  );
}

function RolePill({ role }: { role: "coach" | "atleta" }) {
  const isCoach = role === "coach";
  return (
    <span style={{ fontFamily: MONO, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 6px", borderRadius: 6, color: isCoach ? "var(--wl-bg)" : "var(--wl-text)", background: isCoach ? "var(--wl-accent)" : "color-mix(in srgb, var(--wl-text) 12%, transparent)" }}>
      {role}
    </span>
  );
}

/** Verde = verificado · ámbar = pendiente · gris = sin cuenta de usuario propia. */
function VerifiedDot({ verified }: { verified: boolean | null }) {
  const color = verified == null ? "var(--wl-muted)" : verified ? "var(--wl-success, #36c275)" : "var(--wl-warn, #e0a23b)";
  const title = verified == null ? "sin cuenta" : verified ? "email verificado" : "email pendiente";
  return <span title={title} aria-label={title} style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}

function AthleteLine({ a }: { a: AdminAthlete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid color-mix(in srgb, var(--wl-text) 8%, transparent)" }}>
      <VerifiedDot verified={a.emailVerified} />
      <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, color: "var(--wl-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {a.nombre}
        {a.compite && <span style={{ ...muted(9.5), marginLeft: 6 }}>compite</span>}
      </span>
      <span style={muted(10.5)}>{a.nivel}</span>
      <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--wl-text)", minWidth: 96, textAlign: "right" }}>{countryLabel(a.country)}</span>
    </div>
  );
}

export function AdminScreen() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let on = true;
    setLoading(true);
    setError(null);
    getAdminOverview()
      .then((d) => { if (on) { setData(d); setLoading(false); } })
      .catch((e: unknown) => { if (on) { setError(e instanceof Error ? e.message : "error"); setLoading(false); } });
    return () => { on = false; };
  }, [reload]);

  return (
    <div className="wl wl--legend" style={{ minHeight: "100vh", background: "var(--wl-bg)", color: "var(--wl-text)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 18px 40px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 24, letterSpacing: -0.4 }}>Panel</h1>
          <Link to="/" style={{ ...muted(11), color: "var(--wl-accent)", textDecoration: "none" }}>‹ Volver</Link>
        </div>
        <p style={{ ...muted(11), margin: "0 0 4px" }}>Usuarios registrados y vínculos atleta ↔ coach.</p>

        {loading ? (
          <Loading style={{ fontFamily: MONO, fontSize: 11, padding: "24px 0" }}>Cargando…</Loading>
        ) : error ? (
          <div role="alert" style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--wl-danger)", padding: "20px 0" }}>
            No se pudo cargar el panel ({error}).{" "}
            <RetryButton onClick={() => setReload((r) => r + 1)} />
          </div>
        ) : data ? (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <Stat label="usuarios" value={data.totals.users} />
              <Stat label="coaches" value={data.totals.coaches} />
              <Stat label="atletas" value={data.totals.athletes} />
              <Stat label="sin coach" value={data.totals.athletes - data.totals.linkedAthletes} />
            </div>

            <SectionTitle count={data.users.length}>Usuarios registrados</SectionTitle>
            <div>
              {data.users.map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid color-mix(in srgb, var(--wl-text) 8%, transparent)" }}>
                  <VerifiedDot verified={u.emailVerified} />
                  <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{u.email}</span>
                  <RolePill role={u.role} />
                  <span style={{ fontFamily: MONO, fontSize: 10.5, minWidth: 96, textAlign: "right" }}>{countryLabel(u.country)}</span>
                  <span style={{ ...muted(10), minWidth: 64, textAlign: "right" }}>{new Date(u.createdAt).toLocaleDateString("es")}</span>
                </div>
              ))}
            </div>

            <SectionTitle count={data.coaches.length}>Atletas por coach</SectionTitle>
            {data.coaches.length === 0 && <p style={muted(11)}>Todavía no hay coaches.</p>}
            {data.coaches.map((c) => (
              <div key={c.id} style={{ border: "1px solid color-mix(in srgb, var(--wl-text) 14%, transparent)", borderRadius: 12, padding: "11px 13px", marginBottom: 10, background: "color-mix(in srgb, var(--wl-text) 3%, transparent)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10.5 }}>{countryLabel(c.country)}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "var(--wl-accent)", color: "var(--wl-bg)" }}>{c.athleteCount}</span>
                </div>
                {c.email && <div style={{ ...muted(10.5), marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>}
                <div style={{ marginTop: 6 }}>
                  {c.athletes.length === 0
                    ? <div style={{ ...muted(10.5), padding: "6px 0" }}>Sin atletas vinculados.</div>
                    : c.athletes.map((a) => <AthleteLine key={a.id} a={a} />)}
                </div>
              </div>
            ))}

            {data.unlinkedAthletes.length > 0 && (
              <>
                <SectionTitle count={data.unlinkedAthletes.length}>Atletas sin coach</SectionTitle>
                <div style={{ border: "1px solid color-mix(in srgb, var(--wl-text) 14%, transparent)", borderRadius: 12, padding: "4px 13px 8px", background: "color-mix(in srgb, var(--wl-text) 3%, transparent)" }}>
                  {data.unlinkedAthletes.map((a) => <AthleteLine key={a.id} a={a} />)}
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: "1 1 80px", minWidth: 80, border: "1px solid color-mix(in srgb, var(--wl-text) 14%, transparent)", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: "var(--wl-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  );
}
