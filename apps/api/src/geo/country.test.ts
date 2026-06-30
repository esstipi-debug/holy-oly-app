import { describe, it, expect } from "vitest";
import { isPublicIp, normalizeCountry, countryFromIp } from "./country";

describe("isPublicIp", () => {
  it("rejects empty/missing values", () => {
    expect(isPublicIp(undefined)).toBe(false);
    expect(isPublicIp(null)).toBe(false);
    expect(isPublicIp("")).toBe(false);
  });

  it("rejects loopback and localhost", () => {
    expect(isPublicIp("127.0.0.1")).toBe(false);
    expect(isPublicIp("::1")).toBe(false);
    expect(isPublicIp("localhost")).toBe(false);
  });

  it("rejects RFC1918 private ranges", () => {
    expect(isPublicIp("10.0.0.5")).toBe(false);
    expect(isPublicIp("192.168.1.20")).toBe(false);
    expect(isPublicIp("172.16.0.1")).toBe(false);
    expect(isPublicIp("172.31.255.255")).toBe(false);
    expect(isPublicIp("169.254.1.1")).toBe(false);
  });

  it("accepts public ranges outside 172.16/12", () => {
    expect(isPublicIp("172.32.0.1")).toBe(true);
    expect(isPublicIp("172.15.0.1")).toBe(true);
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("190.190.1.1")).toBe(true);
  });

  it("rejects IPv6 private/link-local but accepts public IPv6", () => {
    expect(isPublicIp("fc00::1")).toBe(false);
    expect(isPublicIp("fd12::1")).toBe(false);
    expect(isPublicIp("fe80::1")).toBe(false);
    expect(isPublicIp("2800:3f0::1")).toBe(true);
  });

  it("normalizes IPv6-mapped IPv4 before the private check", () => {
    expect(isPublicIp("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicIp("::ffff:8.8.8.8")).toBe(true);
  });
});

describe("normalizeCountry", () => {
  it("uppercases and validates alpha-2", () => {
    expect(normalizeCountry("ar")).toBe("AR");
    expect(normalizeCountry(" cl ")).toBe("CL");
  });

  it("returns null for anything that is not a 2-letter code", () => {
    expect(normalizeCountry("")).toBeNull();
    expect(normalizeCountry("ARG")).toBeNull();
    expect(normalizeCountry("1A")).toBeNull();
    expect(normalizeCountry(undefined)).toBeNull();
    expect(normalizeCountry(42)).toBeNull();
  });
});

describe("countryFromIp", () => {
  it("never hits the network under NODE_ENV=test (returns null)", async () => {
    // NODE_ENV is "test" in vitest → short-circuits before any fetch.
    await expect(countryFromIp("8.8.8.8")).resolves.toBeNull();
  });

  it("returns null for private/missing IPs", async () => {
    await expect(countryFromIp(undefined)).resolves.toBeNull();
    await expect(countryFromIp("127.0.0.1")).resolves.toBeNull();
  });
});
