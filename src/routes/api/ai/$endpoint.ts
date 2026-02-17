import { createFileRoute } from "@tanstack/react-router";
import { InterventionAgent } from "../../../services/agents/InterventionAgent";
import { KnowledgeAgent } from "../../../services/agents/KnowledgeAgent";
import { OrchestratorAgent } from "../../../services/agents/OrchestratorAgent";
import { ReportingAgent } from "../../../services/agents/ReportingAgent";
import { StudentAgent } from "../../../services/agents/StudentAgent";
import type { CalendarEvent} from "../../../types";
import { UserRole } from "../../../types";
import { getSessionFromRequest } from "../../../lib/server/auth-context";
import { requirePermission } from "../../../lib/server/rbac";

type Agents = {
  studentAgent: StudentAgent;
  knowledgeAgent: KnowledgeAgent;
  interventionAgent: InterventionAgent;
  reportingAgent: ReportingAgent;
  orchestrator: OrchestratorAgent;
};

let cachedAgents: Agents | null = null;
let initError: Error | null = null;

const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const mapRoleToUserRole = (role: string): UserRole => {
  if (role === "teacher") return UserRole.TEACHER;
  if (role === "principal") return UserRole.PRINCIPAL;
  if (role === "district_admin" || role === "org_admin") return UserRole.DISTRICT;
  if (role === "parent") return UserRole.PARENT;
  return UserRole.TEACHER;
};

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

const jsonError = (message: string, status = 400): Response => Response.json({ error: message }, { status });

const parseJsonBody = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

