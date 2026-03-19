import {
  deleteReferralRowByTenant,
  deleteInterventionRowByTenant,
  listReferralRowsByTenant,
  listInterventionRowsByTenant,
  readTenantCollection,
  replaceReferralRowsByTenant,
  replaceInterventionRowsByTenant,
  toTenantKey,
  upsertReferralRowByTenant,
  upsertInterventionRowByTenant,
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
const isInterventionDomain = (domain: DataDomain): boolean => domain === "interventions";
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
  if (isInterventionDomain(domain)) {
    return readInterventionRows<T>(tenantKey);
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
  if (isInterventionDomain(domain)) {
    await replaceInterventionRowsByTenant(tenantKey, next as Array<T & { id: string }>);
    if (next.length === 0) {
      await writeTenantCollection(tenantKey, "interventions", []);
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
  if (isInterventionDomain(domain)) {
    await upsertInterventionRowByTenant(toTenantKey(session.activeContext), nextRow as Record<string, unknown> & { id: string }, -Date.now());
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
