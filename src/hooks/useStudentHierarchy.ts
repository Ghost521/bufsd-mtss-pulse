import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";

export type StudentHierarchyTeacherNode = {
  teacherUserId: string | null;
  teacherName: string;
  studentCount: number;
};

export type StudentHierarchyGradeNode = {
  grade: string;
  teachers: StudentHierarchyTeacherNode[];
};

export type StudentHierarchyPrincipalNode = {
  principalUserId: string;
  principalName: string;
  isPlaceholder: boolean;
  grades: StudentHierarchyGradeNode[];
};

export type StudentHierarchySchoolNode = {
  schoolId: string;
  schoolName: string;
  studentCount: number;
  principals: StudentHierarchyPrincipalNode[];
  grades: StudentHierarchyGradeNode[];
};

export type StudentHierarchyResponse = {
  ok: boolean;
  roleScope: "district" | "school" | "teacher";
  schools: StudentHierarchySchoolNode[];
};

const parseError = async (response: Response): Promise<Error> => {
  const json = (await response.json().catch(() => null)) as { error?: string } | null;
  const message = json?.error || `Request failed (${response.status})`;
  return new Error(message);
};

const fetchHierarchy = async (): Promise<StudentHierarchyResponse> => {
  const response = await fetch("/api/students-hierarchy");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as StudentHierarchyResponse;
};

export const useStudentHierarchy = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.students.hierarchy,
    queryFn: fetchHierarchy,
    enabled,
  });
