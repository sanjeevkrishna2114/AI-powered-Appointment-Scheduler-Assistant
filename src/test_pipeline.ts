import { runPipeline } from "./pipeline/graph";
import * as fs from "fs";

// Fixed reference date: Wednesday, Aug 12, 2026, 12:00 PM
const REFERENCE_DATE = new Date("2026-08-12T12:00:00Z");

const TEST_CASES = JSON.parse(fs.readFileSync("./text_pipeline_test_cases.json", "utf-8"));

async function runTests() {
  console.log("Starting Pipeline Edge Case Tests...\n");
  console.log(`Reference Date: ${REFERENCE_DATE.toISOString()}\n`);
  
  const results = [];

  for (const tc of TEST_CASES) {
    try {
        const res = await runPipeline({ type: "text", payload: tc.input, referenceDate: REFERENCE_DATE });
        
        let actual_gate = "N/A";
        let actual_message = "N/A";
        
        if (res.status === "needs_clarification") {
            actual_gate = res.gate || "Unknown";
            actual_message = res.message;
        } else if (res.status === "ok") {
            actual_message = `OK: ${res.appointment.date} ${res.appointment.time} - ${res.appointment.department}`;
        }
        
        results.push({
            id: tc.id,
            input: tc.input,
            expected: tc.expected_status,
            actual_status: res.status,
            actual_gate: actual_gate,
            actual_message: actual_message
        });
    } catch (e: any) {
        results.push({
            id: tc.id,
            input: tc.input,
            expected: tc.expected_status,
            actual_status: "error",
            actual_gate: "ERROR",
            actual_message: e.message
        });
    }

    // Sleep for 2 seconds to avoid Gemini API Rate Limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  let md = `| ID | Input | Expected | Actual Status | Triggered Gate | Message |\n|---|---|---|---|---|---|\n`;
  for (const r of results) {
      let exp = r.expected === 'flag' ? 'needs_clarification' : r.expected;
      md += `| ${r.id} | ${r.input} | ${exp} | **${r.actual_status}** | **${r.actual_gate}** | ${r.actual_message} |\n`;
  }
  fs.writeFileSync('md_table.md', md, 'utf-8');
  console.log("Markdown table written to md_table.md");
}

runTests().catch(console.error);
