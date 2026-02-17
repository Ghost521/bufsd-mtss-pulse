import type { ActivityLog, CalendarEvent, ChatMessage, DashboardData, RAGDocument, StudentDetails, UserRole } from "../types";

export interface AnalyzedDocumentResult {
  type: "Academic" | "Behavior" | "Attendance" | "Intervention";
  date: string;
  summary: string;
  suggestedAction?: string;
}

export interface AIInterventionPlan {
  title: string;
  strategy: string;
  frequency: string;
  duration: string;
  monitoringMethod: string;
  baseline: number;
  goal: number;
  lessonPlan: {
    objective: string;
    materials: string[];
    procedure: string[];
    assessment: string;
    differentiation: string;
  };
}

export interface ImportAnalysisResult {
  summary: string;
  anomalies: string[];
  recommendations: string[];
}

export type AiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface AiErrorDetail {
  code: AiErrorCode;
  message: string;
  retryable: boolean;
}

export interface AiResponseMeta {
  endpoint: string;
  timestamp: string;
  model?: string;
  citations?: string[];
  confidence?: "high" | "medium" | "low";
  abstained?: boolean;
  tools?: Array<{
    name: string;
    ok: boolean;
    durationMs: number;
  }>;
}

export interface AiEnvelope<T extends Record<string, unknown>> {
  ok: boolean;
  requestId: string;
  data: T | null;
  error?: string;
  errorDetail?: AiErrorDetail;
  meta: AiResponseMeta;
}

type AiEndpointResponse<T extends Record<string, unknown>> = AiEnvelope<T> & T;

export interface AiRequestMap {
  ragChat: {
    query: string;
    history: ChatMessage[];
    contextDocuments: RAGDocument[];
    role: UserRole;
    username: string;
  };
  dashboardBriefing: {
    data: DashboardData;
    previousFeedback: string[];
  };
  studentProfileSummary: {
    student: StudentDetails;
    previousFeedback: string[];
  };
  notesSummary: {
    notes: ActivityLog[];
  };
  refineDraftNote: {
    draft: string;
    category: string;
  };
  suggestTagsForNote: {
    note: string;
  };
  actionItemPlan: {
    studentName: string;
    grade: string;
    category: string;
    insight: string;
  };
  structuredIntervention: {
    studentName: string;
    grade: string;
    tier: string;
    focusArea: string;
    additionalContext?: string;
    duration?: string;
    frequency?: string;
  };
  parentMessage: {
    studentName: string;
    assignmentTitle: string;
    parentName: string;
  };
  analyzeUploadedDocument: {
    base64: string;
    mime: string;
    name: string;
  };
  fileSummary: {
    base64: string;
    mime: string;
  };
  resourceSummary: {
    url: string;
    type: "WEBSITE" | "YOUTUBE";
  };
  extractDataFromDocument: {
    base64: string;
    mime: string;
  };
  importBatchAnalysis: {
    data: unknown[];
    source: string;
  };
  meetingTimes: {
    attendees: string[];
    duration: number;
    date: string;
    existing: CalendarEvent[];
  };
}

export interface AiResponseMap {
  ragChat: AiEndpointResponse<{ text: string }>;
  dashboardBriefing: AiEndpointResponse<{ text: string }>;
  studentProfileSummary: AiEndpointResponse<{ text: string }>;
  notesSummary: AiEndpointResponse<{ text: string }>;
  refineDraftNote: AiEndpointResponse<{ text: string }>;
  suggestTagsForNote: AiEndpointResponse<{ tags: string[] }>;
  actionItemPlan: AiEndpointResponse<{ title: string; notes: string }>;
  structuredIntervention: AiEndpointResponse<{ plan: AIInterventionPlan }>;
  parentMessage: AiEndpointResponse<{ text: string }>;
  analyzeUploadedDocument: AiEndpointResponse<{ result: AnalyzedDocumentResult }>;
  fileSummary: AiEndpointResponse<{ text: string }>;
  resourceSummary: AiEndpointResponse<{ title: string; summary: string }>;
  extractDataFromDocument: AiEndpointResponse<{ rows: unknown[] }>;
  importBatchAnalysis: AiEndpointResponse<{ result: ImportAnalysisResult }>;
  meetingTimes: AiEndpointResponse<{ suggestions: Array<{ start: string; end: string; reason: string }> }>;
}
