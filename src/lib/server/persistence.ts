import type { TenantContext } from "./tenant-types";

type TenantDomain =
  | "dashboard"
  | "branding"
  | "settings"
  | "documents"
  | "notifications"
  | "messages"
  | "calendar"
  | "interventions"
  | "lesson_plans"
  | "imports"
  | "staff"
  | "gradebook_assignments"
  | "gradebook_grades"
  | "student_profiles"
  | "referrals"
  | "students_master"
  | "students_class"
  | "tenant_organizations"
  | "tenant_districts"
  | "tenant_schools"
  | "tenant_users"
  | "tenant_memberships"
  | "tenant_groups"
  | "tenant_invites";

const DEFAULT_CONVEX_CLOUD_URL = "https://calculating-rook-861.convex.cloud";
const DEFAULT_CONVEX_ACTIONS_URL = "https://calculating-rook-861.convex.site";

const CONVEX_CLOUD_URL = process.env.CONVEX_CLOUD_URL ?? DEFAULT_CONVEX_CLOUD_URL;
const CONVEX_ACTIONS_URL = process.env.CONVEX_ACTIONS_URL ?? DEFAULT_CONVEX_ACTIONS_URL;
const CONVEX_USE_BACKEND = (process.env.CONVEX_USE_BACKEND ?? "true").toLowerCase() !== "false";
const MEMORY_FALLBACK_ENABLED = (
  process.env.PERSISTENCE_ALLOW_MEMORY_FALLBACK ?? (process.env.NODE_ENV === "production" ? "false" : "true")
).toLowerCase() !== "false";

