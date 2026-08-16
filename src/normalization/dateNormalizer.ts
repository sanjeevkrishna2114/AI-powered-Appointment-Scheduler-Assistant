import * as chrono from "chrono-node";
import { DateTime } from "luxon";

const TIMEZONE = "Asia/Kolkata";

// Explicit past-tense markers — chrono's `forwardDate: true` option will
// aggressively push ambiguous dates into the future, which incorrectly
// overrides genuinely explicit past-tense phrases like "last Friday".
// We check for these independently rather than trusting forwardDate alone.
const PAST_TENSE_MARKERS = /\b(last|previous|yesterday|earlier this)\b/i;

// Colon/minute notation (e.g. "11:00", "15:30") is conventionally
// unambiguous 24-hour format — it does NOT need an AM/PM marker to be
// resolved confidently. Only BARE hour mentions ("at 11", "at 3") are
// genuinely ambiguous without a meridiem marker.
const HAS_COLON_TIME = /\d{1,2}:\d{2}/;

export interface NormalizationResult {
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  tz: string;
  confidence: number;
  issues: string[];
  suggestedTime?: string; // populated when a heuristic guess is offered but not auto-applied
}

/**
 * Apply a business-hours heuristic to a bare, meridiem-ambiguous hour.
 * Only applies to the 1-7 band, where PM is overwhelmingly the plausible
 * reading for a clinic appointment (e.g. "at 3" -> almost certainly 3pm,
 * not 3am). Hours 8-12 are left unresolved — genuinely could go either way
 * for a clinic, so we don't guess.
 */
function applyAmPmHeuristic(hour24Guess: number): { suggestedHour: number | null; isHeuristic: boolean } {
  if (hour24Guess >= 1 && hour24Guess <= 7) {
    return { suggestedHour: hour24Guess + 12, isHeuristic: true };
  }
  return { suggestedHour: null, isHeuristic: false };
}

export function normalizeDateTime(
  datePhrase: string | null,
  timePhrase: string | null,
  referenceDate: Date = new Date()
): NormalizationResult {
  const issues: string[] = [];
  let confidence = 1.0;
  let suggestedTime: string | undefined;

  let combined = [datePhrase, timePhrase].filter(Boolean).join(" ");

  if (!combined.trim()) {
    return {
      date: null,
      time: null,
      tz: TIMEZONE,
      confidence: 0,
      issues: ["no date or time provided"],
    };
  }

  // ── Fix: Help chrono parse bare digits as hours ────────────────────────
  // If the LLM extracts just "3", chrono ignores it. If we prefix "at ",
  // chrono correctly parses it as an hour.
  if (timePhrase && /^\d{1,2}$/.test(timePhrase.trim())) {
    combined = [datePhrase, `at ${timePhrase.trim()}`].filter(Boolean).join(" ");
  }

  // ── Explicit past-tense check, independent of chrono's forwardDate ────
  // chrono's forwardDate option aggressively resolves ambiguous dates into
  // the future, which will silently override an explicit "last Friday" /
  // "yesterday" style phrase. We catch that here BEFORE trusting chrono's
  // output, since forwardDate makes chrono blind to this specific case.
  const referencesPast = PAST_TENSE_MARKERS.test(datePhrase ?? "");

  // ── Parse with chrono ───────────────────────────────────────────────────
  const results = chrono.parse(combined, referenceDate, { forwardDate: true });

  if (results.length === 0) {
    return {
      date: null,
      time: null,
      tz: TIMEZONE,
      confidence: 0,
      issues: ["could not parse date/time"],
    };
  }

  if (results.length > 1) {
    issues.push("multiple conflicting date/time phrases detected");
    confidence -= 0.3;
  }

  const primary = results[0];
  const parsedJsDate = primary.start.date();
  let dt = DateTime.fromJSDate(parsedJsDate).setZone(TIMEZONE);

  // ── Apply the independent past-tense override ──────────────────────────
  // If the phrase explicitly says "last Friday" etc., trust that over
  // chrono's forwardDate-forced future resolution.
  if (referencesPast) {
    issues.push("explicitly past-referencing date phrase used for a booking request");
    confidence = 0; // hard fail — don't let forwardDate mask an explicit past reference
  }

  // ── Guardrail: date resolves to the past (covers implicit cases too,
  //    e.g. "today" evaluated after the stated time has already passed) ──
  const now = DateTime.fromJSDate(referenceDate).setZone(TIMEZONE);
  if (!referencesPast && dt < now) {
    issues.push("resolved date is in the past");
    confidence -= 0.3;
  }

  // ── Time / AM-PM handling ───────────────────────────────────────────────
  const hasTimeComponent = primary.start.isCertain("hour");
  const hasExplicitMeridiem = primary.start.isCertain("meridiem");
  const usesColonNotation = HAS_COLON_TIME.test(timePhrase ?? combined);

  let finalTime: string | null = null;

  if (!hasTimeComponent) {
    issues.push("time could not be confidently determined");
    confidence -= 0.4;
  } else if (usesColonNotation) {
    // HH:MM notation is unambiguous 24hr format — no penalty, no heuristic
    // needed. e.g. "11:00" is 11am, "15:00" is 3pm, regardless of whether
    // an AM/PM word was also present.
    finalTime = dt.toFormat("HH:mm");
  } else if (hasExplicitMeridiem) {
    // bare hour but WITH an explicit am/pm marker ("3pm") — unambiguous
    finalTime = dt.toFormat("HH:mm");
  } else {
    // bare hour, no colon, no meridiem — e.g. "at 3" or "at 11"
    const rawHour = primary.start.get("hour")!;
    const { suggestedHour, isHeuristic } = applyAmPmHeuristic(rawHour);

    if (isHeuristic && suggestedHour !== null) {
      // don't auto-apply — surface as a suggestion, guardrail still fires
      suggestedTime = `${String(suggestedHour).padStart(2, "0")}:00`;
      issues.push(`ambiguous AM/PM — assumed ${suggestedTime} based on typical clinic hours`);
      confidence -= 0.3;
      finalTime = null; // do not silently accept the guess
    } else {
      // 8-12 band, or otherwise unresolvable — genuinely ambiguous either way
      issues.push("time could not be confidently determined (AM/PM unclear)");
      confidence -= 0.5;
      finalTime = null;
    }
  }

  confidence = Math.max(0, Math.min(1, confidence));

  return {
    date: dt.toFormat("yyyy-MM-dd"),
    time: finalTime,
    tz: TIMEZONE,
    confidence,
    issues,
    ...(suggestedTime ? { suggestedTime } : {}),
  };
}