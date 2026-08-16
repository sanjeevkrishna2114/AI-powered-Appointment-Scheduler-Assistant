import { extractEntities } from "../extraction/entityExtractor";
import { normalizeDateTime } from "../normalization/dateNormalizer";
import { normalizeDepartment } from "../normalization/departmentMap";
import { aggregateConfidence, THRESHOLDS } from "../guardrails/confidence";

export type PipelineInput =
  | { type: "text"; payload: string }
  | { type: "image"; payload: Buffer };

export type PipelineResult =
  | { status: "ok"; appointment: { department: string; date: string; time: string; tz: string } }
  | { status: "needs_clarification"; message: string; gate?: string };

export async function runPipeline(input: PipelineInput, referenceDate: Date = new Date()): Promise<PipelineResult> {
  // ── Step 1: OCR / Text Extraction ──────────────────────────────────────
  let rawText: string;
  let ocrConfidence: number;

  if (input.type === "text") {
    rawText = input.payload;
    ocrConfidence = 1.0; 
  } else {
    throw new Error("Not Implemented: OCR extraction for image type");
  }

  // Gate 1
  if (!rawText || !rawText.trim()) {
    return { status: "needs_clarification", message: "Could not read any text from the input", gate: "G1" };
  }
  
  // Gate 2
  if (ocrConfidence < THRESHOLDS.OCR_MIN) {
    return {
      status: "needs_clarification",
      message: "Input text could not be read clearly — please retype or resend a clearer image",
      gate: "G2"
    };
  }

  // ── Step 2: Entity Extraction ─────────────────────────────────────────
  const { entities, entities_confidence } = await extractEntities(rawText);

  // Gate 3
  if (!entities.date_phrase && !entities.time_phrase) {
    return {
      status: "needs_clarification",
      message: "Missing both date and time — please specify when you'd like the appointment",
      gate: "G3"
    };
  }
  
  // Gate 4
  if (entities_confidence < THRESHOLDS.ENTITIES_MIN) {
    return { status: "needs_clarification", message: "Ambiguous date/time or department", gate: "G4" };
  }

  // ── Step 3: Normalization ──────────────────────────────────────────────
  const normalized = normalizeDateTime(entities.date_phrase, entities.time_phrase, referenceDate);
  const department = normalizeDepartment(entities.department);

  // Gate 5
  if (normalized.issues.includes("multiple conflicting date/time phrases detected")) {
    return {
      status: "needs_clarification",
      message: "Multiple possible dates/times mentioned — please clarify which one you mean",
      gate: "G5"
    };
  }

  // Gate 6
  if (normalized.issues.includes("resolved date is in the past")) {
      return {
          status: "needs_clarification",
          message: "That date appears to be in the past — please confirm or provide a future date",
          gate: "G6"
      };
  }

  // Gate 7
  if (normalized.issues.includes("could not parse date/time")) {
      return {
          status: "needs_clarification",
          message: "Could not understand the requested date/time",
          gate: "G7"
      };
  }

  // Gate 8
  if (normalized.confidence < THRESHOLDS.NORMALIZATION_MIN) {
    return {
      status: "needs_clarification",
      message: "Ambiguous date/time or department",
      gate: "G8"
    };
  }

  // Gate 9 (Hard fail per user request)
  if (!department.value) {
      return {
          status: "needs_clarification",
          message: "Department not recognized - please specify a valid department",
          gate: "G9"
      };
  }

  // ── Step 4: Aggregate + Final ──────────────────────────────────────────
  // Note: we consider both normalization confidences. 
  // We can take the min of the date norm confidence and the department norm confidence for the overall norm confidence
  const overallNormConfidence = Math.min(normalized.confidence, department.confidence);
  
  const composite = aggregateConfidence(ocrConfidence, entities_confidence, overallNormConfidence);

  // Gate 10
  if (composite < THRESHOLDS.FINAL_MIN) {
    return { status: "needs_clarification", message: "Ambiguous date/time or department", gate: "G10" };
  }

  return {
    status: "ok",
    appointment: {
      department: department.value,
      date: normalized.date!,
      time: normalized.time!,
      tz: "Asia/Kolkata",
    },
  };
}
