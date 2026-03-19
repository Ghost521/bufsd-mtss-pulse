import {
  deleteCalendarRowByTenant,
  deleteDocumentRowByTenant,
  deleteGradebookAssignmentRowByTenant,
  deleteGradebookGradeRowByTenant,
  deleteReferralRowByTenant,
  deleteInterventionRowByTenant,
  deleteMessageRowByTenant,
  deleteNotificationRowByTenant,
  listCalendarRowsByTenant,
  listDocumentRowsByTenant,
  listGradebookAssignmentRowsByTenant,
  listGradebookGradeRowsByTenant,
  listMessageRowsByTenant,
  listReferralRowsByTenant,
  listInterventionRowsByTenant,
  listNotificationRowsByTenant,
  readTenantCollection,
  replaceCalendarRowsByTenant,
  replaceDocumentRowsByTenant,
  replaceGradebookAssignmentRowsByTenant,
  replaceGradebookGradeRowsByTenant,
  replaceMessageRowsByTenant,
  replaceReferralRowsByTenant,
  replaceInterventionRowsByTenant,
  replaceNotificationRowsByTenant,
  toTenantKey,
  upsertCalendarRowByTenant,
  upsertDocumentRowByTenant,
  upsertGradebookAssignmentRowByTenant,
  upsertGradebookGradeRowByTenant,
  upsertMessageRowByTenant,
  upsertReferralRowByTenant,
  upsertInterventionRowByTenant,
  upsertNotificationRowByTenant,
  writeTenantCollection,
} from "./persistence";
import type { SessionContext } from "./tenant-types";
import { dataDomainCollectionSchemaMap, dataDomainRowSchemaMap } from "../schemas/data";

export type DataDomain =
  | "branding"
  | "calendar"
  | "notifications"
  | "messages"
  | "documents"
  | "interventions"
  | "lesson-plans"
  | "imports"
  | "settings"
  | "staff"
  | "gradebook-assignments"
  | "gradebook-grades"
  | "student-profiles"
  | "referrals";

type PersistedDomain =
  | "branding"
  | "calendar"
  | "notifications"
  | "messages"
  | "documents"
  | "interventions"
  | "lesson_plans"
  | "imports"
  | "settings"
  | "staff"
  | "gradebook_assignments"
  | "gradebook_grades"
  | "student_profiles"
  | "referrals";

const toPersistedDomain = (domain: DataDomain): PersistedDomain => {
  if (domain === "lesson-plans") return "lesson_plans";
  if (domain === "gradebook-assignments") return "gradebook_assignments";
  if (domain === "gradebook-grades") return "gradebook_grades";
  if (domain === "student-profiles") return "student_profiles";
  return domain;
};

const ensureArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const ensureId = (row: Record<string, unknown>): string => {
  if (typeof row.id === "string" && row.id.trim().length > 0) return row.id;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatValidationMessage = (message: string): string => message.replace(/Invalid input:/g, "").trim() || "Invalid payload.";
const isCalendarDomain = (domain: DataDomain): boolean => domain === "calendar";
const isDocumentDomain = (domain: DataDomain): boolean => domain === "documents";
const isGradebookAssignmentDomain = (domain: DataDomain): boolean => domain === "gradebook-assignments";
const isGradebookGradeDomain = (domain: DataDomain): boolean => domain === "gradebook-grades";
const isInterventionDomain = (domain: DataDomain): boolean => domain === "interventions";
const isMessageDomain = (domain: DataDomain): boolean => domain === "messages";
const isNotificationDomain = (domain: DataDomain): boolean => domain === "notifications";
const isReferralDomain = (domain: DataDomain): boolean => domain === "referrals";

const parseRowsForDomain = <T>(domain: DataDomain, rows: unknown, status = 400): T[] => {
  const parsed = dataDomainCollectionSchemaMap[domain].safeParse(rows);
  if (!parsed.success) {
    throw new CollectionStoreError(formatValidationMessage(parsed.error.issues[0]?.message ?? "Invalid row collection."), status);
  }
  return parsed.data as unknown as T[];
};

const parseRowForDomain = <T>(domain: DataDomain, row: unknown, status = 400): T => {
  const parsed = dataDomainRowSchemaMap[domain].safeParse(row);
  if (!parsed.success) {
    throw new CollectionStoreError(formatValidationMessage(parsed.error.issues[0]?.message ?? "Invalid row payload."), status);
  }
  return parsed.data as unknown as T;
};

export class CollectionStoreError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CollectionStoreError";
    this.status = status;
  }
}

