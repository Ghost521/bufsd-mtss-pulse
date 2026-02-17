export const queryKeys = {
  students: {
    all: ["students"] as const,
    byScope: (scope: "master" | "class") => ["students", scope] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    byRole: (role: string) => ["dashboard", role] as const,
  },
  data: {
    all: ["data"] as const,
    byDomain: (domain: string) => ["data", domain] as const,
  },
  health: ["health"] as const,
};