const FN_GET_COLLECTION = process.env.CONVEX_FN_GET_COLLECTION ?? "phase3:getTenantCollection";
const FN_SET_COLLECTION = process.env.CONVEX_FN_SET_COLLECTION ?? "phase3:setTenantCollection";
const FN_APPEND_AUDIT = process.env.CONVEX_FN_APPEND_AUDIT ?? "phase3:appendAuditEntry";
const FN_COUNT_AUDIT = process.env.CONVEX_FN_COUNT_AUDIT ?? "phase3:countAuditEntries";
const FN_LIST_AUDIT = process.env.CONVEX_FN_LIST_AUDIT ?? "phase3:listAuditEntries";
const FN_LIST_INTERVENTION_ROWS = process.env.CONVEX_FN_LIST_INTERVENTION_ROWS ?? "phase3:listInterventionRows";
const FN_REPLACE_INTERVENTION_ROWS = process.env.CONVEX_FN_REPLACE_INTERVENTION_ROWS ?? "phase3:replaceInterventionRows";
const FN_UPSERT_INTERVENTION_ROW = process.env.CONVEX_FN_UPSERT_INTERVENTION_ROW ?? "phase3:upsertInterventionRow";
const FN_DELETE_INTERVENTION_ROW = process.env.CONVEX_FN_DELETE_INTERVENTION_ROW ?? "phase3:deleteInterventionRow";
const FN_LIST_CALENDAR_ROWS = process.env.CONVEX_FN_LIST_CALENDAR_ROWS ?? "phase3:listCalendarRows";
const FN_REPLACE_CALENDAR_ROWS = process.env.CONVEX_FN_REPLACE_CALENDAR_ROWS ?? "phase3:replaceCalendarRows";
const FN_UPSERT_CALENDAR_ROW = process.env.CONVEX_FN_UPSERT_CALENDAR_ROW ?? "phase3:upsertCalendarRow";
const FN_DELETE_CALENDAR_ROW = process.env.CONVEX_FN_DELETE_CALENDAR_ROW ?? "phase3:deleteCalendarRow";
const FN_LIST_NOTIFICATION_ROWS = process.env.CONVEX_FN_LIST_NOTIFICATION_ROWS ?? "phase3:listNotificationRows";
const FN_REPLACE_NOTIFICATION_ROWS = process.env.CONVEX_FN_REPLACE_NOTIFICATION_ROWS ?? "phase3:replaceNotificationRows";
const FN_UPSERT_NOTIFICATION_ROW = process.env.CONVEX_FN_UPSERT_NOTIFICATION_ROW ?? "phase3:upsertNotificationRow";
const FN_DELETE_NOTIFICATION_ROW = process.env.CONVEX_FN_DELETE_NOTIFICATION_ROW ?? "phase3:deleteNotificationRow";
const FN_LIST_MESSAGE_ROWS = process.env.CONVEX_FN_LIST_MESSAGE_ROWS ?? "phase3:listMessageRows";
const FN_REPLACE_MESSAGE_ROWS = process.env.CONVEX_FN_REPLACE_MESSAGE_ROWS ?? "phase3:replaceMessageRows";
const FN_UPSERT_MESSAGE_ROW = process.env.CONVEX_FN_UPSERT_MESSAGE_ROW ?? "phase3:upsertMessageRow";
const FN_DELETE_MESSAGE_ROW = process.env.CONVEX_FN_DELETE_MESSAGE_ROW ?? "phase3:deleteMessageRow";
const FN_LIST_DOCUMENT_ROWS = process.env.CONVEX_FN_LIST_DOCUMENT_ROWS ?? "phase3:listDocumentRows";
const FN_REPLACE_DOCUMENT_ROWS = process.env.CONVEX_FN_REPLACE_DOCUMENT_ROWS ?? "phase3:replaceDocumentRows";
const FN_UPSERT_DOCUMENT_ROW = process.env.CONVEX_FN_UPSERT_DOCUMENT_ROW ?? "phase3:upsertDocumentRow";
const FN_DELETE_DOCUMENT_ROW = process.env.CONVEX_FN_DELETE_DOCUMENT_ROW ?? "phase3:deleteDocumentRow";
const FN_LIST_GRADEBOOK_ASSIGNMENT_ROWS = process.env.CONVEX_FN_LIST_GRADEBOOK_ASSIGNMENT_ROWS ?? "phase3:listGradebookAssignmentRows";
const FN_REPLACE_GRADEBOOK_ASSIGNMENT_ROWS = process.env.CONVEX_FN_REPLACE_GRADEBOOK_ASSIGNMENT_ROWS ?? "phase3:replaceGradebookAssignmentRows";
const FN_UPSERT_GRADEBOOK_ASSIGNMENT_ROW = process.env.CONVEX_FN_UPSERT_GRADEBOOK_ASSIGNMENT_ROW ?? "phase3:upsertGradebookAssignmentRow";
const FN_DELETE_GRADEBOOK_ASSIGNMENT_ROW = process.env.CONVEX_FN_DELETE_GRADEBOOK_ASSIGNMENT_ROW ?? "phase3:deleteGradebookAssignmentRow";
const FN_LIST_GRADEBOOK_GRADE_ROWS = process.env.CONVEX_FN_LIST_GRADEBOOK_GRADE_ROWS ?? "phase3:listGradebookGradeRows";
const FN_REPLACE_GRADEBOOK_GRADE_ROWS = process.env.CONVEX_FN_REPLACE_GRADEBOOK_GRADE_ROWS ?? "phase3:replaceGradebookGradeRows";
const FN_UPSERT_GRADEBOOK_GRADE_ROW = process.env.CONVEX_FN_UPSERT_GRADEBOOK_GRADE_ROW ?? "phase3:upsertGradebookGradeRow";
const FN_DELETE_GRADEBOOK_GRADE_ROW = process.env.CONVEX_FN_DELETE_GRADEBOOK_GRADE_ROW ?? "phase3:deleteGradebookGradeRow";
const FN_LIST_STUDENT_PROFILE_ROWS = process.env.CONVEX_FN_LIST_STUDENT_PROFILE_ROWS ?? "phase3:listStudentProfileRows";
const FN_REPLACE_STUDENT_PROFILE_ROWS = process.env.CONVEX_FN_REPLACE_STUDENT_PROFILE_ROWS ?? "phase3:replaceStudentProfileRows";
const FN_UPSERT_STUDENT_PROFILE_ROW = process.env.CONVEX_FN_UPSERT_STUDENT_PROFILE_ROW ?? "phase3:upsertStudentProfileRow";
const FN_DELETE_STUDENT_PROFILE_ROW = process.env.CONVEX_FN_DELETE_STUDENT_PROFILE_ROW ?? "phase3:deleteStudentProfileRow";
const FN_LIST_LESSON_PLAN_ROWS = process.env.CONVEX_FN_LIST_LESSON_PLAN_ROWS ?? "phase3:listLessonPlanRows";
const FN_REPLACE_LESSON_PLAN_ROWS = process.env.CONVEX_FN_REPLACE_LESSON_PLAN_ROWS ?? "phase3:replaceLessonPlanRows";
const FN_UPSERT_LESSON_PLAN_ROW = process.env.CONVEX_FN_UPSERT_LESSON_PLAN_ROW ?? "phase3:upsertLessonPlanRow";
const FN_DELETE_LESSON_PLAN_ROW = process.env.CONVEX_FN_DELETE_LESSON_PLAN_ROW ?? "phase3:deleteLessonPlanRow";
const FN_LIST_STAFF_ROWS = process.env.CONVEX_FN_LIST_STAFF_ROWS ?? "phase3:listStaffRows";
const FN_REPLACE_STAFF_ROWS = process.env.CONVEX_FN_REPLACE_STAFF_ROWS ?? "phase3:replaceStaffRows";
const FN_UPSERT_STAFF_ROW = process.env.CONVEX_FN_UPSERT_STAFF_ROW ?? "phase3:upsertStaffRow";
const FN_DELETE_STAFF_ROW = process.env.CONVEX_FN_DELETE_STAFF_ROW ?? "phase3:deleteStaffRow";
const FN_LIST_IMPORT_ROWS = process.env.CONVEX_FN_LIST_IMPORT_ROWS ?? "phase3:listImportRows";
const FN_REPLACE_IMPORT_ROWS = process.env.CONVEX_FN_REPLACE_IMPORT_ROWS ?? "phase3:replaceImportRows";
const FN_UPSERT_IMPORT_ROW = process.env.CONVEX_FN_UPSERT_IMPORT_ROW ?? "phase3:upsertImportRow";
const FN_DELETE_IMPORT_ROW = process.env.CONVEX_FN_DELETE_IMPORT_ROW ?? "phase3:deleteImportRow";
const FN_LIST_REFERRAL_ROWS = process.env.CONVEX_FN_LIST_REFERRAL_ROWS ?? "phase3:listReferralRows";
const FN_REPLACE_REFERRAL_ROWS = process.env.CONVEX_FN_REPLACE_REFERRAL_ROWS ?? "phase3:replaceReferralRows";
const FN_UPSERT_REFERRAL_ROW = process.env.CONVEX_FN_UPSERT_REFERRAL_ROW ?? "phase3:upsertReferralRow";
const FN_DELETE_REFERRAL_ROW = process.env.CONVEX_FN_DELETE_REFERRAL_ROW ?? "phase3:deleteReferralRow";
const FN_LIST_STUDENT_ROWS = process.env.CONVEX_FN_LIST_STUDENT_ROWS ?? "phase3:listStudentRows";
const FN_REPLACE_STUDENT_ROWS = process.env.CONVEX_FN_REPLACE_STUDENT_ROWS ?? "phase3:replaceStudentRows";
const FN_UPSERT_STUDENT_ROW = process.env.CONVEX_FN_UPSERT_STUDENT_ROW ?? "phase3:upsertStudentRow";
const FN_DELETE_STUDENT_ROW = process.env.CONVEX_FN_DELETE_STUDENT_ROW ?? "phase3:deleteStudentRow";

