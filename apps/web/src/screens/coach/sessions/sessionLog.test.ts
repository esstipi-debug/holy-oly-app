import type { SessionLog } from "@holy-oly/core";
import { applyToggle, markFor, nextStatus, weekDone } from "./sessionLog";

test("nextStatus cycles pending → done → missed → pending", () => {
  expect(nextStatus(undefined)).toBe("done");
  expect(nextStatus("done")).toBe("missed");
  expect(nextStatus("missed")).toBeUndefined();
});

test("applyToggle adds, then changes, then removes a mark on repeated taps", () => {
  let log: SessionLog = [];
  log = applyToggle(log, 8, 2); // pending → done
  expect(markFor(log, 8, 2)).toBe("done");
  log = applyToggle(log, 8, 2); // done → missed
  expect(markFor(log, 8, 2)).toBe("missed");
  log = applyToggle(log, 8, 2); // missed → pending (removed)
  expect(markFor(log, 8, 2)).toBeUndefined();
  expect(log).toEqual([]);
});

test("applyToggle leaves other sessions untouched", () => {
  const next = applyToggle([{ week: 8, idx: 0, status: "done" }], 8, 1);
  expect(markFor(next, 8, 0)).toBe("done");
  expect(markFor(next, 8, 1)).toBe("done");
});

test("weekDone counts done sessions in a week", () => {
  const log: SessionLog = [
    { week: 8, idx: 0, status: "done" },
    { week: 8, idx: 1, status: "missed" },
    { week: 8, idx: 2, status: "done" },
    { week: 9, idx: 0, status: "done" },
  ];
  expect(weekDone(log, 8)).toBe(2);
  expect(weekDone(log, 9)).toBe(1);
});
