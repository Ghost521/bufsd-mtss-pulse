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
  ragChat: { text: string };
  dashboardBriefing: { text: string };
  studentProfileSummary: { text: string };
  notesSummary: { text: string };
  refineDraftNote: { text: string };
  suggestTagsForNote: { tags: string[] };
  actionItemPlan: { title: string; notes: string };
  structuredIntervention: { plan: AIInterventionPlan };
  parentMessage: { text: string };
  analyzeUploadedDocument: { result: AnalyzedDocumentResult };
  fileSummary: { text: string };
  resourceSummary: { title: string; summary: string };
  extractDataFromDocument: { rows: unknown[] };
  importBatchAnalysis: { result: ImportAnalysisResult };
  meetingTimes: { suggestions: Array<{ start: string; end: string; reason: string }> };
}
