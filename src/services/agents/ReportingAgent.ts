
import { BaseAgent } from "./BaseAgent";
import type { DashboardData, StudentDetails, ActivityLog } from "../../types";
import type { ImportAnalysisResult } from "../aiContracts";
import { normalizeImportAnalysisResult, safeJsonParse } from "./jsonUtils";

export class ReportingAgent extends BaseAgent {

  public async generateDashboardBriefingStream(
    data: DashboardData, 
    previousFeedback: string[], 
    onChunk: (text: string) => void
  ): Promise<void> {
    try {
        const feedbackContext = previousFeedback.length > 0 ? `User Feedback History: ${previousFeedback.join('; ')}` : "";
        const prompt = `
            Role: ${data.role}.
            Context: ${feedbackContext}
            Data: ${JSON.stringify(data)}
            Task: Generate a "Morning Briefing". Summarize key metric, highlight critical action item, provide 1 recommendation.
            Format: Markdown, professional, under 120 words.
        `;

        const stream = await this.ai.models.generateContentStream({
            model: this.model,
            contents: prompt
        });

        for await (const chunk of stream) {
            if (chunk.text) onChunk(chunk.text);
        }
    } catch {
        onChunk("Briefing unavailable.");
    }
  }

  public async generateStudentProfileSummaryStream(student: StudentDetails, previousFeedback: string[], onChunk: (text: string) => void): Promise<void> {
    try {
        const prompt = `
            Analyze Student: ${JSON.stringify(student)}
            Task: Create a "Student Profile Summary". Highlight academic standing, tier, trends, and 1 actionable recommendation.
            Format: Markdown, objective, under 150 words.
        `;
        
        const stream = await this.ai.models.generateContentStream({
            model: this.model,
            contents: prompt
        });

        for await (const chunk of stream) {
            if (chunk.text) onChunk(chunk.text);
        }
    } catch {
        onChunk("Summary unavailable.");
    }
  }

  public async analyzeImportedBatch(data: unknown[], sourceType: string): Promise<ImportAnalysisResult> {
    try {
        const sample = data.slice(0, 50);
        const prompt = `
            Analyze imported data sample (${data.length} rows) from ${sourceType}.
            Sample: ${JSON.stringify(sample)}
            Return JSON: { summary: string, anomalies: string[], recommendations: string[] }
        `;

        const response = await this.ai.models.generateContent({
            model: this.model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        const parsed = safeJsonParse<unknown>(response.text, {});
        return normalizeImportAnalysisResult(parsed);
    } catch {
        return { summary: "Analysis failed.", anomalies: [], recommendations: [] };
    }
  }

  public async generateNotesSummaryStream(notes: ActivityLog[], onChunk: (text: string) => void): Promise<void> {
    try {
      const prompt = `
        Summarize these student activity notes into 3-5 concise bullets with trend observations.
        Notes: ${JSON.stringify(notes)}
        Format: Markdown.
      `;
      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        contents: prompt
      });

      for await (const chunk of stream) {
        if (chunk.text) onChunk(chunk.text);
      }
    } catch {
      onChunk("Notes summary unavailable.");
    }
  }

  public async refineDraftNote(draft: string, category: string): Promise<string> {
      try {
          const response = await this.ai.models.generateContent({
              model: this.model,
              contents: `Rewrite this student note to be professional and objective. Category: ${category}. Draft: "${draft}"`
          });
          return response.text || draft;
      } catch { return draft; }
  }

  public async suggestTagsForNote(note: string): Promise<string[]> {
      try {
          const response = await this.ai.models.generateContent({
              model: this.model,
              contents: `Suggest 3-5 short JSON string tags for this student note: "${note}". Return JSON array.`,
              config: { responseMimeType: 'application/json' }
          });
          const parsed = safeJsonParse<unknown>(response.text, []);
          return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
      } catch { return []; }
  }
}
