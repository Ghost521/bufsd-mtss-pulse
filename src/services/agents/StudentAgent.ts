
import { BaseAgent } from "./BaseAgent";
import { UserRole } from "../../types";
import { 
  CLASS_ROSTER_DATA, 
  STAFF_ROSTER_DATA, 
  GLOBAL_GRADES, 
  getStudentDetails 
} from "../../constants";
import type { Tool } from "@google/genai";
import { Type } from "@google/genai";

export class StudentAgent extends BaseAgent {
  private static isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  private static getOptionalNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }
  
  public readonly tools: Tool[] = [{
    functionDeclarations: [
      {
        name: 'get_student_details',
        description: 'Retrieves real-time academic, attendance, and behavioral records for a specific student.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            studentName: { type: Type.STRING, description: 'The full name or first name of the student.' },
          },
          required: ['studentName'],
        },
      },
      {
        name: 'query_student_stats',
        description: 'Queries the class roster to get aggregated statistics (counts, averages) or lists of students based on filters.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            operation: { type: Type.STRING, enum: ["count", "list", "average_gpa", "average_attendance"], description: "Operation to perform." },
            filter_tier: { type: Type.STRING, description: "Filter by Tier (e.g., 'Tier 1')." },
            filter_grade: { type: Type.STRING, description: "Filter by Grade (e.g., '4th')." },
            attendance_below: { type: Type.NUMBER, description: "Filter for attendance below this number." }
          },
          required: ["operation"]
        }
      },
      {
        name: 'get_intervention_fidelity_stats',
        description: 'Retrieves statistics regarding Intervention Fidelity for staff or grade levels.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            grade_level: { type: Type.STRING, description: "Optional: Filter by grade level." }
          }
        }
      },
      {
        name: 'get_historical_metrics',
        description: 'Retrieves historical time-series data for a specific metric.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            metric: { type: Type.STRING, enum: ['attendance', 'gpa', 'reading_level', 'behavior_incidents'], description: "The metric to analyze." },
            student_name: { type: Type.STRING, description: "Optional: Name of the specific student." },
            grade_level: { type: Type.STRING, description: "Optional: Grade level." },
            filter_tier: { type: Type.STRING, description: "Optional: Filter by Tier." },
            duration_months: { type: Type.NUMBER, description: "Number of months (default 6)." }
          },
          required: ['metric']
        }
      },
      {
        name: 'query_gradebook',
        description: 'Queries the official gradebook for scores, missing work, and averages.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            operation: { type: Type.STRING, enum: ["missing_work", "student_average", "list_grades"], description: "Operation to perform." },
            student_name: { type: Type.STRING, description: "Filter by student name." },
            subject: { type: Type.STRING, description: "Filter by subject." }
          },
          required: ["operation"]
        }
      }
    ]
  }];

  // --- Tool Implementations ---

  public fetchStudentDataSecurely(targetStudentName: string, requesterRole: UserRole, requesterName: string): string {
    console.log(`[StudentAgent] Fetching data for ${targetStudentName}`);
    try {
      const target = targetStudentName.toLowerCase().trim();
      
      // RBAC Logic
      if (requesterRole === UserRole.PARENT) {
          if (requesterName === 'Mrs. Martinez' && (target.includes('leo') || target.includes('martinez'))) {
            return JSON.stringify(getStudentDetails('Leo Martinez'));
          }
          return JSON.stringify({ error: "Access Denied. Unauthorized." });
      }

      if (requesterRole === UserRole.TEACHER) {
          const studentExists = CLASS_ROSTER_DATA.some(s => s.name.toLowerCase().includes(target));
          if (studentExists) return JSON.stringify(getStudentDetails(targetStudentName));
          return JSON.stringify({ error: "Student not found in your roster." });
      }

      return JSON.stringify(getStudentDetails(targetStudentName));
    } catch {
      return JSON.stringify({ error: "System error retrieving student data." });
    }
  }

  public executeRosterQuery(args: Record<string, unknown>, requesterRole: UserRole): string {
    if (requesterRole === UserRole.PARENT) return JSON.stringify({ error: "Access Denied." });

    let filtered = [...CLASS_ROSTER_DATA];
    const filterTier = StudentAgent.isNonEmptyString(args.filter_tier) ? args.filter_tier : undefined;
    const filterGrade = StudentAgent.isNonEmptyString(args.filter_grade) ? args.filter_grade : undefined;
    const attendanceBelow = StudentAgent.getOptionalNumber(args.attendance_below);
    const operation = StudentAgent.isNonEmptyString(args.operation) ? args.operation : "";

    if (filterTier) filtered = filtered.filter(s => s.tier.toLowerCase() === filterTier.toLowerCase());
    if (filterGrade) filtered = filtered.filter(s => s.grade.includes(filterGrade));
    if (attendanceBelow !== undefined) filtered = filtered.filter(s => s.attendance < attendanceBelow);

    if (operation === 'count') return JSON.stringify({ count: filtered.length });
    if (operation === 'average_gpa') {
      const total = filtered.reduce((sum, s) => sum + parseFloat(s.gpa), 0);
      return JSON.stringify({ average_gpa: filtered.length ? (total / filtered.length).toFixed(2) : 0 });
    }
    if (operation === 'list') {
      return JSON.stringify({ students: filtered.map(s => ({ name: s.name, tier: s.tier, gpa: s.gpa })) });
    }
    return JSON.stringify({ error: "Unknown operation" });
  }

  public executeFidelityQuery(args: Record<string, unknown>, requesterRole: UserRole): string {
    if (requesterRole === UserRole.PARENT) return JSON.stringify({ error: "Access Denied." });
    
    let targetStaff = [...STAFF_ROSTER_DATA];
    const gradeLevel = StudentAgent.isNonEmptyString(args.grade_level) ? args.grade_level : undefined;
    if (gradeLevel) targetStaff = targetStaff.filter(s => s.grade && s.grade.includes(gradeLevel));
    
    const total = targetStaff.reduce((sum, s) => sum + s.mtssFidelityScore, 0);
    return JSON.stringify({
      average_fidelity: Math.round(total / (targetStaff.length || 1)) + "%",
      sample_size: targetStaff.length,
      trend: "+2% (Simulated)"
    });
  }

  public executeHistoricalQuery(args: Record<string, unknown>, _requesterRole: UserRole, _requesterName: string): string {
    // ... (Mock logic for trends - simplified for agent)
    const metric = StudentAgent.isNonEmptyString(args.metric) ? args.metric : "attendance";
    const durationMonths = StudentAgent.getOptionalNumber(args.duration_months) ?? 6;
    const points: Array<{ month: string; value: string }> = [];
    let baseline = 80; 
    if (metric === 'gpa') baseline = 2.5;
    
    for(let i=0; i< durationMonths; i++) {
        points.push({ month: `Month -${i}`, value: (baseline + Math.random()).toFixed(1) });
    }
    return JSON.stringify({ metric, trend: "Stable", data: points.reverse() });
  }

  public executeGradebookQuery(args: Record<string, unknown>, requesterRole: UserRole): string {
    const studentName = StudentAgent.isNonEmptyString(args.student_name) ? args.student_name : "";
    const operation = StudentAgent.isNonEmptyString(args.operation) ? args.operation : "";
    if (requesterRole === UserRole.PARENT && studentName && !studentName.toLowerCase().includes('leo')) {
        return JSON.stringify({ error: "Access Denied." });
    }

    if (operation === 'missing_work') {
        const missing = GLOBAL_GRADES.filter(g => g.score === 'M');
        return JSON.stringify({ missing_count: missing.length, note: "Mock data missing work found." });
    }
    
    return JSON.stringify({ message: "Gradebook query executed.", data: "Simulated results." });
  }
}