const readCalendarRows = async <T>(tenantKey: string): Promise<T[]> => {
  const rowLevelRows = parseRowsForDomain<T>("calendar", await listCalendarRowsByTenant<unknown>(tenantKey), 500);
  if (rowLevelRows.length > 0) return rowLevelRows;

  const legacyRows = await readTenantCollection<unknown>(tenantKey, "calendar", () => []);
  const parsedLegacyRows = parseRowsForDomain<T>("calendar", ensureArray<T>(legacyRows), 500);
  if (parsedLegacyRows.length > 0) {
    await replaceCalendarRowsByTenant(tenantKey, parsedLegacyRows as Array<T & { id: string }>);
  }
  return parsedLegacyRows;
};

const readInterventionRows = async <T>(tenantKey: string): Promise<T[]> => {
  const rowLevelRows = parseRowsForDomain<T>("interventions", await listInterventionRowsByTenant<unknown>(tenantKey), 500);
  if (rowLevelRows.length > 0) return rowLevelRows;

  const legacyRows = await readTenantCollection<unknown>(tenantKey, "interventions", () => []);
  const parsedLegacyRows = parseRowsForDomain<T>("interventions", ensureArray<T>(legacyRows), 500);
  if (parsedLegacyRows.length > 0) {
    await replaceInterventionRowsByTenant(tenantKey, parsedLegacyRows as Array<T & { id: string }>);
  }
  return parsedLegacyRows;
};

const readNotificationRows = async <T>(tenantKey: string): Promise<T[]> => {
  const rowLevelRows = parseRowsForDomain<T>("notifications", await listNotificationRowsByTenant<unknown>(tenantKey), 500);
  if (rowLevelRows.length > 0) return rowLevelRows;

  const legacyRows = await readTenantCollection<unknown>(tenantKey, "notifications", () => []);
  const parsedLegacyRows = parseRowsForDomain<T>("notifications", ensureArray<T>(legacyRows), 500);
  if (parsedLegacyRows.length > 0) {
    await replaceNotificationRowsByTenant(tenantKey, parsedLegacyRows as Array<T & { id: string }>);
  }
  return parsedLegacyRows;
};

const readMessageRows = async <T>(tenantKey: string): Promise<T[]> => {
  const rowLevelRows = parseRowsForDomain<T>("messages", await listMessageRowsByTenant<unknown>(tenantKey), 500);
  if (rowLevelRows.length > 0) return rowLevelRows;

  const legacyRows = await readTenantCollection<unknown>(tenantKey, "messages", () => []);
  const parsedLegacyRows = parseRowsForDomain<T>("messages", ensureArray<T>(legacyRows), 500);
  if (parsedLegacyRows.length > 0) {
    await replaceMessageRowsByTenant(tenantKey, parsedLegacyRows as Array<T & { id: string }>);
  }
  return parsedLegacyRows;
};

const readDocumentRows = async <T>(tenantKey: string): Promise<T[]> => {
  const rowLevelRows = parseRowsForDomain<T>("documents", await listDocumentRowsByTenant<unknown>(tenantKey), 500);
  if (rowLevelRows.length > 0) return rowLevelRows;

  const legacyRows = await readTenantCollection<unknown>(tenantKey, "documents", () => []);
  const parsedLegacyRows = parseRowsForDomain<T>("documents", ensureArray<T>(legacyRows), 500);
  if (parsedLegacyRows.length > 0) {
    await replaceDocumentRowsByTenant(tenantKey, parsedLegacyRows as Array<T & { id: string }>);
  }
  return parsedLegacyRows;
};

const readGradebookAssignmentRows = async <T>(tenantKey: string): Promise<T[]> => {
  const rowLevelRows = parseRowsForDomain<T>(
    "gradebook-assignments",
    await listGradebookAssignmentRowsByTenant<unknown>(tenantKey),
    500,
  );
  if (rowLevelRows.length > 0) return rowLevelRows;

  const legacyRows = await readTenantCollection<unknown>(tenantKey, "gradebook_assignments", () => []);
  const parsedLegacyRows = parseRowsForDomain<T>("gradebook-assignments", ensureArray<T>(legacyRows), 500);
  if (parsedLegacyRows.length > 0) {
    await replaceGradebookAssignmentRowsByTenant(tenantKey, parsedLegacyRows as Array<T & { id: string }>);
  }
  return parsedLegacyRows;
};

