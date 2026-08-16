import { runPipeline } from "./pipeline/graph";
import * as fs from "fs";

// Using the fixed reference date from the text tests
const REFERENCE_DATE = new Date("2026-08-12T12:00:00Z");

const CLEAN_IMAGE = "C:\\Users\\sankr\\.gemini\\antigravity-ide\\brain\\52e1235b-b631-4a22-92b0-f61b39a82ed6\\.user_uploaded\\media_1786887602371.png";
const HANDWRITTEN_IMAGE = "C:\\Users\\sankr\\.gemini\\antigravity-ide\\brain\\52e1235b-b631-4a22-92b0-f61b39a82ed6\\.user_uploaded\\media_1786889712569.jpg";

async function runTests() {
  console.log("=== Running Image Pipeline Tests ===\n");

  // 1. Clean Typed Image (Should be handled by Tesseract without escalation)
  console.log("--- Test 1: Clean Typed Image ---");
  const cleanBuffer = fs.readFileSync(CLEAN_IMAGE);
  const cleanResult = await runPipeline({
    type: "image",
    payload: cleanBuffer,
    referenceDate: REFERENCE_DATE
  });
  console.log("Pipeline Output:");
  console.log(JSON.stringify(cleanResult, null, 2));

  // 2. Handwritten Image (Should escalate to Gemini, confidence should tank due to mismatch)
  console.log("\n--- Test 2: Handwritten Image ---");
  const handwrittenBuffer = fs.readFileSync(HANDWRITTEN_IMAGE);
  const handwrittenResult = await runPipeline({
    type: "image",
    payload: handwrittenBuffer,
    referenceDate: REFERENCE_DATE
  });
  console.log("Pipeline Output:");
  console.log(JSON.stringify(handwrittenResult, null, 2));
}

runTests().catch(console.error);