const localCollections = new Map<string, unknown[]>();
const localAuditByTenant = new Map<string, unknown[]>();
const localInterventionRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localCalendarRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localNotificationRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localMessageRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localDocumentRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localGradebookAssignmentRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localGradebookGradeRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localStudentProfileRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localLessonPlanRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localStaffRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localImportRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localReferralRows = new Map<string, Map<string, { position: number; row: unknown }>>();
const localStudentRows = new Map<string, Map<string, unknown>>();

let lastConvexError: string | null = null;

export type AuditEntryListFilters = {
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: "create" | "update" | "delete" | "read";
  from?: string;
  to?: string;
  limit?: number;
};

export type StudentRowScope = "master" | "class";

export class PersistenceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceUnavailableError";
  }
}

export const toTenantKey = (context: TenantContext): string =>
  `${context.organizationId}::${context.districtId ?? "district"}::${context.schoolId ?? "all-schools"}`;

const getCollectionKey = (tenantKey: string, domain: TenantDomain): string => `${domain}::${tenantKey}`;

const isConvexEnabled = (): boolean => CONVEX_USE_BACKEND && Boolean(CONVEX_CLOUD_URL);

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const filterAuditEntries = <T>(entries: T[], filters: AuditEntryListFilters = {}): T[] => {
  const fromTime = filters.from ? Date.parse(filters.from) : Number.NEGATIVE_INFINITY;
  const toTime = filters.to ? Date.parse(filters.to) : Number.POSITIVE_INFINITY;

  const filtered = entries.filter((entry) => {
    const record = asRecord(entry);
    if (!record) return false;
    if (filters.actorUserId && record.actorUserId !== filters.actorUserId) return false;
    if (filters.resourceType && record.resourceType !== filters.resourceType) return false;
    if (filters.resourceId && record.resourceId !== filters.resourceId) return false;
    if (filters.action && record.action !== filters.action) return false;

    const timestamp = typeof record.timestamp === "string" ? Date.parse(record.timestamp) : Number.NaN;
    if (Number.isFinite(fromTime) && Number.isFinite(timestamp) && timestamp < fromTime) return false;
    if (Number.isFinite(toTime) && Number.isFinite(timestamp) && timestamp > toTime) return false;
    return true;
  });

  filtered.sort((left, right) => {
    const leftRecord = asRecord(left);
    const rightRecord = asRecord(right);
    const leftTimestamp = typeof leftRecord?.timestamp === "string" ? Date.parse(leftRecord.timestamp) : 0;
    const rightTimestamp = typeof rightRecord?.timestamp === "string" ? Date.parse(rightRecord.timestamp) : 0;
    return rightTimestamp - leftTimestamp;
  });

  const limit = filters.limit && Number.isFinite(filters.limit) ? Math.max(1, Math.floor(filters.limit)) : null;
  return limit ? filtered.slice(0, limit) : filtered;
};

