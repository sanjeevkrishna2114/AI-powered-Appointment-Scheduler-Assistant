import { extractEntities } from "./extraction/entityExtractor";
import { normalizeDateTime } from "./normalization/dateNormalizer";
import { normalizeDepartment } from "./normalization/departmentMap";

const testCases = [
  // Clean happy paths
  "Book dentist next Friday at 3pm",
  "I need an appointment with cardiology on October 15th at 10:30 AM",
  "Schedule physio for tomorrow at 2 in the afternoon",
  
  // Missing fields
  "Book dentist", // Missing date and time
  "Can I come in next Tuesday?", // Missing time and department
  "Schedule an appointment for 4pm today", // Missing department
  
  // Ambiguous/relative dates
  "I'd like to see the ENT in 2 weeks on a Wednesday at 9am",
  "Need a general checkup next week", // Missing time, ambiguous date
  "Can I see a doctor?", // Missing everything
  
  // Conflicting info
  "Book dentist for Monday... actually make it Tuesday at 3pm",
  
  // Informal text / typos
  "pls book dental 4 tomorw at 5",
  "i need sum physiotherpy on 12/12 at 14:00",
  
  // Edge cases (no AM/PM marker)
  "Book dentist for October 20th at 3", // Should trigger heuristic or ambiguity
  
  // Past date
  "Book dentist for yesterday at 3pm" // Should flag as past date
];

async function runTests() {
  console.log("=========================================");
  console.log(" Running Tests for Pipeline Steps 2 & 3");
  console.log("=========================================\n");

  const referenceDate = new Date("2026-08-16T12:00:00Z"); // Set fixed reference date for tests

  for (const [index, text] of testCases.entries()) {
    console.log(`\n--- Test Case ${index + 1} ---`);
    console.log(`Input Text: "${text}"\n`);

    // --- Step 2: Extraction ---
    console.log("[Step 2: Entity Extraction]");
    const { entities, entities_confidence } = await extractEntities(text);
    console.log(JSON.stringify({ entities, entities_confidence }, null, 2));

    // --- Step 3: Normalization ---
    console.log("\n[Step 3: Normalization]");
    const normalizedDate = normalizeDateTime(entities.date_phrase, entities.time_phrase, referenceDate);
    const normalizedDept = normalizeDepartment(entities.department);
    
    console.log("Date/Time Normalization:");
    console.log(JSON.stringify(normalizedDate, null, 2));
    
    console.log("Department Normalization:");
    console.log(JSON.stringify(normalizedDept, null, 2));

    // Calculate composite confidence for fun
    const compositeConfidence = Math.min(entities_confidence, normalizedDate.confidence, normalizedDept.confidence);
    console.log(`\nComposite Confidence (Step 2 & 3): ${compositeConfidence}`);
    
    if (compositeConfidence < 0.7) {
        console.log(">> SYSTEM WOULD FLAG: needs_clarification");
    } else {
        console.log(">> SYSTEM WOULD PROCEED");
    }
    
    console.log("-----------------------------------------");
  }
}

runTests().catch(console.error);
