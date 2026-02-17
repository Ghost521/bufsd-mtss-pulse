import type { ActivityLog, CalendarEvent, ChatMessage, DashboardData, RAGDocument, StudentDetails, UserRole } from "../types";
import type {
  AIInterventionPlan,
  AiRequestMap,
  AiResponseMap,
  AiStreamDoneEvent,
  AiStreamErrorEvent,
  AnalyzedDocumentResult,
  ImportAnalysisResult,
} from "./aiContracts";

export type { AIInterventionPlan, AnalyzedDocumentResult, ImportAnalysisResult } from "./aiContracts";

const API_BASE = (import.meta.env.VITE_AI_API_BASE_URL || "/api/ai").replace(/\/$/, "");
const DEBUG_STREAM = import.meta.env.VITE_MTSS_DEBUG_STREAM === "true";
const DEFAULT_IDLE_TIMEOUT_MS = 20_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 90_000;

class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isEnvelopeResponse = (value: unknown): value is { ok: boolean; data?: unknown; error?: string; errorDetail?: { message?: string } } =>
  isRecord(value) && typeof value.ok === "boolean";

const responseErrorMessage = async (response: Response): Promise<string> => {
  let detail = response.statusText || "Request failed";
  try {
    const payload = (await response.json()) as { error?: string; errorDetail?: { message?: string } };
    if (typeof payload.error === "string" && payload.error.trim().length > 0) detail = payload.error;
    if (typeof payload.errorDetail?.message === "string" && payload.errorDetail.message.trim().length > 0) {
      detail = payload.errorDetail.message;
    }
  } catch {
    // best effort only
  }
  return detail;
};

const postJson = async <TRequest, TResponse>(path: string, body: TRequest): Promise<TResponse> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(await responseErrorMessage(response), response.status);
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

const parseSseEventBlock = (block: string): { event: string; data: unknown } | null => {
  if (!block.trim()) return null;

  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  const payload = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(payload) as unknown };
  } catch {
    return { event, data: payload };
  }
};

const nextSseBoundaryIndex = (buffer: string): number => buffer.indexOf("\n\n");

const toApiError = (error: unknown, fallback: string): ApiError => {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError(error.message || fallback, 408);
  }
  if (error instanceof Error) return new ApiError(error.message || fallback);
  return new ApiError(fallback);
};

const streamSse = async <TRequest>(
  path: string,
  body: TRequest,
  onChunk: (text: string) => void,
  options?: {
    signal?: AbortSignal;
    idleTimeoutMs?: number;
    timeoutMs?: number;
  }
): Promise<AiStreamDoneEvent | undefined> => {
  const idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const externalSignal = options?.signal;
  let linkedAbortCleanup: (() => void) | undefined;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      const onAbort = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener("abort", onAbort, { once: true });
      linkedAbortCleanup = () => externalSignal.removeEventListener("abort", onAbort);
    }
  }

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let requestTimer: ReturnType<typeof setTimeout> | undefined;

  const touchIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      controller.abort(new DOMException(`AI stream idle timeout after ${idleTimeoutMs}ms`, "AbortError"));
    }, idleTimeoutMs);
  };

  requestTimer = setTimeout(() => {
    controller.abort(new DOMException(`AI stream request timeout after ${timeoutMs}ms`, "AbortError"));
  }, timeoutMs);
  touchIdleTimer();

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "x-ai-stream": "1",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).catch((error) => {
    throw toApiError(error, "Failed to connect to AI stream.");
  });

  if (!response.ok) {
    if (idleTimer) clearTimeout(idleTimer);
    if (requestTimer) clearTimeout(requestTimer);
    linkedAbortCleanup?.();
    throw new ApiError(await responseErrorMessage(response), response.status);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    if (idleTimer) clearTimeout(idleTimer);
    if (requestTimer) clearTimeout(requestTimer);
    linkedAbortCleanup?.();
    if (DEBUG_STREAM) console.debug(`[MTSS stream] non-stream fallback for ${path}`);
    const payload = (await response.json()) as unknown;
    if (isEnvelopeResponse(payload) && payload.ok && isRecord(payload.data) && typeof payload.data.text === "string") {
      onChunk(payload.data.text);
    } else if (isRecord(payload) && typeof payload.text === "string") {
      onChunk(payload.text);
    }
    return undefined;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: AiStreamDoneEvent | undefined;
  let doneEventReceived = false;

  const cleanup = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (requestTimer) clearTimeout(requestTimer);
    linkedAbortCleanup?.();
  };

  const processEvent = (eventBlock: string) => {
    const parsed = parseSseEventBlock(eventBlock);
    if (!parsed) return;
    touchIdleTimer();
    if (DEBUG_STREAM) console.debug(`[MTSS stream] ${path} event`, parsed.event);

    if (parsed.event === "chunk" && isRecord(parsed.data) && typeof parsed.data.text === "string") {
      onChunk(parsed.data.text);
      return;
    }

    if (parsed.event === "error") {
      const payload = parsed.data as Partial<AiStreamErrorEvent>;
      const message = typeof payload.message === "string" ? payload.message : "Streaming request failed";
      throw new ApiError(message, 500);
    }

    if (parsed.event === "done" && isRecord(parsed.data)) {
      donePayload = parsed.data as AiStreamDoneEvent;
      doneEventReceived = true;
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      touchIdleTimer();
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      let boundaryIndex = nextSseBoundaryIndex(buffer);

      while (boundaryIndex >= 0) {
        const block = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        processEvent(block);
        if (doneEventReceived) {
          await reader.cancel("done event received");
          cleanup();
          return donePayload;
        }
        boundaryIndex = nextSseBoundaryIndex(buffer);
      }
    }

    const tail = buffer.trim();
    if (tail.length > 0) {
      processEvent(tail);
    }

    cleanup();
    return donePayload;
  } catch (error) {
    cleanup();
    throw toApiError(error, "AI stream failed.");
  }
};

