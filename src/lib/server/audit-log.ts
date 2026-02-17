import { appendAuditEntryByTenant, countAuditEntriesByTenant, toTenantKey } from "./persistence";
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

const auditLogStore: AuditLogEntry[] = [];

const newAuditId = (): string => `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
export const newRequestId = (): string => `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export const writeAuditLog = (entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry => {
  const record: AuditLogEntry = {
    ...entry,
    id: newAuditId(),
    timestamp: new Date().toISOString(),
  };

  auditLogStore.unshift(record);
  void appendAuditEntryByTenant(toTenantKey(entry.context), record);
  return { ...record };
};

export const listAuditLogs = (): AuditLogEntry[] => auditLogStore.map((entry) => ({ ...entry }));

export const getAuditCount = async (context: TenantContext): Promise<number> =>
  countAuditEntriesByTenant(toTenantKey(context));
