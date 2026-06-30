import { describe, it, expect, afterEach } from "vitest";
import { adminEmails, isAdminEmail } from "./admin";

const ORIGINAL = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

describe("adminEmails", () => {
  it("is empty (closed) when unset", () => {
    delete process.env.ADMIN_EMAILS;
    expect(adminEmails().size).toBe(0);
  });

  it("parses a comma list, trimming and lowercasing", () => {
    process.env.ADMIN_EMAILS = " Owner@Holyoly.dev , second@x.com ,, ";
    expect([...adminEmails()].sort()).toEqual(["owner@holyoly.dev", "second@x.com"]);
  });
});

describe("isAdminEmail", () => {
  it("is false for null/undefined/empty regardless of config", () => {
    process.env.ADMIN_EMAILS = "owner@holyoly.dev";
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("matches case-insensitively", () => {
    process.env.ADMIN_EMAILS = "owner@holyoly.dev";
    expect(isAdminEmail("OWNER@holyoly.dev")).toBe(true);
    expect(isAdminEmail("owner@holyoly.dev")).toBe(true);
  });

  it("is false for non-admin emails and when unconfigured", () => {
    process.env.ADMIN_EMAILS = "owner@holyoly.dev";
    expect(isAdminEmail("intruder@x.com")).toBe(false);
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("owner@holyoly.dev")).toBe(false);
  });
});
