# AI-powered-Appointment-Scheduler-Assistant
OCR to enitity recog to normalization

## How to Test

### Live Cloud Deployment
The API is fully deployed to a Google Cloud Run serverless instance. You can test it immediately without running the code locally by replacing `http://localhost:3000` with the live URL in any of the test commands below:

**Base URL:** `https://appointment-api-916144154652.asia-south1.run.app`

**Example Command (Live Cloud):**
```powershell
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\perf.jpg"
```

### Running Locally
If you prefer to run the code locally, ensure you have the `GEMINI_API_KEY` set in your `.env` file, then run:

```bash
npm install
npm run dev
```
The local server will start on `http://localhost:3000`.

## Architecture
The system uses a 4-step pipeline with deterministic confidence scoring and strict guardrails.

1. **OCR / Text Extraction:** Uses `tesseract.js` for initial extraction. For images, if the baseline confidence is `< 0.75`, it performs a brute-force auto-rotation (0, 90, 180, 270 degrees) using `sharp` to find the clearest orientation.
2. **Entity Extraction:** Uses Gemini 3.1 Flash Lite (`@google/genai`) to extract date, time, and department phrases. It relies on a "3-Signal Mathematical Formula" for confidence: Completeness (50%), Regex Agreement (30%), and LLM Self-Report (20%).
3. **Normalization:** Uses `chrono-node` to parse extracted time phrases into ISO format. Resolves ambiguities (like `next Friday at 3` vs `3pm`) and enforces the `Asia/Kolkata` timezone. Uses a dictionary map for department normalization.
4. **Final Aggregation:** Combines all confidence scores. If the overall confidence falls below `0.70`, the system aborts and returns a safe `needs_clarification` response instead of a hallucinated appointment.

## Confidence Mathematics

The pipeline computes three isolated confidence scores that determine whether the request proceeds or triggers a safety guardrail.

### 1. OCR Confidence ($C_{ocr}$)
For images, Tesseract calculates a confidence score $c_i \in [0, 1]$ for each recognized word. The overall OCR confidence is the mean across $N$ words:
$$C_{ocr} = \frac{1}{N} \sum_{i=1}^{N} c_i$$
*(For pure JSON text payloads, $C_{ocr}$ is hardcoded to $1.0$)*

### 2. Entity Extraction Confidence ($C_{ext}$)
Calculated dynamically by the LLM and penalized mathematically based on input length $L$ (to punish noise like email threads).
$$C_{ext} = \max(0,\ C_{LLM} - P(L))$$
Where $P(L) = 0.1$ if $L > 100$ characters, else $0$.

### 3. Normalization Confidence ($C_{norm}$)
Calculated deterministically by the Chrono parsing engine. Base confidence is $1.0$, penalized by specific parse ambiguities:
$$C_{norm} = \max(0,\ 1.0 - \sum \text{Penalties})$$
*Penalties:* Multiple conflicting dates ($-0.3$), Resolved to past ($-0.3$), Missing time component ($-0.4$), Unresolvable AM/PM ambiguity ($-0.5$).

---

## The 10 Safety Guardrails
The system implements 10 rigid `needs_clarification` gates to prevent AI hallucinations. If any gate triggers, execution halts immediately.

1. **G1 (Blank Input):** Fired if the OCR engine or payload returns empty text.
2. **G2 (Low OCR Confidence):** Fired if $C_{ocr} < 0.75$. Auto-rotation fallback loops run first; if all 4 angles fail, this triggers.
3. **G3 (Missing Date & Time):** Fired if the LLM cannot extract *both* a date phrase and a time phrase.
4. **G4 (Missing Department):** Fired if the LLM cannot extract a target medical department.
5. **G5 (Low Extraction Confidence):** Fired if $C_{ext} < 0.60$. Prevents hallucinations on heavily corrupted text.
6. **G6 (Parse Failure):** Fired if `chrono-node` fundamentally cannot map the extracted phrase to a timestamp.
7. **G7 (Missing Normalized Date):** Fired if chrono extracts a time but cannot anchor a precise calendar date.
8. **G8 (Missing Normalized Time):** Fired if chrono extracts a date but cannot determine an exact hour/minute.
9. **G9 (AM/PM Ambiguity):** Fired if the user provides a bare hour (e.g., "at 11") and it falls in an ambiguous band where the clinic cannot safely assume AM or PM.
10. **G10 (Unmapped Department):** Fired if the requested department does not map to a supported internal clinic ID (e.g., "cardiology").

## API Documentation

The backend exposes a single endpoint that dynamically handles both JSON text payloads and multipart image uploads.

