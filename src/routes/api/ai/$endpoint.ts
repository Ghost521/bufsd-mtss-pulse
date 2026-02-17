import { createFileRoute } from "@tanstack/react-router";
import { InterventionAgent } from "../../../services/agents/InterventionAgent";
import { KnowledgeAgent } from "../../../services/agents/KnowledgeAgent";
import { OrchestratorAgent } from "../../../services/agents/OrchestratorAgent";
import { ReportingAgent } from "../../../services/agents/ReportingAgent";
import { StudentAgent } from "../../../services/agents/StudentAgent";
import { buildAgentRequestContext } from "../../../services/agents/requestContext";
import type {
  AiErrorCode,
  AiResponseMeta,
  AiStreamChunkEvent,
  AiStreamDoneEvent,
  AiStreamErrorEvent,
  AiStreamMetaEvent,
} from "../../../services/aiContracts";
import { newRequestId } from "../../../lib/server/audit-log";
import { getSessionFromRequest } from "../../../lib/server/auth-context";
import { requirePermission } from "../../../lib/server/rbac";
import type { CalendarEvent } from "../../../types";

type Agents = {
  studentAgent: StudentAgent;
  knowledgeAgent: KnowledgeAgent;
  interventionAgent: InterventionAgent;
  reportingAgent: ReportingAgent;
  orchestrator: OrchestratorAgent;
};

type SseEventName = "meta" | "chunk" | "done" | "error";

type SseEmit = (event: SseEventName, payload: unknown) => void;

type FailureInfo = {
  status: number;
  code: AiErrorCode;
  message: string;
  retryable: boolean;
};

const TEXT_MODEL = "gemini-3-flash-preview";
const DEBUG_STREAM = process.env.MTSS_DEBUG_STREAM === "true";

let cachedAgents: Agents | null = null;
let initError: Error | null = null;

const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const getAgents = (): Agents | null => {
  if (cachedAgents) return cachedAgents;
  if (initError) return null;

  try {
    const studentAgent = new StudentAgent();
    const knowledgeAgent = new KnowledgeAgent();
    const interventionAgent = new InterventionAgent();
    const reportingAgent = new ReportingAgent();
    const orchestrator = new OrchestratorAgent(studentAgent);
    cachedAgents = { studentAgent, knowledgeAgent, interventionAgent, reportingAgent, orchestrator };
    return cachedAgents;
  } catch (error) {
    initError = error instanceof Error ? error : new Error("Unknown AI agent initialization error.");
    console.error(initError);
    return null;
  }
};

const parseJsonBody = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

const buildMeta = (endpoint: string, overrides: Partial<AiResponseMeta> = {}): AiResponseMeta => ({
  endpoint,
  timestamp: new Date().toISOString(),
  ...overrides,
});

const aiSuccess = <TPayload extends Record<string, unknown>>(
  requestId: string,
  endpoint: string,
  payload: TPayload,
  metaOverrides: Partial<AiResponseMeta> = {}
): Response =>
  Response.json({
    ok: true,
    requestId,
    data: payload,
    ...payload,
    meta: buildMeta(endpoint, metaOverrides),
  });

const aiError = (
  requestId: string,
  endpoint: string,
  message: string,
  status: number,
  code: AiErrorCode,
  retryable = status >= 500
): Response =>
  Response.json(
    {
      ok: false,
      requestId,
      data: null,
      error: message,
      errorDetail: {
        code,
        message,
        retryable,
      },
      meta: buildMeta(endpoint),
    },
    { status }
  );

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "AI service error.";
};

const isModelUnavailableError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("quota") ||
    message.includes("resource exhausted") ||
    message.includes("rate limit") ||
    message.includes("model not found") ||
    (message.includes("model") && message.includes("not available")) ||
    message.includes("unsupported model")
  );
};

