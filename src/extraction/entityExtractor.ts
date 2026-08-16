import { z } from "zod";
import { GoogleGenAI, Type, Schema } from "@google/genai";

// Load environment variables if they haven't been loaded already
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({});

export const EntitiesSchema = z.object({
  date_phrase: z.string().nullable(),
  time_phrase: z.string().nullable(),
  department: z.string().nullable(),
  self_reported_confidence: z.number().min(0).max(1),
});

export type Entities = z.infer<typeof EntitiesSchema>;

// We can translate Zod to GenAI Schema to enforce structured outputs
const entitiesResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    date_phrase: { type: Type.STRING, nullable: true, description: "The raw date phrase extracted from the text, e.g., 'next Friday', 'tomorrow'" },
    time_phrase: { type: Type.STRING, nullable: true, description: "The raw time phrase extracted from the text, e.g., '3pm', 'in the morning'" },
    department: { type: Type.STRING, nullable: true, description: "The medical department requested, e.g., 'dentist', 'cardiology'" },
    self_reported_confidence: { type: Type.NUMBER, description: "Your confidence (0.0 to 1.0) that you have correctly extracted the requested entities without guessing." },
  },
  required: ["self_reported_confidence"]
};

const SYSTEM_INSTRUCTION = `You are an entity extraction system for a medical appointment booking assistant.
Extract the raw date phrase, time phrase, and department from the user's request.
CRITICAL RULES:
- Return \`null\` for any field not explicitly stated. NEVER infer or guess a value that isn't in the text.
- Extract the RAW PHRASE exactly as it appears in the text (e.g., if they say "next Friday", return "next Friday", NOT an ISO date).
- Provide a \`self_reported_confidence\` score from 0.0 to 1.0. Give a high score (0.9-1.0) if the entities are clearly stated. Give a low score (< 0.5) if the text is ambiguous, garbled, or completely unrelated.
- Example 1: "Book dentist next Friday at 3pm" -> { date_phrase: "next Friday", time_phrase: "3pm", department: "dentist", self_reported_confidence: 0.95 }
- Example 2: "book dentist" -> { date_phrase: null, time_phrase: null, department: "dentist", self_reported_confidence: 0.8 }
`;

export async function extractEntities(rawText: string): Promise<{ entities: Entities; entities_confidence: number }> {
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: rawText,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: entitiesResponseSchema,
            temperature: 0.1, // Keep it deterministic
        }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response from model");
    }

    const rawJSON = JSON.parse(responseText);
    const parsed = EntitiesSchema.parse(rawJSON);

    // --- Confidence Calculation: 3-Signal Design ---
    // We combine three independent signals:
    // 1. Completeness Score (0.5 weight): Are the critical fields present?
    // 2. Agreement Score (0.3 weight): Does a dumb regex pass agree with the LLM?
    // 3. LLM Self-Reported (0.2 weight): The model's own confidence (low weight to limit hallucination impact).
    
    // 1. Completeness Score (0.0 to 1.0)
    let completeness_score = 1.0;
    if (!parsed.date_phrase && !parsed.time_phrase) {
        completeness_score = 0.0; // Both missing is highly incomplete
    } else if (!parsed.date_phrase || !parsed.time_phrase) {
        completeness_score = 0.7; // One missing is slightly incomplete
    }

    // 2. Agreement Score (0.0 to 1.0)
    let agreement_score = 1.0;
    const textLower = rawText.toLowerCase();
    
    // Simple regex for days of week and common time formats (AM/PM or HH:MM)
    const dayOfWeekRegex = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday)/i;
    const timeRegex = /\b(1[0-2]|0?[1-9])(:[0-5][0-9])?\s*(am|pm)\b|\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/i;
    
    // Check Date Agreement
    const regexFoundDate = dayOfWeekRegex.test(textLower);
    const llmFoundDate = !!parsed.date_phrase;
    
    if (regexFoundDate && !llmFoundDate) {
        agreement_score -= 0.2; 
    }

    // Check Time Agreement
    const regexFoundTime = timeRegex.test(textLower);
    const llmFoundTime = !!parsed.time_phrase;
    
    if (regexFoundTime && !llmFoundTime) {
        agreement_score -= 0.4; // Heavy penalty: regex saw clear time format but LLM missed it
    }

    // Check Department Agreement
    const deptRegex = /\b(dentist|dental|cardiology|cardiologist|ent|physio|general)\b/i;
    const regexFoundDept = deptRegex.test(textLower);
    const llmFoundDept = !!parsed.department;
    
    if (regexFoundDept && !llmFoundDept) {
        agreement_score -= 0.3;
    } else if (!regexFoundDept && llmFoundDept) {
        agreement_score -= 0.2; // LLM extracted something regex didn't know about. Slight dock.
    }
    
    agreement_score = Math.max(0, agreement_score); // Floor at 0

    // 3. Final Composite Calculation
    const WEIGHT_COMPLETENESS = 0.5;
    const WEIGHT_AGREEMENT = 0.3;
    const WEIGHT_LLM = 0.2;

    const llm_score = parsed.self_reported_confidence;

    let confidence = 
        (completeness_score * WEIGHT_COMPLETENESS) + 
        (agreement_score * WEIGHT_AGREEMENT) + 
        (llm_score * WEIGHT_LLM);
    
    // Round to 2 decimal places
    confidence = Math.round(confidence * 100) / 100;

    return {
      entities: parsed,
      entities_confidence: confidence,
    };
  } catch (error) {
    console.error("Error extracting entities:", error);
    // In a real system, you might want to differentiate between model failure and validation failure
    return {
      entities: { date_phrase: null, time_phrase: null, department: null, self_reported_confidence: 0 },
      entities_confidence: 0.0,
    };
  }
}