**Endpoint:** `POST /api/appointment`

### 1. Text Request (JSON)
If you want to test the natural language processing without an image, you can send a JSON payload.

#### Using cURL (Windows PowerShell)
```powershell
# Local
cmd /c 'curl.exe -X POST http://localhost:3000/api/appointment -H "Content-Type: application/json" -d "{\"type\":\"text\",\"payload\":\"Book dentist tomorrow at 3pm\"}"'

# Cloud
cmd /c 'curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -H "Content-Type: application/json" -d "{\"type\":\"text\",\"payload\":\"Book dentist tomorrow at 3pm\"}"'
```

#### Using Postman
1. Method: `POST`, URL: `http://localhost:3000/api/appointment`
2. Go to **Body** -> select **raw** -> select **JSON**.
3. Paste the following:
```json
{
  "type": "text",
  "payload": "Book dentist tomorrow at 3pm"
}
```

### 2. Image Upload Request (Multipart)
The repository contains a `test_images/` folder with a comprehensive suite of sample images covering various edge cases.

Here is the exhaustive list of `curl.exe` commands (for Windows PowerShell) and standard `curl` commands (for Mac/Linux/Bash) to test each specific scenario. 

**Note for Windows Users:** If you are using PowerShell, you MUST use `curl.exe` instead of just `curl`, because `curl` is an alias for a different command in PowerShell.

#### 1. Rotated Image (90 Degrees)
Tests the auto-rotation brute-force fallback.
```powershell
# Local
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\90_rot.jpg"

# Cloud
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\90_rot.jpg"
```

#### 2. Heavily Blurred Image
Tests the safety guardrail. Should safely reject with a `needs_clarification` status.
```powershell
# Local
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\blur.jpg"

# Cloud
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\blur.jpg"
```

#### 3. Clean Screenshot
Tests the baseline happy path.
```powershell
# Local
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\perf.jpg"

# Cloud
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\perf.jpg"
```

#### 4. Email Screenshot (Clean)
Tests the pipeline's ability to extract data from a standard email UI.
```powershell
# Local
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\email_clean.png"

# Cloud
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\email_clean.png"
```

#### 5. Email Thread Screenshot (Conflicting Info)
Tests the pipeline's ability to handle an email thread where a follow-up message changes the time ("sorry my bad change it to 4pm").
```powershell
# Local
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\email_thread.png"

# Cloud
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\email_thread.png"
```

#### 6. Angled Photos (Perspective Distortion)
Tests the pipeline's robustness against camera angles.
```powershell
# Local
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\angled.jpg"
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\ang_lef.jpg"

# Cloud
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\angled.jpg"
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\ang_lef.jpg"
```

#### 7. Handwritten Note
Tests the pipeline on handwritten text.
```powershell
# Local
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\processed_handwriting.png"

# Cloud
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\processed_handwriting.png"
```

#### 8. Dark & Light Theme Polarity
Tests the OCR engine's ability to handle inverted contrast (white-on-black vs black-on-white text).
```powershell
# Local
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\dark_theme.png"
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\light_theme.png"

# Cloud
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\dark_theme.png"
curl.exe -X POST https://appointment-api-916144154652.asia-south1.run.app/api/appointment -F "image=@test_images\light_theme.png"
```

*(Mac/Linux users: Simply replace `curl.exe` with `curl` and `\` with `/` in the paths above).*

#### Using Postman
1. Method: `POST`, URL: `http://localhost:3000/api/appointment`
2. Go to **Body** -> select **form-data**.
3. Add a new key named `image`.
4. Hover over the key type (usually says "Text") and change it to **File**.
5. Under the Value column, click "Select Files" and pick one of the sample images (e.g. `90_rot.jpg`) from your local `test_images/` repository folder.
6. Hit Send!

## Expected Response
A successful extraction will return:
```json
{
  "status": "ok",
  "appointment": {
    "department": "Dentistry",
    "date": "2026-08-18",
    "time": "15:00",
    "tz": "Asia/Kolkata"
  }
}
```
If the image is too blurry (like `blur.jpg`), the pipeline will safely trigger a guardrail and return:
```json
{
  "status": "needs_clarification",
  "message": "Input text could not be read clearly — please retype or resend a clearer image"
}
```

## Known Limitations & Best Practices
- **Multi-Column Screenshots:** The pipeline assumes screenshots primarily contain single-column message content. Screenshots that include wide inbox sidebars or navigation panes alongside the reading pane may produce interleaved, garbled text due to raster-order OCR constraints. For best results, crop screenshots specifically to the message body.
