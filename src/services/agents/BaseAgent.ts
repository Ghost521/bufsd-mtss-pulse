
import { GoogleGenAI } from "@google/genai";

export abstract class BaseAgent {
  protected static readonly TEXT_MODEL = "gemini-3-flash-preview";
  protected static readonly IMAGE_MODEL = "gemini-3-pro-image-preview";

  protected ai: GoogleGenAI;
  protected model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY for AI agent initialization.");
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.model = BaseAgent.TEXT_MODEL;
  }

  protected getModel(modelName?: string): string {
    return modelName || this.model;
  }

  protected getTextModel(): string {
    return this.model;
  }

  protected getImageModel(): string {
    return BaseAgent.IMAGE_MODEL;
  }

  protected isModelUnavailableError(error: unknown): boolean {
    const message =
      error instanceof Error && error.message ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
    return (
      message.includes("quota") ||
      message.includes("resource exhausted") ||
      message.includes("rate limit") ||
      message.includes("model not found") ||
      (message.includes("model") && message.includes("not available")) ||
      message.includes("unsupported model")
    );
  }
}
