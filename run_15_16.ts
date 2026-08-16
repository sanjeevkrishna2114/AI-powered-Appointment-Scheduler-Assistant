import { runPipeline } from "./src/pipeline/graph";
import * as fs from "fs";

const REFERENCE_DATE = new Date("2026-08-12T12:00:00Z");
const TEST_CASES = JSON.parse(fs.readFileSync("./text_pipeline_test_cases.json", "utf-8"));

async function runSpecificTests() {
  console.log("Running Tests for Rows 15 and 16...\n");

  const targetIds = [15, 16];
  const targets = TEST_CASES.filter((tc: any) => targetIds.includes(tc.id));

  for (const tc of targets) {
    try {
        console.log(`ID: ${tc.id} | Input: "${tc.input}"`);
        const res = await runPipeline({ type: "text", payload: tc.input, referenceDate: REFERENCE_DATE });
        console.log("Result:", res);
        console.log("--------------------------------------------------");
    } catch (e) {
        console.error("Error:", e);
    }
  }
}

runSpecificTests().catch(console.error);