const getStudentScopeKey = (tenantKey: string, scope: StudentRowScope): string => `${tenantKey}::${scope}`;
const getOrderedLocalRows = <T>(bucket: Map<string, { position: number; row: unknown }> | undefined): T[] =>
  [...(bucket?.values() ?? [])]
    .sort((left, right) => left.position - right.position)
    .map((entry) => structuredClone(entry.row) as T);

async function convexCall<T>(kind: "query" | "mutation", path: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${CONVEX_CLOUD_URL}/api/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });

  const payload = (await response.json()) as {
    status?: "success" | "error";
    value?: T;
    errorMessage?: string;
  };

  if (!response.ok || payload.status === "error") {
    throw new Error(payload.errorMessage ?? `Convex ${kind} call failed with status ${response.status}`);
  }

  return payload.value as T;
}

export async function readTenantCollection<T>(tenantKey: string, domain: TenantDomain, seedFactory: () => T[]): Promise<T[]> {
  const collectionKey = getCollectionKey(tenantKey, domain);
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    const cached = localCollections.get(collectionKey);
    if (cached) return structuredClone(cached as T[]);
    const seeded = seedFactory();
    localCollections.set(collectionKey, structuredClone(seeded) as unknown[]);
    return structuredClone(seeded);
  }

  try {
    const remoteRows = await convexCall<T[] | null>("query", FN_GET_COLLECTION, { tenantKey, domain });
    if (Array.isArray(remoteRows)) {
      localCollections.set(collectionKey, structuredClone(remoteRows) as unknown[]);
      lastConvexError = null;
      return structuredClone(remoteRows);
    }

    const seeded = seedFactory();
    localCollections.set(collectionKey, structuredClone(seeded) as unknown[]);
    await convexCall("mutation", FN_SET_COLLECTION, { tenantKey, domain, rows: seeded });
    lastConvexError = null;
    return structuredClone(seeded);
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }

    const cached = localCollections.get(collectionKey);
    if (cached) return structuredClone(cached as T[]);

    const seeded = seedFactory();
    localCollections.set(collectionKey, structuredClone(seeded) as unknown[]);
    return structuredClone(seeded);
  }
}

