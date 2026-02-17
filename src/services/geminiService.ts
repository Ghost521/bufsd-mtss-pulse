import type { ActivityLog, CalendarEvent, ChatMessage, DashboardData, RAGDocument, StudentDetails, UserRole } from "../types";
import type { AIInterventionPlan, AiRequestMap, AiResponseMap, AnalyzedDocumentResult, ImportAnalysisResult } from "./aiContracts";

export type { AIInterventionPlan, AnalyzedDocumentResult, ImportAnalysisResult } from "./aiContracts";

const API_BASE = (import.meta.env.VITE_AI_API_BASE_URL || "/api/ai").replace(/\/$/, "");

class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isEnvelopeResponse = (value: unknown): value is { ok: boolean; data?: unknown; error?: string; errorDetail?: { message?: string } } =>
  isRecord(value) && typeof value.ok === "boolean";

const postJson = async <TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = response.statusText || "Request failed";
    try {
      const payload = (await response.json()) as { error?: string; errorDetail?: { message?: string } };
      if (typeof payload.error === "string" && payload.error.trim().length > 0) detail = payload.error;
      if (typeof payload.errorDetail?.message === "string" && payload.errorDetail.message.trim().length > 0) {
        detail = payload.errorDetail.message;
      }
    } catch {
      // Best-effort parsing only.
    }
    throw new ApiError(detail, response.status);
  }

  const payload = (await response.json()) as unknown;
  if (isEnvelopeResponse(payload)) {
    if (!payload.ok) {
      const message =
        (typeof payload.errorDetail?.message === "string" && payload.errorDetail.message) ||
        (typeof payload.error === "string" && payload.error) ||
        "Request failed";
      throw new ApiError(message, response.status);
    }

    if (isRecord(payload.data)) {
      return { ...payload, ...payload.data } as TResponse;
    }
  }

  return payload as TResponse;
};

const streamFromText = async (textPromise: Promise<string>, onChunk: (text: string) => void): Promise<void> => {
  try {
    const text = await textPromise;
    if (text) onChunk(text);
  } catch {
    onChunk("\n_AI service unavailable. Please try again._");
  }
};

export const queryRAGChatStream = async (
  query: string,
  history: ChatMessage[],
  contextDocuments: RAGDocument[],
  role: UserRole,
  username: string,
  onChunk: (text: string) => void
): Promise<void> => {
  const request: AiRequestMap["ragChat"] = { query, history, contextDocuments, role, username };
  return streamFromText(
    postJson<AiRequestMap["ragChat"], AiResponseMap["ragChat"]>("/rag-chat", request).then((res) => res.text),
    onChunk
  );
};

export const generateDashboardBriefingStream = async (
  data: DashboardData,
  previousFeedback: string[],
  onChunk: (text: string) => void
): Promise<void> => {
  const request: AiRequestMap["dashboardBriefing"] = { data, previousFeedback };
  return streamFromText(
    postJson<AiRequestMap["dashboardBriefing"], AiResponseMap["dashboardBriefing"]>("/dashboard-briefing", request).then((res) => res.text),
    onChunk
  );
};

export const generateDashboardBriefing = async (data: DashboardData, previousFeedback: string[] = []): Promise<string> => {
  const response = await postJson<AiRequestMap["dashboardBriefing"], AiResponseMap["dashboardBriefing"]>("/dashboard-briefing", {
    data,
    previousFeedback,
  });
  return response.text;
};

export const generateStudentProfileSummaryStream = async (
  student: StudentDetails,
  previousFeedback: string[],
  onChunk: (text: string) => void
): Promise<void> => {
  const request: AiRequestMap["studentProfileSummary"] = { student, previousFeedback };
  return streamFromText(
    postJson<AiRequestMap["studentProfileSummary"], AiResponseMap["studentProfileSummary"]>("/student-profile-summary", request).then((res) => res.text),
    onChunk
  );
};

export const generateStudentProfileSummary = async (student: StudentDetails, previousFeedback: string[] = []): Promise<string> => {
  const response = await postJson<AiRequestMap["studentProfileSummary"], AiResponseMap["studentProfileSummary"]>(
    "/student-profile-summary",
    { student, previousFeedback }
  );
  return response.text;
};