const resolveFailure = (error: unknown, fallbackMessage: string, fallbackCode: AiErrorCode = "INTERNAL_ERROR"): FailureInfo => {
  const message = getErrorMessage(error);

  if (isModelUnavailableError(error)) {
    return {
      status: 503,
      code: "MODEL_UNAVAILABLE",
      message,
      retryable: true,
    };
  }

  if (fallbackCode === "BAD_REQUEST") {
    return {
      status: 400,
      code: fallbackCode,
      message: fallbackMessage,
      retryable: false,
    };
  }

  return {
    status: 500,
    code: fallbackCode,
    message: fallbackMessage || message,
    retryable: true,
  };
};

const withEndpoint = async <TPayload extends Record<string, unknown>>(input: {
  requestId: string;
  endpoint: string;
  run: () => Promise<TPayload>;
  failureMessage: string;
  failureCode?: AiErrorCode;
  meta?: Partial<AiResponseMeta>;
}): Promise<Response> => {
  try {
    const payload = await input.run();
    return aiSuccess(input.requestId, input.endpoint, payload, input.meta);
  } catch (error) {
    console.error(error);
    const failure = resolveFailure(error, input.failureMessage, input.failureCode ?? "INTERNAL_ERROR");
    return aiError(input.requestId, input.endpoint, failure.message, failure.status, failure.code, failure.retryable);
  }
};

const encodeSse = (event: SseEventName, payload: unknown): string => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