export async function writeTenantCollection<T>(tenantKey: string, domain: TenantDomain, rows: T[]): Promise<void> {
  const collectionKey = getCollectionKey(tenantKey, domain);
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localCollections.set(collectionKey, structuredClone(rows) as unknown[]);
    return;
  }

  try {
    await convexCall("mutation", FN_SET_COLLECTION, { tenantKey, domain, rows });
    localCollections.set(collectionKey, structuredClone(rows) as unknown[]);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localCollections.set(collectionKey, structuredClone(rows) as unknown[]);
  }
}

export async function appendAuditEntryByTenant(tenantKey: string, entry: unknown): Promise<void> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    const existing = localAuditByTenant.get(tenantKey) ?? [];
    localAuditByTenant.set(tenantKey, [entry, ...existing]);
    return;
  }

  try {
    await convexCall("mutation", FN_APPEND_AUDIT, { tenantKey, entry });
    const existing = localAuditByTenant.get(tenantKey) ?? [];
    localAuditByTenant.set(tenantKey, [entry, ...existing]);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    const existing = localAuditByTenant.get(tenantKey) ?? [];
    localAuditByTenant.set(tenantKey, [entry, ...existing]);
  }
}

export async function countAuditEntriesByTenant(tenantKey: string): Promise<number> {
  if (!isConvexEnabled() && !MEMORY_FALLBACK_ENABLED) {
    throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
  }

  if (isConvexEnabled()) {
    try {
      const count = await convexCall<number>("query", FN_COUNT_AUDIT, { tenantKey });
      lastConvexError = null;
      return count;
    } catch (error) {
      lastConvexError = getErrorMessage(error);
      if (!MEMORY_FALLBACK_ENABLED) {
        throw new PersistenceUnavailableError(lastConvexError);
      }
    }
  }

  return (localAuditByTenant.get(tenantKey) ?? []).length;
}

export async function listAuditEntriesByTenant<T>(tenantKey: string, filters: AuditEntryListFilters = {}): Promise<T[]> {
  if (!isConvexEnabled() && !MEMORY_FALLBACK_ENABLED) {
    throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
  }

  if (isConvexEnabled()) {
    try {
      const rows = await convexCall<T[]>("query", FN_LIST_AUDIT, {
        tenantKey,
        actorUserId: filters.actorUserId,
        resourceType: filters.resourceType,
        resourceId: filters.resourceId,
        action: filters.action,
        from: filters.from,
        to: filters.to,
        limit: filters.limit,
      });
      lastConvexError = null;
      return Array.isArray(rows) ? structuredClone(rows) : [];
    } catch (error) {
      lastConvexError = getErrorMessage(error);
      if (!MEMORY_FALLBACK_ENABLED) {
        throw new PersistenceUnavailableError(lastConvexError);
      }
    }
  }

  return structuredClone(filterAuditEntries(localAuditByTenant.get(tenantKey) ?? [], filters) as T[]);
}

export async function listInterventionRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localInterventionRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_INTERVENTION_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localInterventionRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localInterventionRows.get(tenantKey));
  }
}

export async function listCalendarRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localCalendarRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_CALENDAR_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localCalendarRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localCalendarRows.get(tenantKey));
  }
}

export async function replaceCalendarRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localCalendarRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_CALENDAR_ROWS, { tenantKey, rows });
    localCalendarRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localCalendarRows.set(tenantKey, bucket);
  }
}

export async function upsertCalendarRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localCalendarRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localCalendarRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_CALENDAR_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteCalendarRowByTenant(tenantKey: string, eventId: string): Promise<void> {
  const existing = localCalendarRows.get(tenantKey);
  existing?.delete(eventId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_CALENDAR_ROW, { tenantKey, eventId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listNotificationRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localNotificationRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_NOTIFICATION_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localNotificationRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localNotificationRows.get(tenantKey));
  }
}

