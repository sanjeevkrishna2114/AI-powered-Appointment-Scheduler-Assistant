# CLAUDE.md — AI-Powered Appointment Scheduler Assistant (PS1)

This file gives full context on the project: what it is, how it's architected, and how each
piece should be built. Read this before touching code.

---

## 1. Problem Statement

Build a backend service that parses natural language or document-based appointment requests
and converts them into structured scheduling data. The system must handle both typed text and
noisy image inputs (scanned notes, emails/screenshots). The pipeline has four stages — OCR,
entity extraction, normalization, final structured JSON — each producing its own confidence
score, with guardrails that catch ambiguity at any stage instead of silently guessing.

**Company context**: Plum is an employee insurance/health benefits platform. This assistant
would sit in front of appointment booking flows (e.g., a user emails or types "book dentist
next Friday at 3pm" and the system converts that into structured calendar data).

---

## 2. Pipeline Contract (exact shapes expected)

The evaluators gave a specific 4-step contract. Match these shapes exactly — field names,
nesting, and confidence key names matter.

### Step 1 — OCR / Text Extraction
Input: typed text OR image (photo of note/email/screenshot).

```json
{
  "raw_text": "Book dentist next Friday at 3pm",
  "confidence": 0.90
}
```
- If input is already typed text (no image), `confidence` should be 1.0 (no OCR uncertainty).
- If input is an image, run OCR and use the engine's real confidence score, not a placeholder.

### Step 2 — Entity Extraction
Extract date/time phrase and department from `raw_text`.

```json
{
  "entities": {
    "date_phrase": "next Friday",
    "time_phrase": "3pm",
    "department": "dentist"
  },
  "entities_confidence": 0.85
}
```

### Step 3 — Normalization (Asia/Kolkata)
Map extracted phrases to ISO date/time in local timezone.

```json
{
  "normalized": {
    "date": "2025-09-26",
    "time": "15:00",
    "tz": "Asia/Kolkata"
  },
  "normalization_confidence": 0.90
}
```

### Guardrail / Exit Condition
Any step can short-circuit the pipeline with this shape:

```json
{ "status": "needs_clarification", "message": "Ambiguous date/time or department" }
```
Prefer specific messages over the generic one where possible (e.g. `"Missing time — please
specify a time for your appointment"`), since it's more useful and shows care in the design.

### Step 4 — Final Appointment JSON
Combine entities + normalized values into the final response.

```json
{
  "appointment": {
    "department": "Dentistry",
    "date": "2025-09-26",
    "time": "15:00",
    "tz": "Asia/Kolkata"
  },
  "status": "ok"
}
```
Note `department` is normalized to a canonical form ("dentist" → "Dentistry") — this needs a
lookup table, see §5.4.

---

## 3. Architecture

```
                    ┌──────────────┐
                    │   Request     │  { type: "text" | "image", payload }
                    └──────┬───────┘
                           ▼
              ┌────────────────────────┐
              │ Step 1: OCR/Extraction   │
              │  - text input: passthrough, confidence = 1.0
              │  - image input: OCRProvider.extractText()
              └──────┬─────────────────┘
                      │ confidence < OCR_THRESHOLD (0.6)?
                      │        └────► STOP → needs_clarification
                      ▼
              ┌────────────────────────┐
              │ Step 2: Entity Extraction│
              │  LLM call w/ Zod schema  │
              │  (date_phrase, time_phrase, department)
              └──────┬─────────────────┘
                      │ missing date+time, or
                      │ entities_confidence < 0.7?
                      │        └────► STOP → needs_clarification
                      ▼
              ┌────────────────────────┐
              │ Step 3: Normalization    │
              │  chrono-node → ISO date/time
              │  department → canonical lookup
              └──────┬─────────────────┘
                      │ invalid/past date, or
                      │ normalization_confidence < 0.7?
                      │        └────► STOP → needs_clarification
                      ▼
              ┌────────────────────────┐
              │ Step 4: Aggregate + Final│
              │  composite_confidence =  │
              │    min(step1, step2, step3)
              │  below FINAL_THRESHOLD?  │
              │        └────► override → needs_clarification
              └──────┬─────────────────┘
                      ▼
              { appointment: {...}, status: "ok" }
```

### Why `min()` for composite confidence, not average
A chain is only as strong as its weakest link. If OCR is 95% confident but entity extraction
is only 40% confident (e.g. it guessed a department that wasn't really stated), averaging would
hide that weak link behind the strong OCR score. `min()` forces the worst step to dominate the
final decision. State this explicitly in your submission — it's a deliberate design choice, not
an oversight.

### Why short-circuit at Step 1 but not at Steps 2/3
Garbage OCR text makes every downstream step meaningless — no point extracting entities from
noise, so stop immediately. But entity/normalization confidence issues still produce a valid
partial trace worth returning (useful for debugging/demo, and Step 4's aggregation is the final
authority on accept/reject anyway). This lets you show the full JSON pipeline trace even for
imperfect inputs.

---

## 4. Module Structure

```
src/
├── ocr/
│   ├── ocrProvider.ts        # interface: extractText(image) -> {text, confidence, words[]}
│   ├── tesseractProvider.ts  # concrete Tesseract.js implementation
│   └── preprocess.ts         # grayscale, polarity detection, Otsu binarization
│
├── extraction/
│   ├── entityExtractor.ts    # LLM call (structured output) + Zod validation
│   └── prompts.ts            # extraction prompt template(s)
│
├── normalization/
│   ├── dateNormalizer.ts     # chrono-node wrapper, Asia/Kolkata handling, past-date check
│   └── departmentMap.ts      # dictionary + fuzzy match for department normalization
│
├── guardrails/
│   ├── confidence.ts         # composite confidence calculator (min-based aggregation)
│   └── rules.ts              # ambiguity/conflict/past-date/missing-field checks
│
├── pipeline/
│   ├── graph.ts              # orchestration — chains the 4 steps, handles short-circuiting
│   └── types.ts              # shared PipelineContext / step result types
│
├── api/
│   └── routes.ts             # POST /appointment endpoint (Express or Fastify)
│
├── config/
│   └── thresholds.ts         # all confidence thresholds in one place, documented
│
└── index.ts                  # app entrypoint
```

**Why an `OCRProvider` interface**: keeps OCR swappable. Implement Tesseract.js now; the
interface means switching to Google Cloud Vision or AWS Textract later (better on noisy/
crumpled scans) is a one-file change, not a rewrite. Mention this explicitly as a
production-scaling note in your writeup — it shows systems thinking without costing you API
budget during the assignment.

---

## 5. Implementation Details Per Step

### 5.1 OCR Provider (`ocr/ocrProvider.ts`)

```typescript
export interface OCRWord {
  text: string;
  confidence: number; // 0-1
}

export interface OCRResult {
  text: string;
  confidence: number; // 0-1, aggregated
  words: OCRWord[];
}

export interface OCRProvider {
  extractText(imageBuffer: Buffer): Promise<OCRResult>;
}
```

Tesseract.js implementation:
```typescript
import { createWorker } from "tesseract.js";
import type { OCRProvider, OCRResult } from "./ocrProvider";

export class TesseractProvider implements OCRProvider {
  async extractText(imageBuffer: Buffer): Promise<OCRResult> {
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(imageBuffer);
    await worker.terminate();

    const words = data.words.map(w => ({
      text: w.text,
      confidence: w.confidence / 100,
    }));

    return {
      text: data.text.trim(),
      confidence: data.confidence / 100,
      words,
    };
  }
}
```

**Preprocessing** (`ocr/preprocess.ts`) — apply conditionally, not always (we found earlier
that fixed-threshold binarization can hurt more than it helps on already-decent images):
1. Convert to grayscale.
2. Detect polarity: compute mean brightness; if mean < 128, invert (handles dark-mode
   screenshots/dark backgrounds).
3. Auto-contrast boost.
4. Otsu's method for adaptive binarization threshold (not a fixed cutoff like 150 — that breaks
   on dark backgrounds and low-contrast photos).
5. Run OCR on both raw and preprocessed variants, keep whichever has higher confidence. This
   "run both, pick the winner" strategy is more robust than either always preprocessing or
   never preprocessing.

Use `sharp` in Node for image manipulation (grayscale, contrast, resize) — fast, native
bindings, well-suited for this kind of preprocessing pipeline.

### 5.2 Entity Extraction (`extraction/entityExtractor.ts`)

Use an LLM (Claude/OpenAI) with a strict JSON schema via tool-use / structured output — don't
hand-roll regex-based NER, it won't generalize across phrasing variety.

```typescript
import { z } from "zod";

export const EntitiesSchema = z.object({
  date_phrase: z.string().nullable(),
  time_phrase: z.string().nullable(),
  department: z.string().nullable(),
});

export type Entities = z.infer<typeof EntitiesSchema>;
```

Prompt design principles:
- Instruct the model to return `null` for any field not explicitly stated — never infer or
  guess a value that isn't in the text. This is your core anti-hallucination guardrail at this
  step.
- Ask for the **raw phrase**, not a pre-normalized date — normalization is Step 3's job. Keeps
  each step single-responsibility and independently testable.
- Few-shot examples in the prompt should include an ambiguous case (e.g. "book dentist" → all
  fields null except department) so the model doesn't feel pressured to fabricate.
- If you have the LLM emit a self-reported confidence, treat it with skepticism (see §6) —
  don't take it as your primary confidence signal.

### 5.3 Date/Time Normalization (`normalization/dateNormalizer.ts`)

Use `chrono-node` — handles relative dates ("next Friday", "in 2 weeks", "tomorrow") far better
than hand-written regex.

```typescript
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
  if (dt < DateTime.now().setZone("Asia/Kolkata")) {
    issues.push("resolved date is in the past");
  }

  // Guardrail: no explicit time and no AM/PM marker
  const hasTimeComponent = results[0].start.isCertain("hour");
  if (!hasTimeComponent) {
    issues.push("time could not be confidently determined");
  }

  const confidence = issues.length === 0 ? 0.9 : Math.max(0.3, 0.9 - issues.length * 0.2);

  return {
    date: dt.toFormat("yyyy-MM-dd"),
    time: hasTimeComponent ? dt.toFormat("HH:mm") : null,
    confidence,
    issues,
  };
}
```

Key guardrails baked in here:
- **Past date detection** — flag rather than silently book.
- **Multiple date/time phrases** — flag as a conflict rather than silently picking the first
  match.
- **No AM/PM marker** (e.g. "at 3") — don't guess; either flag for clarification or apply a
  documented business-hours heuristic (e.g. default to PM for anything 1-7 without a marker,
  since clinics rarely book pre-dawn) but mark confidence lower when you do this.
- **Reference date matters**: pass the time the request was received (not just "now" at
  processing time) as `referenceDate` so "next Friday" resolves correctly regardless of when
  your service actually processes it.

### 5.4 Department Normalization (`normalization/departmentMap.ts`)

Simple dictionary + fuzzy match (e.g. `fastest-levenshtein` or `fuse.js` for typo tolerance):

```typescript
const DEPARTMENT_MAP: Record<string, string> = {
  dentist: "Dentistry",
  dental: "Dentistry",
  cardiology: "Cardiology",
  cardiologist: "Cardiology",
  ent: "ENT",
  physiotherapy: "Physiotherapy",
  physio: "Physiotherapy",
  general: "General Medicine",
  // extend as needed — document this is a known-scope limitation
};

export function normalizeDepartment(raw: string | null): { value: string | null; confidence: number } {
  if (!raw) return { value: null, confidence: 0 };
  const key = raw.trim().toLowerCase();
  if (DEPARTMENT_MAP[key]) return { value: DEPARTMENT_MAP[key], confidence: 1.0 };

  // fuzzy fallback — flag lower confidence if only a fuzzy match was found
  // (implement with your fuzzy-match lib of choice)
  return { value: null, confidence: 0 }; // no match found -> treat as unknown, don't guess
}
```
Document explicitly: this dictionary is intentionally scoped to a handful of common
departments for the assignment; production would back this with a real service directory.

### 5.5 Pipeline Orchestration & Entry-Point Branching (`pipeline/graph.ts`)

This is the concrete implementation of the text-vs-image branch described in §3. It's the
single place where that decision is made — everything after Step 1 is identical regardless of
which branch produced `raw_text`.

```typescript
import { TesseractProvider } from "../ocr/tesseractProvider";
import { preprocessImage } from "../ocr/preprocess";
import { extractEntities } from "../extraction/entityExtractor";
import { normalizeDateTime } from "../normalization/dateNormalizer";
import { normalizeDepartment } from "../normalization/departmentMap";
import { aggregateConfidence, THRESHOLDS } from "../guardrails/confidence";

const ocrProvider = new TesseractProvider();

export type PipelineInput =
  | { type: "text"; payload: string }
  | { type: "image"; payload: Buffer };

export type PipelineResult =
  | { status: "ok"; appointment: { department: string; date: string; time: string; tz: string } }
  | { status: "needs_clarification"; message: string };

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  // ── Step 1: OCR / Text Extraction ──────────────────────────────────────
  // This is the ONLY branch point for OCR. Text input skips Tesseract
  // entirely; image input always goes through it. Everything from here
  // down operates on `raw_text` + `ocrConfidence` and doesn't know or care
  // which branch produced them.
  let rawText: string;
  let ocrConfidence: number;

  if (input.type === "text") {
    rawText = input.payload;
    ocrConfidence = 1.0; // no OCR uncertainty — we received the exact string
  } else {
    // image branch — Tesseract runs here, and only here
    const rawResult = await ocrProvider.extractText(input.payload);

    // try preprocessed variant too, keep whichever scores higher
    // (see §5.1 — fixed preprocessing can hurt as often as it helps)
    const preprocessed = await preprocessImage(input.payload);
    const preprocessedResult = await ocrProvider.extractText(preprocessed);

    const best = preprocessedResult.confidence > rawResult.confidence
      ? preprocessedResult
      : rawResult;

    rawText = best.text;
    ocrConfidence = best.confidence;
  }

  // Guardrail: OCR confidence too low, or empty text — hard stop here.
  // No point running extraction on garbage; this is the one case where we
  // short-circuit immediately instead of completing the trace.
  if (!rawText.trim()) {
    return { status: "needs_clarification", message: "Could not read any text from the input" };
  }
  if (ocrConfidence < THRESHOLDS.OCR_MIN) {
    return {
      status: "needs_clarification",
      message: "Input text could not be read clearly — please retype or resend a clearer image",
    };
  }

  // ── Step 2: Entity Extraction (identical for both branches) ───────────
  const { entities, entities_confidence } = await extractEntities(rawText);

  if (!entities.date_phrase && !entities.time_phrase) {
    return {
      status: "needs_clarification",
      message: "Missing both date and time — please specify when you'd like the appointment",
    };
  }
  if (entities_confidence < THRESHOLDS.ENTITIES_MIN) {
    return { status: "needs_clarification", message: "Ambiguous date/time or department" };
  }

  // ── Step 3: Normalization ──────────────────────────────────────────────
  const normalized = normalizeDateTime(entities.date_phrase, entities.time_phrase);
  const department = normalizeDepartment(entities.department);

  if (normalized.issues.length > 0 || normalized.confidence < THRESHOLDS.NORMALIZATION_MIN) {
    return {
      status: "needs_clarification",
      message: normalized.issues[0] ?? "Ambiguous date/time or department",
    };
  }

  // ── Step 4: Aggregate + Final ──────────────────────────────────────────
  const composite = aggregateConfidence(ocrConfidence, entities_confidence, normalized.confidence);

  if (composite < THRESHOLDS.FINAL_MIN || !department.value) {
    return { status: "needs_clarification", message: "Ambiguous date/time or department" };
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
```

**What this makes explicit:**
- The `input.type === "text"` check is the *only* place Tesseract is conditionally skipped —
  there's no other branching for OCR anywhere else in the codebase.
- Once `rawText` and `ocrConfidence` exist, Steps 2–4 run identically no matter which branch
  produced them — this is what makes OCR a clean, decoupled pre-processing step rather than
  something tangled into extraction/normalization logic.
- The "run both raw and preprocessed, keep the higher-confidence result" strategy from §5.1 is
  wired in directly on the image branch.
- Short-circuit only happens explicitly at Step 1 (empty/low-confidence OCR) and implicitly via
  early `return` at each guardrail check — matching the "hard stop at OCR, soft stop elsewhere
  until final aggregation" design from §3.

### 5.6 Composite Confidence (`guardrails/confidence.ts`)

```typescript
export function aggregateConfidence(
  ocrConfidence: number,
  entitiesConfidence: number,
  normalizationConfidence: number
): number {
  return Math.min(ocrConfidence, entitiesConfidence, normalizationConfidence);
}

export const THRESHOLDS = {
  OCR_MIN: 0.6,          // below this: stop at Step 1, don't even attempt extraction
  ENTITIES_MIN: 0.7,
  NORMALIZATION_MIN: 0.7,
  FINAL_MIN: 0.7,         // composite floor for final accept
};
```
Keep all thresholds in one config file (`config/thresholds.ts`), not scattered across modules —
makes them easy to tune and easy to point to in your writeup as deliberate, documented values
rather than magic numbers buried in logic.

---

## 6. Confidence Calculation Methodology (write this up explicitly)

Don't rely on a single source for confidence. Combine three independent signals:

1. **OCR confidence** — Tesseract's native per-word confidence, averaged over the extracted
   text region.
2. **Extraction agreement** — cross-check the LLM's structured extraction against a lightweight
   regex/rule-based pass (e.g. does a simple day-of-week regex find "Friday" too?). Disagreement
   between the two lowers confidence.
3. **Rule/schema validity** — does the extracted+normalized value make sense? A past date, a
   department not in your dictionary, a time outside plausible clinic hours (e.g. 3am) — each
   should dock confidence even if OCR and the LLM were both "sure."

Final composite = `min()` across step-level confidences (see §5.6), not a weighted average —
documented reasoning in §3.

**Do not trust an LLM's self-reported confidence at face value** — LLMs are known to be poorly
calibrated when asked to rate their own certainty directly. Use it as one weak signal at most,
never as the sole confidence source.

Thresholds (document your exact numbers and justify them, don't just state them):
- `< 0.5` → reject / needs_clarification, don't even show a partial result.
- `0.5 – 0.75` → flag for review but still show extracted data (useful for debugging/demo).
- `> 0.75` → auto-accept.

---

## 7. OCR Engine Choice — Tesseract.js (with justification)

**Primary: Tesseract.js**
- Pure JS/WASM, runs locally, zero API cost, zero external network dependency, works offline.
- Sufficient for typed/printed text and moderately clean scans/screenshots — the primary input
  class in this problem statement.
- Returns real per-word confidence scores natively (`data.words[].confidence`), which is needed
  for the composite confidence calculation in §6.

**Known weaknesses** (state these explicitly, don't hide them):
- Struggles with handwriting, low-contrast scans, skewed/rotated images, and crumpled photos.
- Fixed-threshold binarization preprocessing can actively hurt already-decent images — use
  adaptive (Otsu) thresholding and polarity detection instead (see §5.1), and only apply
  preprocessing when it measurably improves confidence over the raw image.

**Production note**: architect OCR behind the `OCRProvider` interface so swapping to Google
Cloud Vision or AWS Textract (better layout-aware detection, much better on noisy/crumpled
documents) is a one-file change. State this as a scoped-out production consideration — costs
money and adds a network dependency, not justified for an assignment demo.

---

## 8. Guardrail Catalogue (map to test cases)

| Failure mode | Step it's caught at | Guardrail behavior |
|---|---|---|
| OCR confidence too low | Step 1 | Hard stop, `needs_clarification`, distinct message for unreadable input |
| Empty/blank OCR output | Step 1 | Hard stop, distinct message from generic ambiguity |
| Missing date AND time | Step 2 | `needs_clarification`, message names which fields are missing |
| Missing department | Step 2 | Don't hard-fail — allow `null`/"general" with lower confidence (documented policy choice) |
| Multiple conflicting dates/times | Step 2/3 | Flag as ambiguous, don't silently pick first/last mention |
| Date resolves to the past | Step 3 | Flag — don't silently book |
| Time with no AM/PM marker | Step 3 | Either flag, or apply a documented business-hours heuristic with reduced confidence |
| Invalid normalized time/date | Step 3 | Sanity-check ranges (00:00–23:59, valid calendar date) before propagating |
| Department not in dictionary | Step 3/4 | Flag rather than inserting an unrecognized guessed value |
| Multiple appointments in one request | Step 2 | Document as out-of-scope for this assignment, or explicitly detect and reject with a clear message |
| Any upstream `needs_clarification` | Step 4 | Propagate immediately, don't continue to final JSON |
| Composite confidence below final threshold | Step 4 | Override `status: "ok"` even if each step individually passed its own bar |

---

## 9. Testing Strategy

Three tiers, build/test in this order:

1. **Typed text, no OCR** — tests extraction/normalization/guardrail logic in isolation. ~15-20
   hand-written cases covering: clean happy path, missing fields, ambiguous dates, conflicting
   info, multiple appointments, informal/typo text, email-with-boilerplate.
2. **Self-photographed images** — clean typed screenshot, handwritten (neat), handwritten
   (messy/natural), angled/blurry photo, dark-background screenshot. Ground-truth each one so
   you can compute WER/accuracy, not just eyeball it.
3. **Edge cases specific to OCR noise** — character confusions (3↔I/i, O↔0), broken/degraded
   font rendering. Confirm these correctly trigger low confidence and the guardrail fires,
   rather than trying to eliminate every possible OCR misread — some are unavoidable, and the
   guardrail catching them IS the correct behavior to demonstrate.

Use a Python test harness (separate from the Node service) for OCR-engine-only testing/
comparison before wiring into the Node pipeline — decouples "is the OCR choice good" from "is
the extraction logic good," so you're not debugging both at once.

Log every pipeline run's full step-by-step trace (all 4 JSON blobs, not just the final one) —
useful for the demo, and for showing exactly where and why a guardrail fired.

---

## 10. Tech Stack Summary

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js + TypeScript | Explicitly named in the JD |
| Web framework | Express or Fastify | Either is fine; Fastify if you want built-in JSON schema validation |
| OCR | Tesseract.js | Free, local, no API dependency, real confidence scores |
| Image preprocessing | `sharp` | Fast native image manipulation |
| Entity extraction | LLM (Claude/OpenAI) via structured/tool-use output | More robust to phrasing variety than hand-rolled NER |
| Schema validation | Zod | Enforces final JSON shape, catches malformed LLM output |
| Date normalization | `chrono-node` | Handles relative dates well out of the box |
| Timezone handling | `luxon` | Cleaner API than native Date for IANA timezone (Asia/Kolkata) math |
| Orchestration | Simple async pipeline, or LangGraph-style graph if you want to reuse the DataOrbit pattern | Matches your existing experience, easy to explain in an interview |
| Frontend (optional, ~20% effort) | Minimal React page — upload/text box, shows raw OCR text + structured JSON output | JD names React/Node explicitly; keep this thin, don't over-invest |

---

## 11. What NOT to over-engineer for this assignment

- Don't build a full department directory/service catalog — a small hardcoded dictionary
  (5-10 entries) with a documented "production would use a real directory" note is sufficient.
- Don't try to handle multiple appointments in a single request unless you have time left over —
  explicitly scoping this out and stating it as a known limitation is a legitimate, honest
  answer.
- Don't chase every possible OCR misread to zero — demonstrating that your guardrail correctly
  catches low-confidence/garbled output is more valuable than chasing perfect OCR accuracy on
  adversarial inputs.
- Don't skip the frontend entirely, but don't polish it either — a bare functional upload +
  JSON viewer is enough to show full-stack capability without eating time better spent on
  pipeline correctness.