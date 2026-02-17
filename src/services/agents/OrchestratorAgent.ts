import { BaseAgent } from "./BaseAgent";
import type { StudentAgent } from "./StudentAgent";
import type { ChatMessage, RAGDocument } from "../../types";
import type { Content, Tool } from "@google/genai";
import { safeJsonParse } from "./jsonUtils";
import type { AgentRequestContext } from "./requestContext";

type FunctionCall = {
  name: string;
  args: Record<string, unknown>;
};

type ToolTraceEntry = {
  name: string;
  ok: boolean;
  durationMs: number;
};

export type OrchestratorResult = {
  text: string;
  citations: string[];
  confidence: "high" | "medium" | "low";
  abstained: boolean;
  tools: ToolTraceEntry[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFunctionCall = (value: unknown): value is FunctionCall => {
  if (!isRecord(value)) return false;
  return typeof value.name === "string" && isRecord(value.args);
};

const previewText = (value: string, max = 140): string => {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}...`;
};

const hasVerificationFailure = (text: string): boolean => {
  const lowered = text.toLowerCase();
  return lowered.includes("not enough information") || lowered.includes("cannot verify") || lowered.includes("insufficient data");
};

export class OrchestratorAgent extends BaseAgent {
  private studentAgent: StudentAgent;

  constructor(studentAgent: StudentAgent) {
    super();
    this.studentAgent = studentAgent;
  }

  private buildSystemInstruction(context: AgentRequestContext): string {
    const policy = context.toolPolicy;

    return `
      You are the Orchestrator for BUFSD MTSS Pulse.
      Request metadata:
      - requestId: ${context.requestId}
      - user: ${context.username}
      - role: ${context.userRole}
      - effectiveRoles: ${context.effectiveRoles.join(", ")}

      Tool policy constraints:
      - canReadRoster: ${policy.canReadRoster}
      - canReadStudentDetails: ${policy.canReadStudentDetails}
      - canReadFidelity: ${policy.canReadFidelity}
      - canReadHistorical: ${policy.canReadHistorical}
      - canReadGradebook: ${policy.canReadGradebook}

      Decision rules:
      1. Use tools whenever the user asks for roster, attendance, grade, intervention, or named-student facts.
      2. Prefer "list" operations for "who" questions.
      3. Do not fabricate unavailable data. If tools deny access or return no data, clearly say so.
      4. Cite attached documents by name when document evidence is used.
      5. Keep responses educator- and industry-friendly: concise, concrete, and actionable.
      6. If confidence is low, explicitly state uncertainty.

      Output: Markdown only.
    `;
  }

  private buildInitialContents(query: string, history: ChatMessage[], contextDocuments: RAGDocument[]): Content[] {
    const contents: Content[] = [];

    const docParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    contextDocuments
      .filter((doc) => doc.base64Data && doc.mimeType)
      .forEach((doc) => {
        if (["application/pdf", "image/png", "image/jpeg"].includes(doc.mimeType ?? "")) {
          docParts.push({
            inlineData: {
              mimeType: doc.mimeType as string,
              data: doc.base64Data as string,
            },
          });
        }
      });

    if (docParts.length > 0) {
      contents.push({ role: "user", parts: [...docParts, { text: "Here are the relevant documents." }] });
      contents.push({ role: "model", parts: [{ text: "Understood." }] });
    }

    history.slice(-20).forEach((message) => {
      if (message.role !== "user" && message.role !== "model") return;
      contents.push({ role: message.role, parts: [{ text: message.text || "" }] });
    });

    contents.push({ role: "user", parts: [{ text: query }] });
    return contents;
  }

  private async runTurn(
    contents: Content[],
    tools: Tool[],
    systemInstruction: string
  ): Promise<{ text: string; functionCall: FunctionCall | null }> {
    const stream = await this.ai.models.generateContentStream({
      model: this.model,
      contents,
      config: {
        systemInstruction,
        ...(tools.length > 0 ? { tools } : {}),
      },
    });

    let text = "";
    let functionCall: FunctionCall | null = null;

    for await (const chunk of stream) {
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        const candidate = chunk.functionCalls[0];
        if (isFunctionCall(candidate)) {
          functionCall = candidate;
        }
        break;
      }

      if (chunk.text) {
        text += chunk.text;
      }
    }

    return { text, functionCall };
  }

  public async queryRAGChat(
    query: string,
    history: ChatMessage[],
    contextDocuments: RAGDocument[],
    requestContext: AgentRequestContext
  ): Promise<OrchestratorResult> {
    const contents = this.buildInitialContents(query, history, contextDocuments);
    const systemInstruction = this.buildSystemInstruction(requestContext);
    const tools: Tool[] = [...this.studentAgent.tools];

    const trace: ToolTraceEntry[] = [];
    let finalText = "";
    let abstained = false;

    try {
      for (let step = 0; step < 3; step += 1) {
        const turn = await this.runTurn(contents, tools, systemInstruction);

        if (turn.text.trim().length > 0) {
          finalText = turn.text;
        }

        if (!turn.functionCall) {
          break;
        }

        const started = Date.now();
        const toolResultText = this.studentAgent.executeTool(turn.functionCall.name, turn.functionCall.args, requestContext);
        const durationMs = Date.now() - started;
        const parsedResult = safeJsonParse<{ ok?: boolean; code?: string; error?: string; data?: unknown }>(
          toolResultText,
          {
            ok: false,
            code: "INTERNAL_ERROR",
            error: "Tool returned invalid JSON.",
          }
        );

        const ok = parsedResult.ok === true;
        if (!ok && parsedResult.code === "ACCESS_DENIED") {
          abstained = true;
        }

        trace.push({
          name: turn.functionCall.name,
          ok,
          durationMs,
        });

        const callContent: Content = {
          role: "model",
          parts: [{ functionCall: turn.functionCall }],
        };

        const responsePayload = isRecord(parsedResult) ? parsedResult : { ok: false, error: "Invalid tool response." };
        const responseContent: Content = {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: turn.functionCall.name,
                response: responsePayload,
              },
            },
          ],
        };

        contents.push(callContent);
        contents.push(responseContent);
      }

      if (!finalText.trim()) {
        const fallback = await this.runTurn(contents, [], `${systemInstruction}\nProvide a direct answer grounded in available evidence.`);
        finalText = fallback.text;
      }

      if (!finalText.trim()) {
        abstained = true;
        finalText = "I do not have enough verified information in your accessible scope to answer that confidently.";
      }
    } catch (error) {
      console.error(error);
      abstained = true;
      finalText = "The MTSS agent encountered an internal error while processing this request.";
    }

    const citations = contextDocuments.map((doc) => doc.name).filter((name) => name && name.trim().length > 0).slice(0, 5);

    const confidence: "high" | "medium" | "low" = abstained || hasVerificationFailure(finalText)
      ? "low"
      : trace.length > 0
      ? trace.every((entry) => entry.ok)
        ? "high"
        : "medium"
      : "medium";

    return {
      text: previewText(finalText, 4000),
      citations,
      confidence,
      abstained,
      tools: trace,
    };
  }
}
