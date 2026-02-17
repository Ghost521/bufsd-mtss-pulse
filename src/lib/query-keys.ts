export const queryKeys = {
  students: {
    all: ["students"] as const,
    byScope: (scope: "master" | "class") => ["students", scope] as const,
  },
  health: ["health"] as const,
};