const readGradebookGradeRows = async <T>(tenantKey: string): Promise<T[]> => {
  const rowLevelRows = parseRowsForDomain<T>(
    "gradebook-grades",
    await listGradebookGradeRowsByTenant<unknown>(tenantKey),
    500,
  );
  if (rowLevelRows.length > 0) return rowLevelRows;

  const legacyRows = await readTenantCollection<unknown>(tenantKey, "gradebook_grades", () => []);
  const parsedLegacyRows = parseRowsForDomain<T>("gradebook-grades", ensureArray<T>(legacyRows), 500);
  if (parsedLegacyRows.length > 0) {
    await replaceGradebookGradeRowsByTenant(tenantKey, parsedLegacyRows as Array<T & { id: string }>);
  }
  return parsedLegacyRows;
};

const readReferralRows = async <T>(tenantKey: string): Promise<T[]> => {
  const rowLevelRows = parseRowsForDomain<T>("referrals", await listReferralRowsByTenant<unknown>(tenantKey), 500);
  if (rowLevelRows.length > 0) return rowLevelRows;

  const legacyRows = await readTenantCollection<unknown>(tenantKey, "referrals", () => []);
  const parsedLegacyRows = parseRowsForDomain<T>("referrals", ensureArray<T>(legacyRows), 500);
  if (parsedLegacyRows.length > 0) {
    await replaceReferralRowsByTenant(tenantKey, parsedLegacyRows as Array<T & { id: string }>);
  }
  return parsedLegacyRows;
};

export const listDomainRows = async <T>(session: SessionContext, domain: DataDomain): Promise<T[]> => {
  const tenantKey = toTenantKey(session.activeContext);
  if (isCalendarDomain(domain)) {
    return readCalendarRows<T>(tenantKey);
  }
  if (isInterventionDomain(domain)) {
    return readInterventionRows<T>(tenantKey);
  }
  if (isDocumentDomain(domain)) {
    return readDocumentRows<T>(tenantKey);
  }
  if (isGradebookAssignmentDomain(domain)) {
    return readGradebookAssignmentRows<T>(tenantKey);
  }
  if (isGradebookGradeDomain(domain)) {
    return readGradebookGradeRows<T>(tenantKey);
  }
  if (isMessageDomain(domain)) {
    return readMessageRows<T>(tenantKey);
  }
  if (isNotificationDomain(domain)) {
    return readNotificationRows<T>(tenantKey);
  }
  if (isReferralDomain(domain)) {
    return readReferralRows<T>(tenantKey);
  }
  const rows = await readTenantCollection<T>(tenantKey, toPersistedDomain(domain), () => []);
  return parseRowsForDomain<T>(domain, ensureArray<T>(rows), 500);
};

export const replaceDomainRows = async <T>(session: SessionContext, domain: DataDomain, rows: T[]): Promise<T[]> => {
  const tenantKey = toTenantKey(session.activeContext);
  const next = parseRowsForDomain<T>(domain, ensureArray<T>(rows));
  if (isCalendarDomain(domain)) {
    await replaceCalendarRowsByTenant(tenantKey, next as Array<T & { id: string }>);
    if (next.length === 0) {
      await writeTenantCollection(tenantKey, "calendar", []);
    }
    return next;
  }
  if (isInterventionDomain(domain)) {
    await replaceInterventionRowsByTenant(tenantKey, next as Array<T & { id: string }>);
    if (next.length === 0) {
      await writeTenantCollection(tenantKey, "interventions", []);
    }
    return next;
  }
  if (isDocumentDomain(domain)) {
    await replaceDocumentRowsByTenant(tenantKey, next as Array<T & { id: string }>);
    if (next.length === 0) {
      await writeTenantCollection(tenantKey, "documents", []);
    }
    return next;
  }
  if (isGradebookAssignmentDomain(domain)) {
    await replaceGradebookAssignmentRowsByTenant(tenantKey, next as Array<T & { id: string }>);
    if (next.length === 0) {
      await writeTenantCollection(tenantKey, "gradebook_assignments", []);
    }
    return next;
  }
  if (isGradebookGradeDomain(domain)) {
    await replaceGradebookGradeRowsByTenant(tenantKey, next as Array<T & { id: string }>);
    if (next.length === 0) {
      await writeTenantCollection(tenantKey, "gradebook_grades", []);
    }
    return next;
  }
  if (isMessageDomain(domain)) {
    await replaceMessageRowsByTenant(tenantKey, next as Array<T & { id: string }>);
    if (next.length === 0) {
      await writeTenantCollection(tenantKey, "messages", []);
    }
    return next;
  }
  if (isNotificationDomain(domain)) {
    await replaceNotificationRowsByTenant(tenantKey, next as Array<T & { id: string }>);
    if (next.length === 0) {
      await writeTenantCollection(tenantKey, "notifications", []);
    }
    return next;
  }
  if (isReferralDomain(domain)) {
    await replaceReferralRowsByTenant(tenantKey, next as Array<T & { id: string }>);
    if (next.length === 0) {
      await writeTenantCollection(tenantKey, "referrals", []);
    }
    return next;
  }
  await writeTenantCollection<T>(tenantKey, toPersistedDomain(domain), next);
  return next;
};

