
import { BaseAgent } from "./BaseAgent";
import type { StudentAgent } from "./StudentAgent";
import type { ChatMessage, RAGDocument, UserRole } from "../../types";
import type { Content, Tool } from "@google/genai";
import { safeJsonParse } from "./jsonUtils";

type FunctionCall = {
  name: string;
  args: Record<string, unknown>;
};

export class OrchestratorAgent extends BaseAgent {
  private studentAgent: StudentAgent;

  constructor(studentAgent: StudentAgent) {
    super();
    this.studentAgent = studentAgent;
  }

  public async queryRAGChatStream(
    query: string,
    history: ChatMessage[],
    contextDocuments: RAGDocument[],
    role: UserRole,
    username: string,
    onChunk: (text: string) => void
  ): Promise<void> {
    try {
      // Gather tools from sub-agents
      const tools: Tool[] = [...this.studentAgent.tools];

      // Prepare Context
      const docParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
      const docsWithContent = contextDocuments.filter(doc => doc.base64Data && doc.mimeType);
      docsWithContent.forEach(doc => {
          // Only supported inline types
          if(['application/pdf', 'image/png', 'image/jpeg'].includes(doc.mimeType!)) {
             docParts.push({ inlineData: { mimeType: doc.mimeType!, data: doc.base64Data! } });
          }
      });

      const contents: Content[] = [];
      if (docParts.length > 0) {
          contents.push({ role: 'user', parts: [...docParts, { text: "Here are the relevant documents." }] });
          contents.push({ role: 'model', parts: [{ text: "Understood." }] });
      }

      // History Window
      history.slice(-20).forEach(msg => {
          if (msg.role === 'user' || msg.role === 'model') {
              contents.push({ role: msg.role, parts: [{ text: msg.text || "" }] });
          }
      });
      contents.push({ role: 'user', parts: [{ text: query }] });

      const systemInstruction = `
        You are the Orchestrator for the BUFSD MTSS Pulse system.
        User: ${username} (${role}).
        
        Capabilities:
        1. Answer questions based on attached documents (Knowledge Base).
        2. Retrieve real-time student data (Student Database) using tools.
        3. If asked about grades/attendance/rosters, YOU MUST USE THE TOOLS.
        
        CRITICAL INSTRUCTION FOR "WHO" QUESTIONS:
        - If the user asks "Who" (e.g., "Who is at risk?", "Who has missing assignments?"), you MUST list the exact names of the students.
        - When using tools for "Who" questions, always select operations that return lists (e.g., 'list'), never just counts.
        
        Formatting: Use Markdown.
      `;

      // 1. Initial Generation
      const stream = await this.ai.models.generateContentStream({
          model: this.model,
          contents: contents,
          config: { tools, systemInstruction }
      });

      let functionCallFound: FunctionCall | null = null;

      for await (const chunk of stream) {
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
              const candidate = chunk.functionCalls[0];
              if (typeof candidate.name === "string" && candidate.args && typeof candidate.args === "object") {
                functionCallFound = {
                  name: candidate.name,
                  args: candidate.args as Record<string, unknown>
                };
              }
              break; // Pause to execute tool
          }
          if (chunk.text) onChunk(chunk.text);
      }

      // 2. Tool Execution (Delegation)
      if (functionCallFound) {
          const { name, args } = functionCallFound;
          let result = "";

          if (name === 'get_student_details') {
              const studentName = typeof args.studentName === "string" ? args.studentName : "";
              onChunk(`\n_Consulting Student Data Agent for ${studentName}..._\n`);
              result = this.studentAgent.fetchStudentDataSecurely(studentName, role, username);
          } else if (name === 'query_student_stats') {
              onChunk(`\n_Querying Roster Database..._\n`);
              result = this.studentAgent.executeRosterQuery(args, role);
          } else if (name === 'get_intervention_fidelity_stats') {
              onChunk(`\n_Analyzing Fidelity Metrics..._\n`);
              result = this.studentAgent.executeFidelityQuery(args, role);
          } else if (name === 'get_historical_metrics') {
              onChunk(`\n_Retrieving Historical Trends..._\n`);
              result = this.studentAgent.executeHistoricalQuery(args, role, username);
          } else if (name === 'query_gradebook') {
              onChunk(`\n_Accessing Gradebook Agent..._\n`);
              result = this.studentAgent.executeGradebookQuery(args, role);
          }

          // 3. Final Response with Tool Data
          const toolContents = [
              ...contents,
              { role: 'model', parts: [{ functionCall: functionCallFound }] },
              { role: 'user', parts: [{ functionResponse: { name, response: safeJsonParse<Record<string, unknown>>(result, { error: "Tool response parsing failed." }) } }] }
          ];

          const finalStream = await this.ai.models.generateContentStream({
              model: this.model,
              contents: toolContents,
              config: { systemInstruction }
          });

          for await (const chunk of finalStream) {
              if (chunk.text) onChunk(chunk.text);
          }
      }

    } catch (error) {
      console.error(error);
      onChunk("\n_System Error: Orchestrator failed to process request._");
    }
  }
}
