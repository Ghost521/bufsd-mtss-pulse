export const queryKeys = {
  students: {
    all: ["students"] as const,
    byScope: (
      scope: "master" | "class",
      filters?: {
        schoolId?: string;
        principalUserId?: string;
        grade?: string;
        teacherUserId?: string;
        teacherName?: string;
      },
      includeArchived = false
    ) =>
      [
        "students",
        scope,
        includeArchived ? "with-archived" : "active-only",
        filters?.schoolId ?? null,
        filters?.principalUserId ?? null,
        filters?.grade ?? null,
        filters?.teacherUserId ?? null,
        filters?.teacherName ?? null,
      ] as const,
    hierarchy: ["students", "hierarchy"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    byRole: (role: string) => ["dashboard", role] as const,
  },
  data: {
    all: ["data"] as const,
    byDomain: (domain: string) => ["data", domain] as const,
  },
  branding: ["branding"] as const,
  health: ["health"] as const,
};
