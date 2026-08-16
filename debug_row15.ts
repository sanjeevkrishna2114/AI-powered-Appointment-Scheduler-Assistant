import { runPipeline } from "./src/pipeline/graph";
import { extractEntities } from "./src/extraction/entityExtractor";
import { normalizeDateTime } from "./src/normalization/dateNormalizer";
import * as chrono from "chrono-node";

async function debugRow15() {
    const REFERENCE_DATE = new Date("2026-08-12T12:00:00Z");
    const input = "Book dentist next Friday at 3";
    
    console.log(`Input: ${input}`);
    
    const { entities } = await extractEntities(input);
    console.log("raw entities:", entities);
    
    const combined = `${entities.date_phrase || ""} ${entities.time_phrase || ""}`.trim();
    console.log("chrono input:", combined);
    
    const results = chrono.parse(combined, REFERENCE_DATE, { forwardDate: true });
    if (results.length > 0) {
        console.log("chrono hour certain?", results[0].start.isCertain("hour"));
        console.log("chrono hour value:", results[0].start.get("hour"));
    }
    
    const norm = normalizeDateTime(entities.date_phrase, entities.time_phrase, REFERENCE_DATE);
    console.log("normalized:", norm);
    
    const res = await runPipeline({ type: "text", payload: input, referenceDate: REFERENCE_DATE });
    console.log("Pipeline result:", res);
}

debugRow15().catch(console.error);