const collectStreamText = async (run: (onChunk: (chunk: string) => void) => Promise<void>): Promise<string> => {
  let text = "";
  await run((chunk) => {
    text += chunk;
  });
  return text;
};

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
        const session = getSessionFromRequest(request);
        if (!session) return jsonError("Unauthorized.", 401);
        const permission = requirePermission(session, { resource: "ai", action: "read" });
        if (!permission.ok) return jsonError(permission.error, permission.status);

        const agents = getAgents();
        if (!agents) return jsonError("AI server not configured. Set GEMINI_API_KEY.", 503);

        const endpoint = params.endpoint;

        if (endpoint === "rag-chat") {
          const body = await parseJsonBody<{
            query: string;
            history: unknown[];
            contextDocuments: unknown[];
            role?: UserRole;
            username?: string;
          }>(request);
          if (!body || !isString(body.query) || !Array.isArray(body.history) || !Array.isArray(body.contextDocuments)) {
            return jsonError("Invalid request body.");
          }

          try {
            const role = mapRoleToUserRole(session.effectiveRoles[0] ?? session.user.primaryRole);
            const username = session.user.name;
            const text = await collectStreamText((onChunk) =>
              agents.orchestrator.queryRAGChatStream(
                body.query,
                body.history as never[],
                body.contextDocuments as never[],
                role,
                username,
                onChunk
              )
            );
            return Response.json({ text });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to process chat request.", 500);
          }
        }

        if (endpoint === "dashboard-briefing") {
          const body = await parseJsonBody<{ data: unknown; previousFeedback: string[] }>(request);
          if (!body || !body.data || !Array.isArray(body.previousFeedback)) return jsonError("Invalid request body.");
          try {
            const text = await collectStreamText((onChunk) =>
              agents.reportingAgent.generateDashboardBriefingStream(body.data as never, body.previousFeedback, onChunk)
            );
            return Response.json({ text });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to generate dashboard briefing.", 500);
          }
        }

        if (endpoint === "student-profile-summary") {
          const body = await parseJsonBody<{ student: unknown; previousFeedback: string[] }>(request);
          if (!body || !body.student || !Array.isArray(body.previousFeedback)) return jsonError("Invalid request body.");
          try {
            const text = await collectStreamText((onChunk) =>
              agents.reportingAgent.generateStudentProfileSummaryStream(body.student as never, body.previousFeedback, onChunk)
            );
            return Response.json({ text });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to generate student summary.", 500);
          }
        }

        if (endpoint === "notes-summary") {
          const body = await parseJsonBody<{ notes: unknown[] }>(request);
          if (!body || !Array.isArray(body.notes)) return jsonError("Invalid request body.");
          try {
            const text = await collectStreamText((onChunk) => agents.reportingAgent.generateNotesSummaryStream(body.notes as never[], onChunk));
            return Response.json({ text });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to summarize notes.", 500);
          }
        }

        if (endpoint === "refine-draft-note") {
          const body = await parseJsonBody<{ draft: string; category: string }>(request);
          if (!body || !isString(body.draft) || !isString(body.category)) return jsonError("Invalid request body.");
          try {
            const text = await agents.reportingAgent.refineDraftNote(body.draft, body.category);
            return Response.json({ text });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to refine note.", 500);
          }
        }

        if (endpoint === "suggest-tags") {
          const body = await parseJsonBody<{ note: string }>(request);
          if (!body || !isString(body.note)) return jsonError("Invalid request body.");
          try {
            const tags = await agents.reportingAgent.suggestTagsForNote(body.note);
            return Response.json({ tags });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to suggest tags.", 500);
          }
        }

        if (endpoint === "action-item-plan") {
          const body = await parseJsonBody<{ studentName: string; grade: string; category: string; insight: string }>(request);
          if (!body || !isString(body.studentName) || !isString(body.grade) || !isString(body.category) || !isString(body.insight)) {
            return jsonError("Invalid request body.");
          }
          try {
            const result = await agents.interventionAgent.generateActionItemPlan(body.studentName, body.grade, body.category, body.insight);
            return Response.json(result);
          } catch (error) {
            console.error(error);
            return jsonError("Failed to generate action item plan.", 500);
          }
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
            return jsonError("Invalid request body.");
          }

          try {
            const plan = await agents.interventionAgent.generateStructuredIntervention(
              body.studentName,
              body.grade,
              body.tier,
              body.focusArea,
              isString(body.additionalContext) ? body.additionalContext : "",
              isString(body.duration) ? body.duration : "30 min",
              isString(body.frequency) ? body.frequency : "Daily"
            );
            return Response.json({ plan });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to generate intervention plan.", 500);
          }
        }

        if (endpoint === "parent-message") {
          const body = await parseJsonBody<{ studentName: string; assignmentTitle: string; parentName: string }>(request);
          if (!body || !isString(body.studentName) || !isString(body.assignmentTitle) || !isString(body.parentName)) {
            return jsonError("Invalid request body.");
          }
          try {
            const text = await agents.interventionAgent.generateParentMessage(body.studentName, body.assignmentTitle, body.parentName);
            return Response.json({ text });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to generate parent message.", 500);
          }
        }

        if (endpoint === "analyze-uploaded-document") {
          const body = await parseJsonBody<{ base64: string; mime: string; name: string }>(request);
          if (!body || !isString(body.base64) || !isString(body.mime) || !isString(body.name)) return jsonError("Invalid request body.");
          try {
            const result = await agents.knowledgeAgent.analyzeUploadedDocument(body.base64, body.mime, body.name);
            return Response.json({ result });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to analyze uploaded document.", 500);
          }
        }

        if (endpoint === "file-summary") {
          const body = await parseJsonBody<{ base64: string; mime: string }>(request);
          if (!body || !isString(body.base64) || !isString(body.mime)) return jsonError("Invalid request body.");
          try {
            const text = await agents.knowledgeAgent.generateFileSummary(body.base64, body.mime);
            return Response.json({ text });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to summarize file.", 500);
          }
        }

        if (endpoint === "resource-summary") {
          const body = await parseJsonBody<{ url: string; type: "WEBSITE" | "YOUTUBE" }>(request);
          if (!body || !isString(body.url) || (body.type !== "WEBSITE" && body.type !== "YOUTUBE")) return jsonError("Invalid request body.");
          try {
            const result = await agents.knowledgeAgent.generateResourceSummary(body.url, body.type);
            return Response.json(result);
          } catch (error) {
            console.error(error);
            return jsonError("Failed to summarize resource.", 500);
          }
        }

        if (endpoint === "extract-data-from-document") {
          const body = await parseJsonBody<{ base64: string; mime: string }>(request);
          if (!body || !isString(body.base64) || !isString(body.mime)) return jsonError("Invalid request body.");
          try {
            const rows = await agents.knowledgeAgent.extractDataFromDocument(body.base64, body.mime);
            return Response.json({ rows });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to extract document data.", 500);
          }
        }

        if (endpoint === "import-batch-analysis") {
          const body = await parseJsonBody<{ data: unknown[]; source: string }>(request);
          if (!body || !Array.isArray(body.data) || !isString(body.source)) return jsonError("Invalid request body.");
          try {
            const result = await agents.reportingAgent.analyzeImportedBatch(body.data, body.source);
            return Response.json({ result });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to analyze import batch.", 500);
          }
        }

        if (endpoint === "meeting-times") {
          const body = await parseJsonBody<{ attendees: unknown[]; duration: number; date: string; existing: CalendarEvent[] }>(request);
          if (!body || !Array.isArray(body.attendees) || typeof body.duration !== "number" || !isString(body.date) || !Array.isArray(body.existing)) {
            return jsonError("Invalid request body.");
          }

          try {
            const suggestions = suggestMeetingSlots(
              body.attendees.filter((attendee): attendee is string => typeof attendee === "string"),
              body.duration,
              body.date,
              body.existing
            );
            return Response.json({ suggestions });
          } catch (error) {
            console.error(error);
            return jsonError("Failed to suggest meeting times.", 500);
          }
        }

        return jsonError(`Unknown endpoint: ${endpoint}`, 404);
      },
    },
  },
});
