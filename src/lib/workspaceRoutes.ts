import { UserRole } from "../types";

export type RoleSlug = "principal" | "teacher" | "district" | "parent";

export type WorkspacePageId =
  | "dashboard"
  | "rosters"
  | "class_roster"
  | "gradebook"
  | "lesson_plans"
  | "interventions"
  | "calendar"
  | "reports"
  | "messages"
  | "documents"
  | "import"
  | "map"
  | "settings"
  | "profile";

export const DEFAULT_WORKSPACE_PAGE: WorkspacePageId = "dashboard";

const ROLE_TO_SLUG: Record<UserRole, RoleSlug> = {
  [UserRole.PRINCIPAL]: "principal",
  [UserRole.TEACHER]: "teacher",
  [UserRole.DISTRICT]: "district",
  [UserRole.PARENT]: "parent",
};

const SLUG_TO_ROLE: Record<RoleSlug, UserRole> = {
  principal: UserRole.PRINCIPAL,
  teacher: UserRole.TEACHER,
  district: UserRole.DISTRICT,
  parent: UserRole.PARENT,
};

const PAGE_ID_TO_SLUG: Record<WorkspacePageId, string> = {
  dashboard: "dashboard",
  rosters: "rosters",
  class_roster: "class-roster",
  gradebook: "gradebook",
  lesson_plans: "lesson-plans",
  interventions: "interventions",
  calendar: "calendar",
  reports: "reports",
  messages: "messages",
  documents: "documents",
  import: "import",
  map: "map",
  settings: "settings",
  profile: "profile",
};

const PAGE_SLUG_TO_ID = Object.entries(PAGE_ID_TO_SLUG).reduce<Record<string, WorkspacePageId>>((acc, [id, slug]) => {
  acc[slug] = id as WorkspacePageId;
  return acc;
}, {});

export const ROLE_ALLOWED_PAGES: Record<UserRole, WorkspacePageId[]> = {
  [UserRole.PRINCIPAL]: [
    "dashboard",
    "rosters",
    "lesson_plans",
    "interventions",
    "calendar",
    "reports",
    "messages",
    "documents",
    "import",
    "settings",
    "profile",
  ],
  [UserRole.TEACHER]: [
    "dashboard",
    "class_roster",
    "gradebook",
    "lesson_plans",
    "interventions",
    "calendar",
    "messages",
    "documents",
    "import",
    "settings",
    "profile",
  ],
  [UserRole.DISTRICT]: [
    "dashboard",
    "map",
    "reports",
    "calendar",
    "messages",
    "documents",
    "import",
    "settings",
    "profile",
  ],
  [UserRole.PARENT]: ["dashboard", "reports", "calendar", "messages", "documents", "settings", "profile"],
};

export function roleToSlug(role: UserRole): RoleSlug {
  return ROLE_TO_SLUG[role];
}

export function slugToRole(value?: string): UserRole | null {
  if (!value) {
    return null;
  }
  return SLUG_TO_ROLE[value as RoleSlug] ?? null;
}

export function pageToSlug(page: WorkspacePageId): string {
  return PAGE_ID_TO_SLUG[page];
}

export function slugToPage(value?: string): WorkspacePageId | null {
  if (!value) {
    return null;
  }
  return PAGE_SLUG_TO_ID[value] ?? null;
}

export function isPageAllowedForRole(role: UserRole, page: WorkspacePageId): boolean {
  return ROLE_ALLOWED_PAGES[role].includes(page);
}

export function normalizePageForRole(role: UserRole, page?: WorkspacePageId | null): WorkspacePageId {
  if (page && isPageAllowedForRole(role, page)) {
    return page;
  }
  return DEFAULT_WORKSPACE_PAGE;
}

export function buildWorkspacePath(role: UserRole, page: WorkspacePageId = DEFAULT_WORKSPACE_PAGE): string {
  const roleSlug = roleToSlug(role);
  if (page === DEFAULT_WORKSPACE_PAGE) {
    return `/app/${roleSlug}`;
  }
  return `/app/${roleSlug}/${pageToSlug(page)}`;
}
