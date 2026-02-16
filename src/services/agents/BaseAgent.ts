
import { GoogleGenAI } from "@google/genai";

export abstract class BaseAgent {
  protected ai: GoogleGenAI;
  protected model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY for AI agent initialization.");
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.model = 'gemini-2.5-flash';
  }

  protected getModel(modelName?: string): string {
    return modelName || this.model;
  }
}