export const generateNotesSummaryStream = async (notes: ActivityLog[], onChunk: (text: string) => void): Promise<void> => {
  const request: AiRequestMap["notesSummary"] = { notes };
  return streamFromText(
    postJson<AiRequestMap["notesSummary"], AiResponseMap["notesSummary"]>("/notes-summary", request).then((res) => res.text),
    onChunk
  );
};

export const generateNotesSummary = async (notes: ActivityLog[]): Promise<string> => {
  const response = await postJson<AiRequestMap["notesSummary"], AiResponseMap["notesSummary"]>("/notes-summary", { notes });
  return response.text;
};

export const refineDraftNote = async (draft: string, category: string): Promise<string> => {
  const response = await postJson<AiRequestMap["refineDraftNote"], AiResponseMap["refineDraftNote"]>("/refine-draft-note", {
    draft,
    category,
  });
  return response.text;
};

export const suggestTagsForNote = async (note: string): Promise<string[]> => {
  const response = await postJson<AiRequestMap["suggestTagsForNote"], AiResponseMap["suggestTagsForNote"]>("/suggest-tags", { note });
  return response.tags;
};

export const generateActionItemPlan = async (
  studentName: string,
  grade: string,
  category: string,
  insight: string
): Promise<{ title: string; notes: string }> => {
  return postJson<AiRequestMap["actionItemPlan"], AiResponseMap["actionItemPlan"]>("/action-item-plan", {
    studentName,
    grade,
    category,
    insight,
  });
};

export const generateStructuredIntervention = async (
  studentName: string,
  grade: string,
  tier: string,
  focusArea: string,
  additionalContext: string = "",
  duration: string = "30 min",
  frequency: string = "Daily"
): Promise<AIInterventionPlan> => {
  const response = await postJson<AiRequestMap["structuredIntervention"], AiResponseMap["structuredIntervention"]>(
    "/structured-intervention",
    { studentName, grade, tier, focusArea, additionalContext, duration, frequency }
  );
  return response.plan;
};

export const generateParentMessage = async (studentName: string, assignmentTitle: string, parentName: string): Promise<string> => {
  const response = await postJson<AiRequestMap["parentMessage"], AiResponseMap["parentMessage"]>("/parent-message", {
    studentName,
    assignmentTitle,
    parentName,
  });
  return response.text;
};

export const analyzeUploadedDocument = async (base64: string, mime: string, name: string): Promise<AnalyzedDocumentResult> => {
  const response = await postJson<AiRequestMap["analyzeUploadedDocument"], AiResponseMap["analyzeUploadedDocument"]>(
    "/analyze-uploaded-document",
    { base64, mime, name }
  );
  return response.result;
};

export const generateFileSummary = async (base64: string, mime: string): Promise<string> => {
  const response = await postJson<AiRequestMap["fileSummary"], AiResponseMap["fileSummary"]>("/file-summary", { base64, mime });
  return response.text;
};

export const generateResourceSummary = async (url: string, type: "WEBSITE" | "YOUTUBE"): Promise<{ title: string; summary: string }> => {
  return postJson<AiRequestMap["resourceSummary"], AiResponseMap["resourceSummary"]>("/resource-summary", { url, type });
};

export const extractDataFromDocument = async (base64: string, mime: string): Promise<unknown[]> => {
  const response = await postJson<AiRequestMap["extractDataFromDocument"], AiResponseMap["extractDataFromDocument"]>(
    "/extract-data-from-document",
    { base64, mime }
  );
  return response.rows;
};

export const analyzeImportedBatch = async (data: unknown[], source: string): Promise<ImportAnalysisResult> => {
  const response = await postJson<AiRequestMap["importBatchAnalysis"], AiResponseMap["importBatchAnalysis"]>(
    "/import-batch-analysis",
    { data, source }
  );
  return response.result;
};

export const suggestMeetingTimes = async (
  attendees: string[],
  duration: number,
  date: string,
  existing: CalendarEvent[]
): Promise<Array<{ start: string; end: string; reason: string }>> => {
  const response = await postJson<AiRequestMap["meetingTimes"], AiResponseMap["meetingTimes"]>("/meeting-times", {
    attendees,
    duration,
    date,
    existing,
  });
  return response.suggestions;
};
