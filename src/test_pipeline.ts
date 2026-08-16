import { runPipeline } from "./pipeline/graph";

// Fixed reference date: Wednesday, Aug 12, 2026, 12:00 PM
const REFERENCE_DATE = new Date("2026-08-12T12:00:00Z");

const TEST_CASES = [
  // B. Missing date or time (partial info)
  { id: "4", text: "Book dentist appointment", expected_status: "needs_clarification" },
  { id: "5", text: "Need to see a doctor next Friday", expected_status: "needs_clarification" },
  { id: "6", text: "Book something at 3pm", expected_status: "needs_clarification" },
  
  // C. Ambiguous date phrase
  { id: "7", text: "Book dentist Friday", expected_status: "needs_clarification" },
  { id: "8", text: "Book dentist next week", expected_status: "needs_clarification" },
  { id: "9", text: "Book dentist soon", expected_status: "needs_clarification" },

  // D. Ambiguous/invalid time
  { id: "10", text: "Book dentist next Friday at 3", expected_status: "needs_clarification" },
  { id: "11", text: "Book dentist next Friday at 25:00", expected_status: "needs_clarification" },
  { id: "12", text: "Book dentist next Friday evening", expected_status: "needs_clarification" },

  // E. Conflicting information
  { id: "13", text: "Book dentist next Friday, actually make it Saturday, at 3pm", expected_status: "needs_clarification" },
  { id: "14", text: "Book dentist at 3pm, no wait 5pm", expected_status: "needs_clarification" },

  // F. Multiple appointments in one request
  { id: "15", text: "Book dentist next Friday at 3pm and cardiology next Monday at 10am", expected_status: "needs_clarification" },

  // G. Department ambiguity / unknown department
  { id: "16", text: "Book an appointment next Friday at 3pm", expected_status: "needs_clarification" },
  { id: "17", text: "Book with Dr. Kumar next Friday at 3pm", expected_status: "needs_clarification" },
  { id: "18", text: "Book physiotherapy session next Friday at 3pm", expected_status: "ok" }, // physiotherpy is in our map!

  // H. Noisy/informal/typo text
  { id: "19", text: "bk dentist nxt fri @ 3pm pls", expected_status: "ok" },
  { id: "20", text: "Book DENTIST NEXT FRIDAY AT 3 PM", expected_status: "ok" },
  { id: "21", text: "Hi, hope you're doing well... I wanted to also mention... book dentist next Friday at 3pm... Thanks, John", expected_status: "ok" },
];

async function runTests() {
  console.log("Starting Pipeline Edge Case Tests...\n");
  console.log(`Reference Date: ${REFERENCE_DATE.toISOString()}\n`);
  
  const results = [];

  for (const tc of TEST_CASES) {
    try {
        const res = await runPipeline({ type: "text", payload: tc.text }, REFERENCE_DATE);
        
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
            input: tc.text,
            expected: tc.expected_status,
            actual_status: res.status,
            actual_gate: actual_gate,
            actual_message: actual_message
        });
    } catch (e: any) {
        results.push({
            id: tc.id,
            input: tc.text,
            expected: tc.expected_status,
            actual_status: "error",
            actual_gate: "ERROR",
            actual_message: e.message
        });
    }
  }

  console.table(results, ["id", "input", "expected", "actual_status", "actual_gate", "actual_message"]);
}

runTests().catch(console.error);
