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
});

export type Entities = z.infer<typeof EntitiesSchema>;

// We can translate Zod to GenAI Schema to enforce structured outputs
const entitiesResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    date_phrase: { type: Type.STRING, nullable: true, description: "The raw date phrase extracted from the text, e.g., 'next Friday', 'tomorrow'" },
    time_phrase: { type: Type.STRING, nullable: true, description: "The raw time phrase extracted from the text, e.g., '3pm', 'in the morning'" },
    department: { type: Type.STRING, nullable: true, description: "The medical department requested, e.g., 'dentist', 'cardiology'" },
  },
};

const SYSTEM_INSTRUCTION = `You are an entity extraction system for a medical appointment booking assistant.
Extract the raw date phrase, time phrase, and department from the user's request.
CRITICAL RULES:
- Return \`null\` for any field not explicitly stated. NEVER infer or guess a value that isn't in the text.
- Extract the RAW PHRASE exactly as it appears in the text (e.g., if they say "next Friday", return "next Friday", NOT an ISO date).
- Example 1: "Book dentist next Friday at 3pm" -> { date_phrase: "next Friday", time_phrase: "3pm", department: "dentist" }
- Example 2: "book dentist" -> { date_phrase: null, time_phrase: null, department: "dentist" } (Do not fabricate date/time!)
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

    // Baseline confidence calculation
    // Since we aren't doing the regex cross-check yet, we'll assign a baseline score.
    // If we extracted at least something, we are moderately confident. If nothing, lower.
    let confidence = 0.9;
    
    // Penalize slightly if some core fields are missing (makes it ambiguous, though that's handled downstream too)
    if (!parsed.date_phrase && !parsed.time_phrase) {
        confidence = 0.6; // Will likely trigger needs_clarification in pipeline
    }

    return {
      entities: parsed,
      entities_confidence: confidence,
    };
  } catch (error) {
    console.error("Error extracting entities:", error);
    // In a real system, you might want to differentiate between model failure and validation failure
    return {
      entities: { date_phrase: null, time_phrase: null, department: null },
      entities_confidence: 0.0,
    };
  }
}
