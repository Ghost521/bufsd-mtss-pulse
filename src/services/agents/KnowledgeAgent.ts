
import { BaseAgent } from "./BaseAgent";
import type { AnalyzedDocumentResult } from "../aiContracts";
import { safeJsonParse } from "./jsonUtils";

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp',
  'audio/wav', 'audio/mp3',
  'video/mp4'
];

const shouldUseImageModel = (mimeType: string): boolean =>
  mimeType === "application/pdf" || mimeType.startsWith("image/");

export class KnowledgeAgent extends BaseAgent {
  
  public async generateFileSummary(base64Data: string, mimeType: string): Promise<string> {
    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
        if (mimeType.startsWith('text/') || mimeType === 'application/json') {
            try {
                const text = atob(base64Data).substring(0, 8000);
                const response = await this.ai.models.generateContent({
                    model: this.getTextModel(),
                    contents: `Summarize this text:\n\n${text}`
                });
                return response.text || "Summary unavailable.";
            } catch (error) {
              if (this.isModelUnavailableError(error)) throw error;
              return "Text decoding failed.";
            }
        }
        return "Format not supported for AI analysis.";
    }

    try {
      const response = await this.ai.models.generateContent({
        model: shouldUseImageModel(mimeType) ? this.getImageModel() : this.getTextModel(),
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: "Analyze this document. Provide a 2-3 sentence summary covering the main topic, key entities, and purpose." }
          ]
        }
      });
      return response.text || "Summary unavailable.";
    } catch (error) {
      if (this.isModelUnavailableError(error)) throw error;
      console.error("KnowledgeAgent error:", error);
      return "Analysis failed.";
    }
  }

  public async generateResourceSummary(url: string, resourceType: 'WEBSITE' | 'YOUTUBE'): Promise<{ title: string; summary: string }> {
    try {
      const prompt = resourceType === 'YOUTUBE' 
        ? `Analyze YouTube video: ${url}. Transcribe audio/speech conceptual content and summarize.`
        : `Visit ${url}. Provide Title and Summary of the web page content.`;

      const response = await this.ai.models.generateContent({
        model: this.getTextModel(),
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      const text = response.text || "";
      const titleMatch = text.match(/Title:\s*(.+)/i);
      const summaryMatch = text.match(/Summary:\s*(.+)/is);

      return {
        title: titleMatch ? titleMatch[1].trim() : "External Resource",
        summary: summaryMatch ? summaryMatch[1].trim() : text.substring(0, 100) + "..."
      };
    } catch (error) {
      if (this.isModelUnavailableError(error)) throw error;
      return { title: "Resource", summary: "AI summary unavailable." };
    }
  }

  public async extractDataFromDocument(base64Data: string, mimeType: string): Promise<unknown[]> {
    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) return [];

    try {
      const response = await this.ai.models.generateContent({
        model: shouldUseImageModel(mimeType) ? this.getImageModel() : this.getTextModel(),
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: "Extract tabular student data from this document into a JSON array. Keys: name, id, grade, score." }
          ]
        },
        config: { responseMimeType: 'application/json' }
      });

      if (response.text) {
        const parsed = safeJsonParse<unknown>(response.text, []);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (error) {
      if (this.isModelUnavailableError(error)) throw error;
      console.error("Extraction error:", error);
      return [];
    }
  }

  public async analyzeUploadedDocument(base64Data: string, mimeType: string, studentName: string): Promise<AnalyzedDocumentResult> {
    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
        return { type: 'Academic', date: 'Today', summary: 'Unsupported file type.', suggestedAction: 'Manual review.' };
    }

    try {
      const response = await this.ai.models.generateContent({
        model: shouldUseImageModel(mimeType) ? this.getImageModel() : this.getTextModel(),
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: `Analyze document for student "${studentName}". Return JSON with keys: type (Academic/Behavior/Attendance/Intervention), date, summary, suggestedAction.` }
          ]
        },
        config: { responseMimeType: 'application/json' }
      });

      if (response.text) {
        const fallback: AnalyzedDocumentResult = {
          type: 'Academic',
          date: 'Unknown',
          summary: 'AI analysis failed.',
          suggestedAction: 'Review manually.'
        };
        const parsed = safeJsonParse<unknown>(response.text, fallback);
        if (!parsed || typeof parsed !== "object") return fallback;
        const candidate = parsed as Partial<AnalyzedDocumentResult>;
        return {
          type:
            candidate.type === "Academic" ||
            candidate.type === "Behavior" ||
            candidate.type === "Attendance" ||
            candidate.type === "Intervention"
              ? candidate.type
              : fallback.type,
          date: typeof candidate.date === "string" ? candidate.date : fallback.date,
          summary: typeof candidate.summary === "string" ? candidate.summary : fallback.summary,
          suggestedAction:
            typeof candidate.suggestedAction === "string"
              ? candidate.suggestedAction
              : fallback.suggestedAction,
        };
      }
      throw new Error("Empty response");
    } catch (error) {
      if (this.isModelUnavailableError(error)) throw error;
      return { type: 'Academic', date: 'Unknown', summary: 'AI analysis failed.', suggestedAction: 'Review manually.' };
    }
  }
}
