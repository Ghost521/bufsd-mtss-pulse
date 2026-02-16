
import { BaseAgent } from "./BaseAgent";
import type { AIInterventionPlan } from "../aiContracts";
import { normalizeActionItemPlan, safeJsonParse } from "./jsonUtils";

export class InterventionAgent extends BaseAgent {
  
  public async generateActionItemPlan(studentName: string, grade: string, category: string, insight: string): Promise<{ title: string; notes: string }> {
    try {
      const prompt = `
        Create an intervention plan.
        Student: ${studentName} (${grade})
        Category: ${category}
        Insight: "${insight}"
        Return JSON: { "title": string, "notes": string }
      `;

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      return normalizeActionItemPlan(safeJsonParse<unknown>(response.text, {}));
    } catch {
      return { title: "Draft Plan", notes: "AI unavailable." };
    }
  }

  public async generateStructuredIntervention(
    target: string, 
    grade: string, 
    tier: string, 
    focusArea: string,
    additionalContext: string = "",
    duration: string = "30 min",
    frequency: string = "Daily"
  ): Promise<AIInterventionPlan> {
    try {
      const prompt = `
        Create a robust, professional lesson plan or intervention strategy.
        
        Target Audience: ${target}
        Grade Level: ${grade}
        Tier Level: ${tier}
        Topic/Focus: ${focusArea}
        
        Desired Duration: ${duration}
        Desired Frequency: ${frequency}
        
        ${additionalContext ? `Specific Student Context/Notes (INTEGRATE DIFFERENTIATION FOR THESE STUDENTS): \n${additionalContext}` : ''}
        
        The plan must include a detailed lesson strategy using standard pedagogical practices.
        
        Return JSON format:
        {
          "title": "Name of lesson/intervention",
          "strategy": "Pedagogical approach (e.g., Direct Instruction, Inquiry-Based)",
          "frequency": "${frequency}",
          "duration": "${duration}",
          "monitoringMethod": "How progress is tracked",
          "baseline": 0,
          "goal": 80,
          "lessonPlan": {
             "objective": "Clear learning objective (SWBAT...)",
             "materials": ["List of materials"],
             "procedure": ["Step 1...", "Step 2...", "Step 3... (Include specific teacher moves)"],
             "assessment": "Formative assessment or exit ticket",
             "differentiation": "Specific strategies for the students mentioned in context (if any), plus general supports."
          }
        }
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash', // Increased capability for complex plans
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const fallback: AIInterventionPlan = {
        title: "AI Draft Plan",
        strategy: "Direct Instruction",
        frequency,
        duration,
        monitoringMethod: "Weekly progress monitoring",
        baseline: 0,
        goal: 80,
        lessonPlan: {
          objective: "Objective unavailable.",
          materials: [],
          procedure: [],
          assessment: "Assessment unavailable.",
          differentiation: "Differentiation unavailable."
        }
      };

      const parsed = safeJsonParse<unknown>(response.text, fallback);
      if (!parsed || typeof parsed !== "object") return fallback;
      const candidate = parsed as Partial<AIInterventionPlan>;
      return {
        title: typeof candidate.title === "string" ? candidate.title : fallback.title,
        strategy: typeof candidate.strategy === "string" ? candidate.strategy : fallback.strategy,
        frequency: typeof candidate.frequency === "string" ? candidate.frequency : fallback.frequency,
        duration: typeof candidate.duration === "string" ? candidate.duration : fallback.duration,
        monitoringMethod: typeof candidate.monitoringMethod === "string" ? candidate.monitoringMethod : fallback.monitoringMethod,
        baseline: typeof candidate.baseline === "number" ? candidate.baseline : fallback.baseline,
        goal: typeof candidate.goal === "number" ? candidate.goal : fallback.goal,
        lessonPlan: {
          objective: typeof candidate.lessonPlan?.objective === "string" ? candidate.lessonPlan.objective : fallback.lessonPlan.objective,
          materials: Array.isArray(candidate.lessonPlan?.materials)
            ? candidate.lessonPlan.materials.filter((value): value is string => typeof value === "string")
            : fallback.lessonPlan.materials,
          procedure: Array.isArray(candidate.lessonPlan?.procedure)
            ? candidate.lessonPlan.procedure.filter((value): value is string => typeof value === "string")
            : fallback.lessonPlan.procedure,
          assessment: typeof candidate.lessonPlan?.assessment === "string" ? candidate.lessonPlan.assessment : fallback.lessonPlan.assessment,
          differentiation:
            typeof candidate.lessonPlan?.differentiation === "string"
              ? candidate.lessonPlan.differentiation
              : fallback.lessonPlan.differentiation,
        },
      };
    } catch (e) {
      console.error(e);
      throw new Error("Failed to generate plan.");
    }
  }

  public async generateParentMessage(studentName: string, assignmentTitle: string, parentName: string): Promise<string> {
    try {
      const prompt = `Draft a polite, short email to ${parentName} about ${studentName}'s missing assignment "${assignmentTitle}". Be supportive.`;
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt
      });
      return response.text || "Draft unavailable.";
    } catch {
      return "Error generating message.";
    }
  }
}