export async function replaceNotificationRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localNotificationRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_NOTIFICATION_ROWS, { tenantKey, rows });
    localNotificationRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localNotificationRows.set(tenantKey, bucket);
  }
}

export async function upsertNotificationRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localNotificationRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localNotificationRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_NOTIFICATION_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteNotificationRowByTenant(tenantKey: string, notificationId: string): Promise<void> {
  const existing = localNotificationRows.get(tenantKey);
  existing?.delete(notificationId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_NOTIFICATION_ROW, { tenantKey, notificationId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listMessageRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localMessageRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_MESSAGE_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localMessageRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localMessageRows.get(tenantKey));
  }
}

export async function replaceMessageRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localMessageRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_MESSAGE_ROWS, { tenantKey, rows });
    localMessageRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localMessageRows.set(tenantKey, bucket);
  }
}

export async function upsertMessageRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localMessageRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localMessageRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_MESSAGE_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteMessageRowByTenant(tenantKey: string, conversationId: string): Promise<void> {
  const existing = localMessageRows.get(tenantKey);
  existing?.delete(conversationId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_MESSAGE_ROW, { tenantKey, conversationId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listDocumentRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localDocumentRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_DOCUMENT_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localDocumentRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localDocumentRows.get(tenantKey));
  }
}

export async function replaceDocumentRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localDocumentRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_DOCUMENT_ROWS, { tenantKey, rows });
    localDocumentRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localDocumentRows.set(tenantKey, bucket);
  }
}

export async function upsertDocumentRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localDocumentRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localDocumentRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_DOCUMENT_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteDocumentRowByTenant(tenantKey: string, documentId: string): Promise<void> {
  const existing = localDocumentRows.get(tenantKey);
  existing?.delete(documentId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_DOCUMENT_ROW, { tenantKey, documentId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listGradebookAssignmentRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localGradebookAssignmentRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_GRADEBOOK_ASSIGNMENT_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localGradebookAssignmentRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localGradebookAssignmentRows.get(tenantKey));
  }
}

export async function replaceGradebookAssignmentRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localGradebookAssignmentRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_GRADEBOOK_ASSIGNMENT_ROWS, { tenantKey, rows });
    localGradebookAssignmentRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localGradebookAssignmentRows.set(tenantKey, bucket);
  }
}

export async function upsertGradebookAssignmentRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localGradebookAssignmentRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localGradebookAssignmentRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_GRADEBOOK_ASSIGNMENT_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteGradebookAssignmentRowByTenant(tenantKey: string, assignmentId: string): Promise<void> {
  const existing = localGradebookAssignmentRows.get(tenantKey);
  existing?.delete(assignmentId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_GRADEBOOK_ASSIGNMENT_ROW, { tenantKey, assignmentId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listGradebookGradeRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localGradebookGradeRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_GRADEBOOK_GRADE_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localGradebookGradeRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localGradebookGradeRows.get(tenantKey));
  }
}

export async function replaceGradebookGradeRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localGradebookGradeRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_GRADEBOOK_GRADE_ROWS, { tenantKey, rows });
    localGradebookGradeRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localGradebookGradeRows.set(tenantKey, bucket);
  }
}

export async function upsertGradebookGradeRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localGradebookGradeRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localGradebookGradeRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_GRADEBOOK_GRADE_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteGradebookGradeRowByTenant(tenantKey: string, gradeId: string): Promise<void> {
  const existing = localGradebookGradeRows.get(tenantKey);
  existing?.delete(gradeId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_GRADEBOOK_GRADE_ROW, { tenantKey, gradeId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listStudentProfileRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localStudentProfileRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_STUDENT_PROFILE_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localStudentProfileRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localStudentProfileRows.get(tenantKey));
  }
}

export async function replaceStudentProfileRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localStudentProfileRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_STUDENT_PROFILE_ROWS, { tenantKey, rows });
    localStudentProfileRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localStudentProfileRows.set(tenantKey, bucket);
  }
}