export const createDomainRow = async <T extends object>(
  session: SessionContext,
  domain: DataDomain,
  row: T
): Promise<T> => {
  const sourceRow = row as Record<string, unknown>;
  const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...sourceRow, id: ensureId(sourceRow) });
  if (isCalendarDomain(domain)) {
    await upsertCalendarRowByTenant(toTenantKey(session.activeContext), nextRow as Record<string, unknown> & { id: string }, -Date.now());
    return nextRow as unknown as T;
  }
  if (isInterventionDomain(domain)) {
    await upsertInterventionRowByTenant(toTenantKey(session.activeContext), nextRow as Record<string, unknown> & { id: string }, -Date.now());
    return nextRow as unknown as T;
  }
  if (isDocumentDomain(domain)) {
    await upsertDocumentRowByTenant(toTenantKey(session.activeContext), nextRow as Record<string, unknown> & { id: string }, -Date.now());
    return nextRow as unknown as T;
  }
  if (isGradebookAssignmentDomain(domain)) {
    await upsertGradebookAssignmentRowByTenant(
      toTenantKey(session.activeContext),
      nextRow as Record<string, unknown> & { id: string },
      -Date.now(),
    );
    return nextRow as unknown as T;
  }
  if (isGradebookGradeDomain(domain)) {
    await upsertGradebookGradeRowByTenant(
      toTenantKey(session.activeContext),
      nextRow as Record<string, unknown> & { id: string },
      -Date.now(),
    );
    return nextRow as unknown as T;
  }
  if (isMessageDomain(domain)) {
    await upsertMessageRowByTenant(toTenantKey(session.activeContext), nextRow as Record<string, unknown> & { id: string }, -Date.now());
    return nextRow as unknown as T;
  }
  if (isNotificationDomain(domain)) {
    await upsertNotificationRowByTenant(toTenantKey(session.activeContext), nextRow as Record<string, unknown> & { id: string }, -Date.now());
    return nextRow as unknown as T;
  }
  if (isReferralDomain(domain)) {
    await upsertReferralRowByTenant(toTenantKey(session.activeContext), nextRow as Record<string, unknown> & { id: string }, -Date.now());
    return nextRow as unknown as T;
  }
  const rows = await listDomainRows<Record<string, unknown>>(session, domain);
  const nextRows = [nextRow, ...rows];
  await replaceDomainRows(session, domain, nextRows);
  return nextRow as unknown as T;
};

