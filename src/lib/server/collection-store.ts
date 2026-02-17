import { readTenantCollection, writeTenantCollection, toTenantKey } from "./persistence";
import type { SessionContext } from "./tenant-types";

export type DataDomain = "calendar" | "messages" | "documents" | "interventions" | "lesson-plans" | "imports" | "settings";

type PersistedDomain = "calendar" | "messages" | "documents" | "interventions" | "lesson_plans" | "imports" | "settings";

const toPersistedDomain = (domain: DataDomain): PersistedDomain => {
  if (domain === "lesson-plans") return "lesson_plans";
  return domain;
};

const ensureArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const ensureId = (row: Record<string, unknown>): string => {
  if (typeof row.id === "string" && row.id.trim().length > 0) return row.id;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const listDomainRows = async <T>(session: SessionContext, domain: DataDomain): Promise<T[]> => {
  const tenantKey = toTenantKey(session.activeContext);
  const rows = await readTenantCollection<T>(tenantKey, toPersistedDomain(domain), () => []);
  return ensureArray<T>(rows);
};

export const replaceDomainRows = async <T>(session: SessionContext, domain: DataDomain, rows: T[]): Promise<T[]> => {
  const tenantKey = toTenantKey(session.activeContext);
  const next = ensureArray<T>(rows);
  await writeTenantCollection<T>(tenantKey, toPersistedDomain(domain), next);
  return next;
};

export const createDomainRow = async <T extends object>(
  session: SessionContext,
  domain: DataDomain,
  row: T
): Promise<T> => {
  const rows = await listDomainRows<Record<string, unknown>>(session, domain);
  const sourceRow = row as Record<string, unknown>;
  const nextRow = { ...sourceRow, id: ensureId(sourceRow) };
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
  const nextRow = { ...current, ...(patch as Record<string, unknown>), id };
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