const collectFromStream = async (run: (onChunk: (text: string) => void) => Promise<unknown>): Promise<string> => {
  let text = "";
  await run((chunk) => {
    text += chunk;
  });
  return text;
};

export const queryRAGChatStream = async (
  query: string,
  history: ChatMessage[],
  contextDocuments: RAGDocument[],
  role: UserRole,
  username: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> => {
  const request: AiRequestMap["ragChat"] = { query, history, contextDocuments, role, username };
  await streamSse<AiRequestMap["ragChat"]>("/rag-chat", request, onChunk, { signal });
};

export const generateDashboardBriefingStream = async (
  data: DashboardData,
  previousFeedback: string[],
  onChunk: (text: string) => void
): Promise<void> => {
  const request: AiRequestMap["dashboardBriefing"] = { data, previousFeedback };
  await streamSse<AiRequestMap["dashboardBriefing"]>("/dashboard-briefing", request, onChunk);
};

export const generateDashboardBriefing = async (data: DashboardData, previousFeedback: string[] = []): Promise<string> =>
  collectFromStream((onChunk) => generateDashboardBriefingStream(data, previousFeedback, onChunk));

export const generateStudentProfileSummaryStream = async (
  student: StudentDetails,
  previousFeedback: string[],
  onChunk: (text: string) => void
): Promise<void> => {
  const request: AiRequestMap["studentProfileSummary"] = { student, previousFeedback };
  await streamSse<AiRequestMap["studentProfileSummary"]>("/student-profile-summary", request, onChunk);
};

export const generateStudentProfileSummary = async (student: StudentDetails, previousFeedback: string[] = []): Promise<string> =>
  collectFromStream((onChunk) => generateStudentProfileSummaryStream(student, previousFeedback, onChunk));

export const generateNotesSummaryStream = async (notes: ActivityLog[], onChunk: (text: string) => void): Promise<void> => {
  const request: AiRequestMap["notesSummary"] = { notes };
  await streamSse<AiRequestMap["notesSummary"]>("/notes-summary", request, onChunk);
};

export const generateNotesSummary = async (notes: ActivityLog[]): Promise<string> =>
  collectFromStream((onChunk) => generateNotesSummaryStream(notes, onChunk));

export const refineDraftNote = async (draft: string, category: string): Promise<string> => {
  const request: AiRequestMap["refineDraftNote"] = { draft, category };
  return collectFromStream((onChunk) => streamSse<AiRequestMap["refineDraftNote"]>("/refine-draft-note", request, onChunk));
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
  const request: AiRequestMap["parentMessage"] = { studentName, assignmentTitle, parentName };
  return collectFromStream((onChunk) => streamSse<AiRequestMap["parentMessage"]>("/parent-message", request, onChunk));
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
