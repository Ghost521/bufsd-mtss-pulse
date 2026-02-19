import { readTenantCollection, writeTenantCollection, toTenantKey } from "./persistence";
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

export const listDomainRows = async <T>(session: SessionContext, domain: DataDomain): Promise<T[]> => {
  const tenantKey = toTenantKey(session.activeContext);
  const rows = await readTenantCollection<T>(tenantKey, toPersistedDomain(domain), () => []);
  return parseRowsForDomain<T>(domain, ensureArray<T>(rows), 500);
};

export const replaceDomainRows = async <T>(session: SessionContext, domain: DataDomain, rows: T[]): Promise<T[]> => {
  const tenantKey = toTenantKey(session.activeContext);
  const next = parseRowsForDomain<T>(domain, ensureArray<T>(rows));
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
  const rows = await listDomainRows<Record<string, unknown>>(session, domain);
  const target = rows.find((row) => row.id === id);
  if (!target) return null;
  const nextRows = rows.filter((row) => row.id !== id);
  await replaceDomainRows(session, domain, nextRows);
  return target as unknown as T;
};
