# AI-powered-Appointment-Scheduler-Assistant
OCR to enitity recog to normalization

## How to Test

### Live Cloud Deployment 🚀
The API is fully deployed to a Google Cloud Run serverless instance. You can test it immediately without running the code locally by replacing `http://localhost:3000` with the live URL in any of the test commands below:

**Base URL:** `https://appointment-api-916144154652.asia-south1.run.app`

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
## API Documentation

The backend exposes a single endpoint that dynamically handles both JSON text payloads and multipart image uploads.

**Endpoint:** `POST /api/appointment`

### 1. Text Request (JSON)
If you want to test the natural language processing without an image, you can send a JSON payload.

#### Using cURL
```bash
curl -X POST http://localhost:3000/api/appointment \
  -H "Content-Type: application/json" \
  -d '{"type":"text","payload":"Book dentist tomorrow at 3pm"}'
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
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\90_rot.jpg"
```

#### 2. Heavily Blurred Image
Tests the safety guardrail. Should safely reject with a `needs_clarification` status.
```powershell
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\blur.jpg"
```

#### 3. Clean Screenshot
Tests the baseline happy path.
```powershell
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\perf.jpg"
```

#### 4. Email Screenshot (Clean)
Tests the pipeline's ability to extract data from a standard email UI.
```powershell
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\email_clean.png"
```

#### 5. Email Thread Screenshot (Conflicting Info)
Tests the pipeline's ability to handle an email thread where a follow-up message changes the time ("sorry my bad change it to 4pm").
```powershell
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\email_thread.png"
```

#### 6. Angled Photos (Perspective Distortion)
Tests the pipeline's robustness against camera angles.
```powershell
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\angled.jpg"
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\ang_lef.jpg"
```

#### 7. Handwritten Note
Tests the pipeline on handwritten text.
```powershell
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\processed_handwriting.png"
```

#### 8. Dark & Light Theme Polarity
Tests the OCR engine's ability to handle inverted contrast (white-on-black vs black-on-white text).
```powershell
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\dark_theme.png"
curl.exe -X POST http://localhost:3000/api/appointment -F "image=@test_images\light_theme.png"
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
