import { runPipeline } from "./pipeline/graph";
import * as fs from "fs";

const REFERENCE_DATE = new Date("2026-08-12T12:00:00Z");
const IMAGE_PATH = "C:\\Users\\sankr\\.gemini\\antigravity-ide\\brain\\52e1235b-b631-4a22-92b0-f61b39a82ed6\\.user_uploaded\\media_1786960109150.png";

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
