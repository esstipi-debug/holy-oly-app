import type { DayLog, DayLogInput } from "@holy-oly/core";
import type { CheckinVariant } from "./prefs";

// Stub — full implementation lands in Task D7 (Unit 5). HomeScreen only renders this when the
// check-in overlay is open, which the Home tests do not trigger.
export function CheckIn(_props: {
  variant: CheckinVariant;
  initial?: DayLog | null;
  onClose: () => void;
  onDone: (input: DayLogInput) => void | Promise<void>;
}) {
  return null;
}
