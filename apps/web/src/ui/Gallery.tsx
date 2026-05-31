import { useState } from "react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { Chip } from "./Chip";
import { Stepper } from "./Stepper";
import { WeekPicker } from "./WeekPicker";
import { DiscRow } from "./Disc";
import { Medal } from "./Medal";
import { MacroTimeline } from "./charts/MacroTimeline";

type Skin = "plates" | "neon" | "chalk" | "premium" | "neonlight";
const SKINS: Skin[] = ["plates", "neon", "chalk", "premium", "neonlight"];

const LABEL: React.CSSProperties = {
  fontFamily: "var(--mono, monospace)",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--wl-muted, #888)",
  marginBottom: 8,
  marginTop: 20,
};

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

export function Gallery() {
  const [skin, setSkin] = useState<Skin>("neon");
  const [stepperVal, setStepperVal] = useState(3);
  const [weekVal, setWeekVal] = useState(8);
  const [selectedChip, setSelectedChip] = useState<"A" | "B">("A");

  function applySkin(s: Skin) {
    setSkin(s);
    document.documentElement.className = "wl wl--" + s;
  }

  return (
    <div
      style={{
        maxWidth: 390,
        margin: "0 auto",
        padding: 16,
        color: "var(--wl-text)",
        background: "var(--wl-bg)",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <h1
        style={{
          fontFamily: "var(--wl-display, sans-serif)",
          fontSize: 22,
          fontWeight: 900,
          color: "var(--wl-accent)",
          marginBottom: 4,
          marginTop: 0,
        }}
      >
        Holy Oly · Gallery
      </h1>
      <p
        style={{
          fontFamily: "var(--mono, monospace)",
          fontSize: 10,
          color: "var(--wl-muted)",
          marginTop: 0,
          marginBottom: 16,
        }}
      >
        Design system verification — M2
      </p>

      {/* Theme switcher */}
      <div style={LABEL as React.CSSProperties}>Theme</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {SKINS.map((s) => (
          <button
            key={s}
            onClick={() => applySkin(s)}
            style={{
              fontFamily: "var(--mono, monospace)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid",
              cursor: "pointer",
              borderColor:
                s === skin ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 18%,transparent)",
              background: s === skin ? "var(--wl-accent)" : "transparent",
              color: s === skin ? "var(--wl-bg)" : "var(--wl-text)",
              fontWeight: s === skin ? 700 : 400,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Button */}
      <div style={LABEL as React.CSSProperties}>Button</div>
      <div style={{ ...SECTION_STYLE, flexDirection: "row", gap: 8 }}>
        <Button variant="primary">Primary</Button>
        <Button variant="ghost">Ghost</Button>
      </div>

      {/* Badge */}
      <div style={LABEL as React.CSSProperties}>Badge</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge tone="ok">OK</Badge>
        <Badge tone="warn">Vigilar</Badge>
        <Badge tone="alert">Alerta</Badge>
        <Badge>Default</Badge>
      </div>

      {/* Card */}
      <div style={LABEL as React.CSSProperties}>Card</div>
      <Card>
        <div
          style={{
            fontFamily: "var(--wl-display, sans-serif)",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--wl-text)",
            marginBottom: 4,
          }}
        >
          Semana 12 · Potencia
        </div>
        <div
          style={{
            fontFamily: "var(--mono, monospace)",
            fontSize: 11,
            color: "var(--wl-muted)",
          }}
        >
          Arrancada + Envión · 3×3 @ 85%
        </div>
      </Card>

      {/* Chip */}
      <div style={LABEL as React.CSSProperties}>Chip</div>
      <div style={{ display: "flex", gap: 8 }}>
        <Chip selected={selectedChip === "A"} onClick={() => setSelectedChip("A")}>
          Semana A
        </Chip>
        <Chip selected={selectedChip === "B"} onClick={() => setSelectedChip("B")}>
          Semana B
        </Chip>
      </div>

      {/* Stepper */}
      <div style={LABEL as React.CSSProperties}>Stepper</div>
      <Stepper value={stepperVal} onChange={setStepperVal} />

      {/* WeekPicker */}
      <div style={LABEL as React.CSSProperties}>WeekPicker</div>
      <WeekPicker weeks={16} value={weekVal} onChange={setWeekVal} />

      {/* DiscRow */}
      <div style={LABEL as React.CSSProperties}>DiscRow · 140 kg</div>
      <DiscRow kg={140} />

      {/* Medal */}
      <div style={LABEL as React.CSSProperties}>Medal</div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
        <div style={{ textAlign: "center" }}>
          <Medal metal="oro" size={48} />
          <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 9, color: "var(--wl-muted)", marginTop: 4 }}>
            Oro
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <Medal metal="plata" size={48} />
          <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 9, color: "var(--wl-muted)", marginTop: 4 }}>
            Plata
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <Medal metal="bronce" size={48} />
          <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 9, color: "var(--wl-muted)", marginTop: 4 }}>
            Bronce
          </div>
        </div>
      </div>

      {/* MacroTimeline */}
      <div style={LABEL as React.CSSProperties}>MacroTimeline</div>
      <Card>
        <MacroTimeline
          weeks={16}
          hoy={12}
          comps={[
            { name: "A", week: 12 },
            { name: "B", week: 16 },
          ]}
        />
      </Card>

      <div style={{ height: 32 }} />
    </div>
  );
}
