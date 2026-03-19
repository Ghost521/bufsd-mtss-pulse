import {
  appendAuditEntryByTenant,
  countAuditEntriesByTenant,
  listAuditEntriesByTenant,
  toTenantKey,
  type AuditEntryListFilters,
} from "./persistence";
import type { TenantContext } from "./tenant-types";

export type AuditLogEntry = {
  id: string;
  actorUserId: string;
  actorName: string;
  context: TenantContext;
  resourceType: string;
  resourceId: string;
  action: "create" | "update" | "delete" | "read";
  changedFields: string[];
  before: unknown;
  after: unknown;
  requestId: string;
  timestamp: string;
};

const newAuditId = (): string => `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
export const newRequestId = (): string => `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export const writeAuditLog = async (entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<AuditLogEntry> => {
  const record: AuditLogEntry = {
    ...entry,
    id: newAuditId(),
    timestamp: new Date().toISOString(),
  };

  await appendAuditEntryByTenant(toTenantKey(entry.context), record);
  return { ...record };
};

export const listAuditLogs = async (
  context: TenantContext,
  filters: AuditEntryListFilters = {}
): Promise<AuditLogEntry[]> =>
  listAuditEntriesByTenant<AuditLogEntry>(toTenantKey(context), filters);

export const getAuditCount = async (context: TenantContext): Promise<number> =>
  countAuditEntriesByTenant(toTenantKey(context));
