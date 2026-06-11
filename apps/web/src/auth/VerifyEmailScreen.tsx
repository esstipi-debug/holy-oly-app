import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "./authClient";

export function VerifyEmailScreen() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");

  useEffect(() => {
    if (!token) return;
    void verifyEmail(token)
      .then(() => setState("ok"))
      .catch(() => setState("err"));
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "var(--wl-bg)" }}>
      <div style={{ maxWidth: 360, textAlign: "center" }}>
        {!token && <p>Enlace inválido.</p>}
        {token && state === "idle" && <p>Verificando email…</p>}
        {state === "ok" && <p>Email verificado. Ya podés seguir usando Holy Oly.</p>}
        {state === "err" && <p>El enlace expiró o ya fue usado.</p>}
        <Link to="/login" style={{ display: "inline-block", marginTop: 12, fontFamily: "var(--mono)", fontSize: 12 }}>Ir al login</Link>
      </div>
    </div>
  );
}
