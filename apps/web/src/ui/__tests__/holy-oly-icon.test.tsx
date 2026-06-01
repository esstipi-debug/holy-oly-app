import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { holyOlyIconSvg } from "../holyOlyIconSvg";
import { HolyOlyIcon } from "../HolyOlyIcon";

describe("holyOlyIconSvg (builder)", () => {
  it("renders a 512 viewBox red plate with the HOLY/OLY wordmark by default", () => {
    const s = holyOlyIconSvg({ uid: "t" });
    expect(s).toContain('viewBox="0 0 512 512"');
    expect(s).toContain("#d8262d"); // competition red
    expect(s).toContain(">HOLY</textPath>");
    expect(s).toContain(">OLY</textPath>");
    expect(s).toContain("Saira Condensed"); // brand font for the curved text
  });

  it("drops the wordmark (no font dependency) when withText is false", () => {
    const s = holyOlyIconSvg({ uid: "t", withText: false });
    expect(s).not.toContain("<textPath");
    expect(s).not.toContain(">HOLY</textPath>");
    expect(s).toContain("#d8262d"); // the plate is still the red master
  });

  it("namespaces gradient ids by uid so multiple instances don't collide", () => {
    expect(holyOlyIconSvg({ uid: "abc" })).toContain('id="bandabc"');
    expect(holyOlyIconSvg({ uid: "xyz" })).toContain('id="bandxyz"');
  });
});

describe("HolyOlyIcon (component)", () => {
  it("mounts an inline svg with the brand aria-label", () => {
    const { container } = render(<HolyOlyIcon size={64} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-label")).toMatch(/holy oly/i);
  });

  it("renders two instances with distinct gradient ids", () => {
    const { container } = render(
      <>
        <HolyOlyIcon />
        <HolyOlyIcon />
      </>,
    );
    const grads = Array.from(container.querySelectorAll("[id^='band']"));
    expect(grads.length).toBe(2);
    expect(grads[0]?.id).not.toBe(grads[1]?.id);
  });
});