const createSseResponse = (
  run: (helpers: { emit: SseEmit; isClosed: () => boolean }) => Promise<void>
): Response => {
  const encoder = new TextEncoder();
  let closed = false;
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: SseEmit = (event, payload) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeSse(event, payload)));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) {
          clearInterval(keepAlive);
          keepAlive = undefined;
        }
        controller.close();
      };

      try {
        keepAlive = setInterval(() => {
          if (closed) return;
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }, 15_000);
        if (DEBUG_STREAM) console.debug("[MTSS stream] opened");
        await run({ emit, isClosed: () => closed });
      } catch (error) {
        const failure = resolveFailure(error, "Streaming endpoint failed.");
        const payload: AiStreamErrorEvent = {
          code: failure.code,
          message: failure.message,
          retryable: failure.retryable,
        };
        emit("error", payload);
      } finally {
        if (DEBUG_STREAM) console.debug("[MTSS stream] closed");
        close();
      }
    },
    cancel() {
      closed = true;
      if (keepAlive) {
        clearInterval(keepAlive);
        keepAlive = undefined;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

const requestWantsStream = (request: Request): boolean => {
  const accept = request.headers.get("accept") ?? "";
  const streamHeader = request.headers.get("x-ai-stream");
  return accept.includes("text/event-stream") || streamHeader === "1";
};

const streamTextEndpoint = (input: {
  requestId: string;
  endpoint: string;
  model: string;
  run: (onChunk: (chunk: string) => void) => Promise<AiStreamDoneEvent | void>;
}): Response =>
  createSseResponse(async ({ emit, isClosed }) => {
    const metaPayload: AiStreamMetaEvent = {
      requestId: input.requestId,
      endpoint: input.endpoint,
      model: input.model,
    };
    emit("meta", metaPayload);

    const done = await input.run((chunk) => {
      if (isClosed()) return;
      const payload: AiStreamChunkEvent = { text: chunk };
      emit("chunk", payload);
    });

    if (!isClosed()) {
      emit("done", done ?? ({} as AiStreamDoneEvent));
    }
  });

const suggestMeetingSlots = (
  attendees: string[],
  durationMinutes: number,
  dateIso: string,
  existingEvents: CalendarEvent[]
): Array<{ start: string; end: string; reason: string }> => {
  if (!Array.isArray(attendees) || attendees.length === 0) return [];
  const day = new Date(dateIso);
  if (Number.isNaN(day.getTime())) return [];

  const startBoundary = new Date(day);
  startBoundary.setHours(8, 0, 0, 0);
  const endBoundary = new Date(day);
  endBoundary.setHours(17, 0, 0, 0);

  const sorted = [...existingEvents]
    .map((event) => ({ start: new Date(event.start), end: new Date(event.end) }))
    .filter((event) => !Number.isNaN(event.start.getTime()) && !Number.isNaN(event.end.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const suggestions: Array<{ start: string; end: string; reason: string }> = [];
  let cursor = new Date(startBoundary);

  for (const event of sorted) {
    const meetingEnd = new Date(cursor.getTime() + durationMinutes * 60000);
    if (meetingEnd <= event.start) {
      suggestions.push({
        start: cursor.toISOString(),
        end: meetingEnd.toISOString(),
        reason: "Earliest open slot before the next event.",
      });
      if (suggestions.length >= 3) return suggestions;
    }
    if (event.end > cursor) cursor = new Date(event.end);
  }

  while (cursor < endBoundary && suggestions.length < 3) {
    const meetingEnd = new Date(cursor.getTime() + durationMinutes * 60000);
    if (meetingEnd > endBoundary) break;

    suggestions.push({
      start: cursor.toISOString(),
      end: meetingEnd.toISOString(),
      reason: "Open availability during the school day.",
    });
    cursor = new Date(cursor.getTime() + 30 * 60000);
  }

  return suggestions;
};

export const Route = createFileRoute("/api/ai/$endpoint")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const requestId = newRequestId();
        const endpoint = params.endpoint;

        const session = await getSessionFromRequest(request);
        if (!session) return aiError(requestId, endpoint, "Unauthorized.", 401, "UNAUTHORIZED", false);

        const permission = requirePermission(session, { resource: "ai", action: "read" });
        if (!permission.ok) return aiError(requestId, endpoint, permission.error, permission.status, "FORBIDDEN", false);

        const agents = getAgents();
        if (!agents) {
          return aiError(requestId, endpoint, "AI server not configured. Set GEMINI_API_KEY.", 503, "UNAVAILABLE", true);
        }

        const wantsStream = requestWantsStream(request);

        if (endpoint === "rag-chat") {
          const body = await parseJsonBody<{
            query: string;
            history: unknown[];
            contextDocuments: unknown[];
          }>(request);

          if (!body || !isString(body.query) || !Array.isArray(body.history) || !Array.isArray(body.contextDocuments)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          if (wantsStream) {
            return streamTextEndpoint({
              requestId,
              endpoint,
              model: TEXT_MODEL,
              run: async (onChunk) => {
                const context = buildAgentRequestContext(session, requestId);
                const result = await agents.orchestrator.queryRAGChatStream(
                  body.query,
                  body.history as never[],
                  body.contextDocuments as never[],
                  context,
                  onChunk
                );

                return {
                  citations: result.citations,
                  confidence: result.confidence,
                  abstained: result.abstained,
                  tools: result.tools,
                };
              },
            });
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => {
              const context = buildAgentRequestContext(session, requestId);
              const result = await agents.orchestrator.queryRAGChat(
                body.query,
                body.history as never[],
                body.contextDocuments as never[],
                context
              );

              return { text: result.text };
            },
            failureMessage: "Failed to process chat request.",
            meta: { model: TEXT_MODEL },
          });
        }

        if (endpoint === "dashboard-briefing") {
          const body = await parseJsonBody<{ data: unknown; previousFeedback: string[] }>(request);
          if (!body || !body.data || !Array.isArray(body.previousFeedback)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          if (wantsStream) {
            return streamTextEndpoint({
              requestId,
              endpoint,
              model: TEXT_MODEL,
              run: (onChunk) => agents.reportingAgent.generateDashboardBriefingStream(body.data as never, body.previousFeedback, onChunk),
            });
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => {
              let text = "";
              await agents.reportingAgent.generateDashboardBriefingStream(body.data as never, body.previousFeedback, (chunk) => {
                text += chunk;
              });
              return { text };
            },
            failureMessage: "Failed to generate dashboard briefing.",
            meta: { model: TEXT_MODEL },
          });
        }

        if (endpoint === "student-profile-summary") {
          const body = await parseJsonBody<{ student: unknown; previousFeedback: string[] }>(request);
          if (!body || !body.student || !Array.isArray(body.previousFeedback)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          if (wantsStream) {
            return streamTextEndpoint({
              requestId,
              endpoint,
              model: TEXT_MODEL,
              run: (onChunk) => agents.reportingAgent.generateStudentProfileSummaryStream(body.student as never, body.previousFeedback, onChunk),
            });
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => {
              let text = "";
              await agents.reportingAgent.generateStudentProfileSummaryStream(body.student as never, body.previousFeedback, (chunk) => {
                text += chunk;
              });
              return { text };
            },
            failureMessage: "Failed to generate student summary.",
            meta: { model: TEXT_MODEL },
          });
        }

        if (endpoint === "notes-summary") {
          const body = await parseJsonBody<{ notes: unknown[] }>(request);
          if (!body || !Array.isArray(body.notes)) return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);

          if (wantsStream) {
            return streamTextEndpoint({
              requestId,
              endpoint,
              model: TEXT_MODEL,
              run: (onChunk) => agents.reportingAgent.generateNotesSummaryStream(body.notes as never[], onChunk),
            });
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => {
              let text = "";
              await agents.reportingAgent.generateNotesSummaryStream(body.notes as never[], (chunk) => {
                text += chunk;
              });
              return { text };
            },
            failureMessage: "Failed to summarize notes.",
            meta: { model: TEXT_MODEL },
          });
        }

        if (endpoint === "refine-draft-note") {
          const body = await parseJsonBody<{ draft: string; category: string }>(request);
          if (!body || !isString(body.draft) || !isString(body.category)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          if (wantsStream) {
            return streamTextEndpoint({
              requestId,
              endpoint,
              model: TEXT_MODEL,
              run: (onChunk) => agents.reportingAgent.refineDraftNoteStream(body.draft, body.category, onChunk),
            });
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => ({
              text: await agents.reportingAgent.refineDraftNote(body.draft, body.category),
            }),
            failureMessage: "Failed to refine note.",
            meta: { model: TEXT_MODEL },
          });
        }

        if (endpoint === "suggest-tags") {
          const body = await parseJsonBody<{ note: string }>(request);
          if (!body || !isString(body.note)) return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => ({ tags: await agents.reportingAgent.suggestTagsForNote(body.note) }),
            failureMessage: "Failed to suggest tags.",
          });
        }

        if (endpoint === "action-item-plan") {
          const body = await parseJsonBody<{ studentName: string; grade: string; category: string; insight: string }>(request);
          if (!body || !isString(body.studentName) || !isString(body.grade) || !isString(body.category) || !isString(body.insight)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => agents.interventionAgent.generateActionItemPlan(body.studentName, body.grade, body.category, body.insight),
            failureMessage: "Failed to generate action item plan.",
            meta: { model: TEXT_MODEL },
          });
        }

        if (endpoint === "structured-intervention") {
          const body = await parseJsonBody<{
            studentName: string;
            grade: string;
            tier: string;
            focusArea: string;
            additionalContext?: string;
            duration?: string;
            frequency?: string;
          }>(request);

          if (!body || !isString(body.studentName) || !isString(body.grade) || !isString(body.tier) || !isString(body.focusArea)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => ({
              plan: await agents.interventionAgent.generateStructuredIntervention(
                body.studentName,
                body.grade,
                body.tier,
                body.focusArea,
                isString(body.additionalContext) ? body.additionalContext : "",
                isString(body.duration) ? body.duration : "30 min",
                isString(body.frequency) ? body.frequency : "Daily"
              ),
            }),
            failureMessage: "Failed to generate intervention plan.",
            meta: { model: TEXT_MODEL },
          });
        }

        if (endpoint === "parent-message") {
          const body = await parseJsonBody<{ studentName: string; assignmentTitle: string; parentName: string }>(request);
          if (!body || !isString(body.studentName) || !isString(body.assignmentTitle) || !isString(body.parentName)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          if (wantsStream) {
            return streamTextEndpoint({
              requestId,
              endpoint,
              model: TEXT_MODEL,
              run: (onChunk) => agents.interventionAgent.generateParentMessageStream(body.studentName, body.assignmentTitle, body.parentName, onChunk),
            });
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => ({
              text: await agents.interventionAgent.generateParentMessage(body.studentName, body.assignmentTitle, body.parentName),
            }),
            failureMessage: "Failed to generate parent message.",
            meta: { model: TEXT_MODEL },
          });
        }

        if (endpoint === "analyze-uploaded-document") {
          const body = await parseJsonBody<{ base64: string; mime: string; name: string }>(request);
          if (!body || !isString(body.base64) || !isString(body.mime) || !isString(body.name)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => ({ result: await agents.knowledgeAgent.analyzeUploadedDocument(body.base64, body.mime, body.name) }),
            failureMessage: "Failed to analyze uploaded document.",
          });
        }

        if (endpoint === "file-summary") {
          const body = await parseJsonBody<{ base64: string; mime: string }>(request);
          if (!body || !isString(body.base64) || !isString(body.mime)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => ({ text: await agents.knowledgeAgent.generateFileSummary(body.base64, body.mime) }),
            failureMessage: "Failed to summarize file.",
          });
        }

        if (endpoint === "resource-summary") {
          const body = await parseJsonBody<{ url: string; type: "WEBSITE" | "YOUTUBE" }>(request);
          if (!body || !isString(body.url) || (body.type !== "WEBSITE" && body.type !== "YOUTUBE")) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => agents.knowledgeAgent.generateResourceSummary(body.url, body.type),
            failureMessage: "Failed to summarize resource.",
          });
        }

        if (endpoint === "extract-data-from-document") {
          const body = await parseJsonBody<{ base64: string; mime: string }>(request);
          if (!body || !isString(body.base64) || !isString(body.mime)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => ({ rows: await agents.knowledgeAgent.extractDataFromDocument(body.base64, body.mime) }),
            failureMessage: "Failed to extract document data.",
          });
        }

        if (endpoint === "import-batch-analysis") {
          const body = await parseJsonBody<{ data: unknown[]; source: string }>(request);
          if (!body || !Array.isArray(body.data) || !isString(body.source)) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => ({ result: await agents.reportingAgent.analyzeImportedBatch(body.data, body.source) }),
            failureMessage: "Failed to analyze import batch.",
            meta: { model: TEXT_MODEL },
          });
        }

        if (endpoint === "meeting-times") {
          const body = await parseJsonBody<{ attendees: unknown[]; duration: number; date: string; existing: CalendarEvent[] }>(request);
          if (
            !body ||
            !Array.isArray(body.attendees) ||
            typeof body.duration !== "number" ||
            !Number.isFinite(body.duration) ||
            !isString(body.date) ||
            !Array.isArray(body.existing)
          ) {
            return aiError(requestId, endpoint, "Invalid request body.", 400, "BAD_REQUEST", false);
          }

          return withEndpoint({
            requestId,
            endpoint,
            run: async () => ({
              suggestions: suggestMeetingSlots(
                body.attendees.filter((attendee): attendee is string => typeof attendee === "string"),
                Math.max(15, Math.round(body.duration)),
                body.date,
                body.existing
              ),
            }),
            failureMessage: "Failed to suggest meeting times.",
          });
        }

        return aiError(requestId, endpoint, `Unknown endpoint: ${endpoint}`, 404, "NOT_FOUND", false);
      },
    },
  },
});
