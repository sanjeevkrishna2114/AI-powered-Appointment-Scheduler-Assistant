import { runPipeline } from "./pipeline/graph";
import * as fs from "fs";

const REFERENCE_DATE = new Date("2026-08-12T12:00:00Z");
const IMAGE_PATH = "C:\\Users\\sankr\\plum\\AI-powered-Appointment-Scheduler-Assistant\\90_rot.jpg";

async function runTest() {
  console.log("=== Running Pipeline on tes_img2.jpg ===\n");
  
  const buffer = fs.readFileSync(IMAGE_PATH);
  const result = await runPipeline({
    type: "image",
    payload: buffer,
    referenceDate: REFERENCE_DATE
  });
  
  console.log("\nPipeline Output:");
  console.log(JSON.stringify(result, null, 2));
}

runTest().catch(console.error);