export async function upsertStudentProfileRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localStudentProfileRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localStudentProfileRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_STUDENT_PROFILE_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteStudentProfileRowByTenant(tenantKey: string, studentId: string): Promise<void> {
  const existing = localStudentProfileRows.get(tenantKey);
  existing?.delete(studentId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_STUDENT_PROFILE_ROW, { tenantKey, studentId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listLessonPlanRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localLessonPlanRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_LESSON_PLAN_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localLessonPlanRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localLessonPlanRows.get(tenantKey));
  }
}

export async function replaceLessonPlanRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localLessonPlanRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_LESSON_PLAN_ROWS, { tenantKey, rows });
    localLessonPlanRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localLessonPlanRows.set(tenantKey, bucket);
  }
}

export async function upsertLessonPlanRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localLessonPlanRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localLessonPlanRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_LESSON_PLAN_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteLessonPlanRowByTenant(tenantKey: string, lessonPlanId: string): Promise<void> {
  const existing = localLessonPlanRows.get(tenantKey);
  existing?.delete(lessonPlanId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_LESSON_PLAN_ROW, { tenantKey, lessonPlanId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listStaffRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localStaffRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_STAFF_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localStaffRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localStaffRows.get(tenantKey));
  }
}

export async function replaceStaffRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localStaffRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_STAFF_ROWS, { tenantKey, rows });
    localStaffRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localStaffRows.set(tenantKey, bucket);
  }
}

export async function upsertStaffRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localStaffRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localStaffRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_STAFF_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteStaffRowByTenant(tenantKey: string, staffId: string): Promise<void> {
  const existing = localStaffRows.get(tenantKey);
  existing?.delete(staffId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_STAFF_ROW, { tenantKey, staffId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listImportRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localImportRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_IMPORT_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localImportRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localImportRows.get(tenantKey));
  }
}

export async function replaceImportRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localImportRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_IMPORT_ROWS, { tenantKey, rows });
    localImportRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localImportRows.set(tenantKey, bucket);
  }
}

export async function upsertImportRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localImportRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localImportRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_IMPORT_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteImportRowByTenant(tenantKey: string, importId: string): Promise<void> {
  const existing = localImportRows.get(tenantKey);
  existing?.delete(importId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_IMPORT_ROW, { tenantKey, importId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listReferralRowsByTenant<T>(tenantKey: string): Promise<T[]> {
  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return getOrderedLocalRows<T>(localReferralRows.get(tenantKey));
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_REFERRAL_ROWS, { tenantKey });
    const bucket = new Map<string, { position: number; row: unknown }>();
    for (let index = 0; index < (Array.isArray(rows) ? rows.length : 0); index += 1) {
      const row = rows[index];
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, { position: index, row: structuredClone(row) });
      }
    }
    localReferralRows.set(tenantKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return getOrderedLocalRows<T>(localReferralRows.get(tenantKey));
  }
}

export async function replaceReferralRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localReferralRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_REFERRAL_ROWS, { tenantKey, rows });
    localReferralRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localReferralRows.set(tenantKey, bucket);
  }
}

