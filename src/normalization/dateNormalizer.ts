import * as chrono from "chrono-node";
import { DateTime } from "luxon";

export function normalizeDateTime(
  datePhrase: string | null,
  timePhrase: string | null,
  referenceDate: Date = new Date()
): { date: string | null; time: string | null; confidence: number; issues: string[] } {
  const issues: string[] = [];
  const combined = [datePhrase, timePhrase].filter(Boolean).join(" ");

  if (!combined) {
    return { date: null, time: null, confidence: 0, issues: ["no date or time provided"] };
  }

  const results = chrono.parse(combined, referenceDate, { forwardDate: true });

  if (results.length === 0) {
    return { date: null, time: null, confidence: 0, issues: ["could not parse date/time"] };
  }
  if (results.length > 1) {
    issues.push("multiple conflicting date/time phrases detected");
  }

  const parsedDate = results[0].start.date();
  const dt = DateTime.fromJSDate(parsedDate).setZone("Asia/Kolkata");

  // Guardrail: reject dates resolved to the past
  // Note: we use referenceDate to check against "now" in case of testing with a fixed reference
  const now = DateTime.fromJSDate(referenceDate).setZone("Asia/Kolkata");
  // We only check if the day is strictly before today (ignoring time for this check to be safe, 
  // or we could check the exact DateTime)
  if (dt < now) {
    issues.push("resolved date is in the past");
  }

  // Guardrail: no explicit time and no AM/PM marker
  const hasTimeComponent = results[0].start.isCertain("hour");
  if (!hasTimeComponent) {
    issues.push("time could not be confidently determined");
  } else {
      // Check if AM/PM was explicit. If not, it's ambiguous.
      // Chrono usually infers AM/PM if not provided (e.g. 3 -> 3am).
      // We can check if 'meridiem' is certain.
      const isMeridiemCertain = results[0].start.isCertain("meridiem");
      if (!isMeridiemCertain) {
          // Documented business heuristic: default to PM for hours 1-7 without a marker
          // But flag confidence lower
          const hour = results[0].start.get("hour");
          if (hour !== null && hour >= 1 && hour <= 7) {
              issues.push("missing AM/PM marker - applying business hours heuristic (defaulting to PM)");
              // Adjust time to PM
              dt.set({ hour: hour + 12 });
          } else {
              issues.push("missing AM/PM marker");
          }
      }
  }

  const confidence = issues.length === 0 ? 0.9 : Math.max(0.3, 0.9 - issues.length * 0.2);

  return {
    date: dt.toFormat("yyyy-MM-dd"),
    time: hasTimeComponent ? dt.toFormat("HH:mm") : null,
    confidence,
    issues,
  };
}