export const updateDomainRow = async <T extends object>(
  session: SessionContext,
  domain: DataDomain,
  id: string,
  patch: Partial<T>
): Promise<T | null> => {
  const tenantKey = toTenantKey(session.activeContext);
  if (isCalendarDomain(domain)) {
    const rows = await readCalendarRows<Record<string, unknown>>(tenantKey);
    const current = rows.find((row) => row.id === id);
    if (!current) return null;
    const currentRecord = asRecord(current);
    const patchRecord = asRecord(patch);
    if (!currentRecord) return null;
    if (!patchRecord) {
      throw new CollectionStoreError("Patch payload must be an object.");
    }
    const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...currentRecord, ...patchRecord, id });
    await upsertCalendarRowByTenant(tenantKey, nextRow as Record<string, unknown> & { id: string });
    return nextRow as unknown as T;
  }
  if (isInterventionDomain(domain)) {
    const rows = await readInterventionRows<Record<string, unknown>>(tenantKey);
    const current = rows.find((row) => row.id === id);
    if (!current) return null;
    const currentRecord = asRecord(current);
    const patchRecord = asRecord(patch);
    if (!currentRecord) return null;
    if (!patchRecord) {
      throw new CollectionStoreError("Patch payload must be an object.");
    }
    const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...currentRecord, ...patchRecord, id });
    await upsertInterventionRowByTenant(tenantKey, nextRow as Record<string, unknown> & { id: string });
    return nextRow as unknown as T;
  }
  if (isDocumentDomain(domain)) {
    const rows = await readDocumentRows<Record<string, unknown>>(tenantKey);
    const current = rows.find((row) => row.id === id);
    if (!current) return null;
    const currentRecord = asRecord(current);
    const patchRecord = asRecord(patch);
    if (!currentRecord) return null;
    if (!patchRecord) {
      throw new CollectionStoreError("Patch payload must be an object.");
    }
    const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...currentRecord, ...patchRecord, id });
    await upsertDocumentRowByTenant(tenantKey, nextRow as Record<string, unknown> & { id: string });
    return nextRow as unknown as T;
  }
  if (isGradebookAssignmentDomain(domain)) {
    const rows = await readGradebookAssignmentRows<Record<string, unknown>>(tenantKey);
    const current = rows.find((row) => row.id === id);
    if (!current) return null;
    const currentRecord = asRecord(current);
    const patchRecord = asRecord(patch);
    if (!currentRecord) return null;
    if (!patchRecord) {
      throw new CollectionStoreError("Patch payload must be an object.");
    }
    const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...currentRecord, ...patchRecord, id });
    await upsertGradebookAssignmentRowByTenant(tenantKey, nextRow as Record<string, unknown> & { id: string });
    return nextRow as unknown as T;
  }
  if (isGradebookGradeDomain(domain)) {
    const rows = await readGradebookGradeRows<Record<string, unknown>>(tenantKey);
    const current = rows.find((row) => row.id === id);
    if (!current) return null;
    const currentRecord = asRecord(current);
    const patchRecord = asRecord(patch);
    if (!currentRecord) return null;
    if (!patchRecord) {
      throw new CollectionStoreError("Patch payload must be an object.");
    }
    const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...currentRecord, ...patchRecord, id });
    await upsertGradebookGradeRowByTenant(tenantKey, nextRow as Record<string, unknown> & { id: string });
    return nextRow as unknown as T;
  }
  if (isMessageDomain(domain)) {
    const rows = await readMessageRows<Record<string, unknown>>(tenantKey);
    const current = rows.find((row) => row.id === id);
    if (!current) return null;
    const currentRecord = asRecord(current);
    const patchRecord = asRecord(patch);
    if (!currentRecord) return null;
    if (!patchRecord) {
      throw new CollectionStoreError("Patch payload must be an object.");
    }
    const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...currentRecord, ...patchRecord, id });
    await upsertMessageRowByTenant(tenantKey, nextRow as Record<string, unknown> & { id: string });
    return nextRow as unknown as T;
  }
  if (isNotificationDomain(domain)) {
    const rows = await readNotificationRows<Record<string, unknown>>(tenantKey);
    const current = rows.find((row) => row.id === id);
    if (!current) return null;
    const currentRecord = asRecord(current);
    const patchRecord = asRecord(patch);
    if (!currentRecord) return null;
    if (!patchRecord) {
      throw new CollectionStoreError("Patch payload must be an object.");
    }
    const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...currentRecord, ...patchRecord, id });
    await upsertNotificationRowByTenant(tenantKey, nextRow as Record<string, unknown> & { id: string });
    return nextRow as unknown as T;
  }
  if (isReferralDomain(domain)) {
    const rows = await readReferralRows<Record<string, unknown>>(tenantKey);
    const current = rows.find((row) => row.id === id);
    if (!current) return null;
    const currentRecord = asRecord(current);
    const patchRecord = asRecord(patch);
    if (!currentRecord) return null;
    if (!patchRecord) {
      throw new CollectionStoreError("Patch payload must be an object.");
    }
    const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...currentRecord, ...patchRecord, id });
    await upsertReferralRowByTenant(tenantKey, nextRow as Record<string, unknown> & { id: string });
    return nextRow as unknown as T;
  }

  const rows = await listDomainRows<Record<string, unknown>>(session, domain);
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return null;
  const current = asRecord(rows[index]);
  if (!current) return null;
  const patchRecord = asRecord(patch);
  if (!patchRecord) {
    throw new CollectionStoreError("Patch payload must be an object.");
  }
  const nextRow = parseRowForDomain<Record<string, unknown>>(domain, { ...current, ...patchRecord, id });
  const nextRows = [...rows];
  nextRows[index] = nextRow;
  await replaceDomainRows(session, domain, nextRows);
  return nextRow as unknown as T;
};