export async function upsertReferralRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localReferralRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localReferralRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_REFERRAL_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteReferralRowByTenant(tenantKey: string, referralId: string): Promise<void> {
  const existing = localReferralRows.get(tenantKey);
  existing?.delete(referralId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_REFERRAL_ROW, { tenantKey, referralId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function replaceInterventionRowsByTenant<T extends { id: string }>(tenantKey: string, rows: T[]): Promise<void> {
  const bucket = new Map<string, { position: number; row: unknown }>(
    rows.map((row, index) => [row.id, { position: index, row: structuredClone(row) }]),
  );

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localInterventionRows.set(tenantKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_INTERVENTION_ROWS, { tenantKey, rows });
    localInterventionRows.set(tenantKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localInterventionRows.set(tenantKey, bucket);
  }
}

export async function upsertInterventionRowByTenant<T extends { id: string }>(
  tenantKey: string,
  row: T,
  position?: number
): Promise<void> {
  const existing = localInterventionRows.get(tenantKey) ?? new Map<string, { position: number; row: unknown }>();
  const prior = existing.get(row.id);
  const nextPosition = typeof position === "number" && Number.isFinite(position)
    ? Math.floor(position)
    : prior?.position ?? (existing.size === 0 ? 0 : Math.min(...[...existing.values()].map((entry) => entry.position)) - 1);
  existing.set(row.id, { position: nextPosition, row: structuredClone(row) });
  localInterventionRows.set(tenantKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_INTERVENTION_ROW, { tenantKey, row, position: nextPosition });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteInterventionRowByTenant(tenantKey: string, interventionId: string): Promise<void> {
  const existing = localInterventionRows.get(tenantKey);
  existing?.delete(interventionId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_INTERVENTION_ROW, { tenantKey, interventionId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function listStudentRowsByTenant<T>(tenantKey: string, scope: StudentRowScope): Promise<T[]> {
  const scopeKey = getStudentScopeKey(tenantKey, scope);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    const rows = [...(localStudentRows.get(scopeKey)?.values() ?? [])] as T[];
    return structuredClone(rows);
  }

  try {
    const rows = await convexCall<T[]>("query", FN_LIST_STUDENT_ROWS, { tenantKey, scope });
    const bucket = new Map<string, unknown>();
    for (const row of Array.isArray(rows) ? rows : []) {
      const record = asRecord(row);
      if (typeof record?.id === "string") {
        bucket.set(record.id, structuredClone(row));
      }
    }
    localStudentRows.set(scopeKey, bucket);
    lastConvexError = null;
    return Array.isArray(rows) ? structuredClone(rows) : [];
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    return structuredClone([...(localStudentRows.get(scopeKey)?.values() ?? [])] as T[]);
  }
}

export async function replaceStudentRowsByTenant<T extends { id: string }>(
  tenantKey: string,
  scope: StudentRowScope,
  rows: T[]
): Promise<void> {
  const scopeKey = getStudentScopeKey(tenantKey, scope);
  const bucket = new Map<string, unknown>(rows.map((row) => [row.id, structuredClone(row)]));

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    localStudentRows.set(scopeKey, bucket);
    return;
  }

  try {
    await convexCall("mutation", FN_REPLACE_STUDENT_ROWS, { tenantKey, scope, rows });
    localStudentRows.set(scopeKey, bucket);
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
    localStudentRows.set(scopeKey, bucket);
  }
}

export async function upsertStudentRowByTenant<T extends { id: string }>(
  tenantKey: string,
  scope: StudentRowScope,
  row: T
): Promise<void> {
  const scopeKey = getStudentScopeKey(tenantKey, scope);
  const existing = localStudentRows.get(scopeKey) ?? new Map<string, unknown>();
  existing.set(row.id, structuredClone(row));
  localStudentRows.set(scopeKey, existing);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_UPSERT_STUDENT_ROW, { tenantKey, scope, row });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export async function deleteStudentRowByTenant(
  tenantKey: string,
  scope: StudentRowScope,
  studentId: string
): Promise<void> {
  const scopeKey = getStudentScopeKey(tenantKey, scope);
  const existing = localStudentRows.get(scopeKey);
  existing?.delete(studentId);

  if (!isConvexEnabled()) {
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError("Persistent backend is unavailable and memory fallback is disabled.");
    }
    return;
  }

  try {
    await convexCall("mutation", FN_DELETE_STUDENT_ROW, { tenantKey, scope, studentId });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
    if (!MEMORY_FALLBACK_ENABLED) {
      throw new PersistenceUnavailableError(lastConvexError);
    }
  }
}

export function getPersistenceDiagnostics() {
  return {
    mode: isConvexEnabled() ? "convex" : "memory",
    collectionReadStrategy: isConvexEnabled() ? "backend-first-with-memory-fallback" : "memory-only",
    memoryFallbackEnabled: MEMORY_FALLBACK_ENABLED,
    convexCloudUrl: CONVEX_CLOUD_URL || null,
    convexActionsUrl: CONVEX_ACTIONS_URL || null,
    lastConvexError,
  };
}
