import { extractEntities } from "../extraction/entityExtractor";
import { normalizeDateTime } from "../normalization/dateNormalizer";
import { normalizeDepartment } from "../normalization/departmentMap";
import { aggregateConfidence, THRESHOLDS } from "../guardrails/confidence";
import { ocrWithFallback } from "../extraction/ocrWithFallback";

export type PipelineInput =
  | { type: "text"; payload: string; referenceDate?: Date }
  | { type: "image"; payload: Buffer; referenceDate?: Date };

export type PipelineResult =
  | { status: "ok"; appointment: { department: string; date: string; time: string; tz: string } }
  | { status: "needs_clarification"; message: string; gate: string };

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const referenceDate = input.referenceDate ?? new Date();

  // ── Step 1: OCR / Text Extraction ──────────────────────────────────────
  let rawText: string;
  let ocrConfidence: number;
  let engineUsed = "none";
  let escalated = false;

  if (input.type === "text") {
    rawText = input.payload;
    ocrConfidence = 1.0;
  } else {
    const ocrResult = await ocrWithFallback(input.payload);
    rawText = ocrResult.text;
    ocrConfidence = ocrResult.confidence;
    engineUsed = ocrResult.engineUsed;
    escalated = ocrResult.escalated;
    console.log(`[OCR] Engine: ${engineUsed}, Escalated: ${escalated}, Conf: ${ocrConfidence.toFixed(2)}`);
  }

  console.log("\n--- Step 1 - OCR/Text Extraction ---");
  console.log(JSON.stringify({ raw_text: rawText, confidence: ocrConfidence }, null, 2));

  // G1 — empty/unreadable input
  if (!rawText.trim()) {
    return { status: "needs_clarification", message: "Could not read any text from the input", gate: "G1" };
  }

  // G2 — OCR confidence too low (only meaningful once the image branch is wired in;
  // always passes for text input since ocrConfidence is fixed at 1.0)
  if (ocrConfidence < THRESHOLDS.OCR_MIN) {
    return {
      status: "needs_clarification",
      message: "Input text could not be read clearly — please retype or resend a clearer image",
      gate: "G2",
    };
  }

  // ── Step 2: Entity Extraction ──────────────────────────────────────────
  const { entities, entities_confidence } = await extractEntities(rawText);

  console.log("\n--- Step 2 - Entity Extraction ---");
  console.log(JSON.stringify({ entities, entities_confidence }, null, 2));

  // G3 — missing both date and time
  if (!entities.date_phrase && !entities.time_phrase) {
    return {
      status: "needs_clarification",
      message: "Missing both date and time — please specify when you'd like the appointment",
      gate: "G3",
    };
  }

  // G4 — entity extraction confidence too low
  if (entities_confidence < THRESHOLDS.ENTITIES_MIN) {
    return { status: "needs_clarification", message: "Ambiguous date/time or department", gate: "G4" };
  }

  // ── Step 3: Normalization ──────────────────────────────────────────────
  const normalized = normalizeDateTime(entities.date_phrase, entities.time_phrase, referenceDate);
  const department = normalizeDepartment(entities.department);

  console.log("\n--- Step 3 - Normalization ---");
  console.log(JSON.stringify({
    normalized: { date: normalized.date, time: normalized.time, tz: normalized.tz },
    normalization_confidence: normalized.confidence
  }, null, 2));

  // G5 — multiple conflicting date/time phrases
  if (normalized.issues.some(i => i.includes("multiple conflicting"))) {
    return {
      status: "needs_clarification",
      message: "Multiple possible dates/times mentioned — please clarify which one you mean",
      gate: "G5",
    };
  }

  // G6 — resolved date is in the past (covers both explicit "last Friday"
  // style phrasing and implicit cases like "today" evaluated after the
  // stated time has passed — both are flagged as this same issue string
  // family from dateNormalizer)
  if (
    normalized.issues.some(
      i => i.includes("resolved date is in the past") || i.includes("past-referencing")
    )
  ) {
    return {
      status: "needs_clarification",
      message: "That date appears to be in the past — please confirm or provide a future date",
      gate: "G6",
    };
  }

  // G7 — chrono couldn't parse a date/time at all
  if (normalized.issues.includes("could not parse date/time")) {
    return { status: "needs_clarification", message: "Could not understand the requested date/time", gate: "G7" };
  }

  // ── Ambiguous AM/PM with a heuristic suggestion available ──────────────
  // This sits BEFORE the generic G8 fallback so it takes priority — it's a
  // more specific, more useful message for exactly the 1-7 bare-hour case.
  if (normalized.issues.some(i => i.startsWith("ambiguous AM/PM")) && normalized.suggestedTime) {
    return {
      status: "needs_clarification",
      message: `Did you mean ${normalized.suggestedTime}? Please confirm the time.`,
      gate: "G8_SUGGESTED",
    };
  }

  // Completeness check — belt-and-suspenders. Even if confidence math
  // somehow lands above threshold, never return "ok" with a null field.
  // This is what closed the earlier "null time slipping through as ok" bug.
  if (!normalized.date || !normalized.time) {
    return {
      status: "needs_clarification",
      message: "Missing a clear time for the appointment — please specify when",
      gate: "Completeness Check",
    };
  }

  // G8 — normalization confidence too low (generic fallback, fires for
  // anything not already caught by a more specific gate above)
  if (normalized.confidence < THRESHOLDS.NORMALIZATION_MIN) {
    return { status: "needs_clarification", message: "Ambiguous date/time or department", gate: "G8" };
  }

  // G9 — department not recognized (hard-fail policy, per earlier decision)
  if (!department.value) {
    return {
      status: "needs_clarification",
      message: "Department not recognized - please specify a valid department",
      gate: "G9",
    };
  }

  // ── Step 4: Aggregate + Final ────────────────────────────────────────────
  const composite = aggregateConfidence(ocrConfidence, entities_confidence, normalized.confidence);

  // G10 — composite confidence below final threshold, even if every
  // individual gate above already passed. Final safety net.
  if (composite < THRESHOLDS.FINAL_MIN) {
    const errorRes = { status: "needs_clarification", message: "Ambiguous date/time or department", gate: "G10" };
    console.log("\n--- Guardrail / Exit Condition ---");
    console.log(JSON.stringify({ status: errorRes.status, message: errorRes.message }, null, 2));
    return errorRes as PipelineResult;
  }

  const finalRes = {
    status: "ok",
    appointment: {
      department: department.value,
      date: normalized.date,
      time: normalized.time,
      tz: normalized.tz,
    },
  };

  console.log("\n--- Step 4 - Final Appointment JSON ---");
  console.log(JSON.stringify(finalRes, null, 2));

  return finalRes as PipelineResult;
}