export const deleteDomainRow = async <T extends object>(
  session: SessionContext,
  domain: DataDomain,
  id: string
): Promise<T | null> => {
  const tenantKey = toTenantKey(session.activeContext);
  if (isCalendarDomain(domain)) {
    const rows = await readCalendarRows<Record<string, unknown>>(tenantKey);
    const target = rows.find((row) => row.id === id);
    if (!target) return null;
    const nextRows = rows.filter((row) => row.id !== id);
    await deleteCalendarRowByTenant(tenantKey, id);
    if (nextRows.length === 0) {
      await writeTenantCollection(tenantKey, "calendar", []);
    }
    return target as unknown as T;
  }
  if (isInterventionDomain(domain)) {
    const rows = await readInterventionRows<Record<string, unknown>>(tenantKey);
    const target = rows.find((row) => row.id === id);
    if (!target) return null;
    const nextRows = rows.filter((row) => row.id !== id);
    await deleteInterventionRowByTenant(tenantKey, id);
    if (nextRows.length === 0) {
      await writeTenantCollection(tenantKey, "interventions", []);
    }
    return target as unknown as T;
  }
  if (isDocumentDomain(domain)) {
    const rows = await readDocumentRows<Record<string, unknown>>(tenantKey);
    const target = rows.find((row) => row.id === id);
    if (!target) return null;
    const nextRows = rows.filter((row) => row.id !== id);
    await deleteDocumentRowByTenant(tenantKey, id);
    if (nextRows.length === 0) {
      await writeTenantCollection(tenantKey, "documents", []);
    }
    return target as unknown as T;
  }
  if (isGradebookAssignmentDomain(domain)) {
    const rows = await readGradebookAssignmentRows<Record<string, unknown>>(tenantKey);
    const target = rows.find((row) => row.id === id);
    if (!target) return null;
    const nextRows = rows.filter((row) => row.id !== id);
    await deleteGradebookAssignmentRowByTenant(tenantKey, id);
    if (nextRows.length === 0) {
      await writeTenantCollection(tenantKey, "gradebook_assignments", []);
    }
    return target as unknown as T;
  }
  if (isGradebookGradeDomain(domain)) {
    const rows = await readGradebookGradeRows<Record<string, unknown>>(tenantKey);
    const target = rows.find((row) => row.id === id);
    if (!target) return null;
    const nextRows = rows.filter((row) => row.id !== id);
    await deleteGradebookGradeRowByTenant(tenantKey, id);
    if (nextRows.length === 0) {
      await writeTenantCollection(tenantKey, "gradebook_grades", []);
    }
    return target as unknown as T;
  }
  if (isMessageDomain(domain)) {
    const rows = await readMessageRows<Record<string, unknown>>(tenantKey);
    const target = rows.find((row) => row.id === id);
    if (!target) return null;
    const nextRows = rows.filter((row) => row.id !== id);
    await deleteMessageRowByTenant(tenantKey, id);
    if (nextRows.length === 0) {
      await writeTenantCollection(tenantKey, "messages", []);
    }
    return target as unknown as T;
  }
  if (isNotificationDomain(domain)) {
    const rows = await readNotificationRows<Record<string, unknown>>(tenantKey);
    const target = rows.find((row) => row.id === id);
    if (!target) return null;
    const nextRows = rows.filter((row) => row.id !== id);
    await deleteNotificationRowByTenant(tenantKey, id);
    if (nextRows.length === 0) {
      await writeTenantCollection(tenantKey, "notifications", []);
    }
    return target as unknown as T;
  }
  if (isReferralDomain(domain)) {
    const rows = await readReferralRows<Record<string, unknown>>(tenantKey);
    const target = rows.find((row) => row.id === id);
    if (!target) return null;
    const nextRows = rows.filter((row) => row.id !== id);
    await deleteReferralRowByTenant(tenantKey, id);
    if (nextRows.length === 0) {
      await writeTenantCollection(tenantKey, "referrals", []);
    }
    return target as unknown as T;
  }

  const rows = await listDomainRows<Record<string, unknown>>(session, domain);
  const target = rows.find((row) => row.id === id);
  if (!target) return null;
  const nextRows = rows.filter((row) => row.id !== id);
  await replaceDomainRows(session, domain, nextRows);
  return target as unknown as T;
};
