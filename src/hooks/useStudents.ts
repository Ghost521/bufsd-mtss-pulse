import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import type { StudentRosterItem, Tier } from "../types";

export type StudentsResponse = {
  rows: StudentRosterItem[];
  total: number;
  scope: "master" | "class";
};

export type CreateStudentPayload = {
  name: string;
  grade: string;
  tier: Tier;
  gpa: string;
  attendance: number;
  readingLevel: string;
};

export type UpdateStudentPayload = {
  id: string;
  patch: Partial<CreateStudentPayload>;
};

export type DeleteStudentPayload = {
  id: string;
};

type QuerySnapshot = {
  previous: StudentsResponse | undefined;
};

type CreateSnapshot = QuerySnapshot & {
  tempId: string;
};

const parseError = async (response: Response): Promise<Error> => {
  const json = (await response.json().catch(() => null)) as { error?: string } | null;
  const message = json?.error || `Request failed (${response.status})`;
  return new Error(message);
};

const fetchStudents = async (scope: "master" | "class"): Promise<StudentsResponse> => {
  const response = await fetch(`/api/students?scope=${scope}`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as StudentsResponse;
};

const createStudent = async (payload: CreateStudentPayload): Promise<StudentRosterItem> => {
  const response = await fetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw await parseError(response);
  const data = (await response.json()) as { row: StudentRosterItem };
  return data.row;
};

const updateStudent = async (payload: UpdateStudentPayload): Promise<StudentRosterItem> => {
  const response = await fetch(`/api/students?id=${encodeURIComponent(payload.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload.patch),
  });

  if (!response.ok) throw await parseError(response);
  const data = (await response.json()) as { row: StudentRosterItem };
  return data.row;
};

const deleteStudent = async (payload: DeleteStudentPayload): Promise<StudentRosterItem> => {
  const response = await fetch(`/api/students?id=${encodeURIComponent(payload.id)}`, {
    method: "DELETE",
  });

  if (!response.ok) throw await parseError(response);
  const data = (await response.json()) as { row: StudentRosterItem };
  return data.row;
};

export const useStudents = (scope: "master" | "class", options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();
  const studentsKey = queryKeys.students.byScope(scope);

  const studentsQuery = useQuery({
    queryKey: studentsKey,
    queryFn: () => fetchStudents(scope),
    enabled: options?.enabled ?? true,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateStudentPayload) => {
      if (scope !== "master") throw new Error("Student creation is only supported for master scope.");
      return createStudent(payload);
    },
    onMutate: async (payload): Promise<CreateSnapshot> => {
      await queryClient.cancelQueries({ queryKey: studentsKey });
      const previous = queryClient.getQueryData<StudentsResponse>(studentsKey);
      const tempId = `temp-${Date.now()}`;

      const optimisticStudent: StudentRosterItem = {
        id: tempId,
        name: payload.name,
        grade: payload.grade,
        tier: payload.tier,
        gpa: payload.gpa,
        attendance: payload.attendance,
        readingLevel: payload.readingLevel,
        activeInterventions: payload.tier === "Tier 1" ? 0 : 1,
        alerts: payload.tier === "Tier 3" ? 1 : 0,
        avatarSeed: payload.name.toLowerCase().replace(/\s+/g, "-"),
      };

      queryClient.setQueryData<StudentsResponse>(studentsKey, (current) => {
        const base = current ?? { rows: [], total: 0, scope };
        return {
          ...base,
          rows: [optimisticStudent, ...base.rows],
          total: base.total + 1,
        };
      });

      return { previous, tempId };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(studentsKey, context.previous);
      }
    },
    onSuccess: (row, _payload, context) => {
      queryClient.setQueryData<StudentsResponse>(studentsKey, (current) => {
        if (!current) return current;
        const rows = current.rows.map((student) => (student.id === context.tempId ? row : student));
        return {
          ...current,
          rows,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: studentsKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateStudentPayload) => {
      if (scope !== "master") throw new Error("Student updates are only supported for master scope.");
      return updateStudent(payload);
    },
    onMutate: async ({ id, patch }): Promise<QuerySnapshot> => {
      await queryClient.cancelQueries({ queryKey: studentsKey });
      const previous = queryClient.getQueryData<StudentsResponse>(studentsKey);

      queryClient.setQueryData<StudentsResponse>(studentsKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          rows: current.rows.map((student) => (student.id === id ? { ...student, ...patch } : student)),
        };
      });

      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(studentsKey, context.previous);
      }
    },
    onSuccess: (row) => {
      queryClient.setQueryData<StudentsResponse>(studentsKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          rows: current.rows.map((student) => (student.id === row.id ? row : student)),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: studentsKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payload: DeleteStudentPayload) => {
      if (scope !== "master") throw new Error("Student deletion is only supported for master scope.");
      return deleteStudent(payload);
    },
    onMutate: async ({ id }): Promise<QuerySnapshot> => {
      await queryClient.cancelQueries({ queryKey: studentsKey });
      const previous = queryClient.getQueryData<StudentsResponse>(studentsKey);

      queryClient.setQueryData<StudentsResponse>(studentsKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          rows: current.rows.filter((student) => student.id !== id),
          total: Math.max(0, current.total - 1),
        };
      });

      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(studentsKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: studentsKey });
    },
  });

  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error;

  const resetMutationState = () => {
    createMutation.reset();
    updateMutation.reset();
    deleteMutation.reset();
  };

  return {
    studentsQuery,
    createMutation,
    updateMutation,
    deleteMutation,
    mutationError,
    resetMutationState,
  };
};
