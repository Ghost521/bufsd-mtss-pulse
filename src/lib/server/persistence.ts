import type { TenantContext } from "./tenant-types";

type TenantDomain =
  | "dashboard"
  | "documents"
  | "messages"
  | "calendar"
  | "interventions"
  | "lesson_plans"
  | "imports"
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

const FN_GET_COLLECTION = process.env.CONVEX_FN_GET_COLLECTION ?? "phase3:getTenantCollection";
const FN_SET_COLLECTION = process.env.CONVEX_FN_SET_COLLECTION ?? "phase3:setTenantCollection";
const FN_APPEND_AUDIT = process.env.CONVEX_FN_APPEND_AUDIT ?? "phase3:appendAuditEntry";
const FN_COUNT_AUDIT = process.env.CONVEX_FN_COUNT_AUDIT ?? "phase3:countAuditEntries";

const localCollections = new Map<string, unknown[]>();
const localAuditByTenant = new Map<string, unknown[]>();

let lastConvexError: string | null = null;

export const toTenantKey = (context: TenantContext): string =>
  `${context.organizationId}::${context.districtId ?? "district"}::${context.schoolId ?? "all-schools"}`;

const getCollectionKey = (tenantKey: string, domain: TenantDomain): string => `${domain}::${tenantKey}`;

const isConvexEnabled = (): boolean => CONVEX_USE_BACKEND && Boolean(CONVEX_CLOUD_URL);

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

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
  const cached = localCollections.get(collectionKey);
  if (cached) return structuredClone(cached as T[]);

  if (isConvexEnabled()) {
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
    }
  }

  const seeded = seedFactory();
  localCollections.set(collectionKey, structuredClone(seeded) as unknown[]);
  return structuredClone(seeded);
}

export async function writeTenantCollection<T>(tenantKey: string, domain: TenantDomain, rows: T[]): Promise<void> {
  localCollections.set(getCollectionKey(tenantKey, domain), structuredClone(rows) as unknown[]);
  if (!isConvexEnabled()) return;

  try {
    await convexCall("mutation", FN_SET_COLLECTION, { tenantKey, domain, rows });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
  }
}

export async function appendAuditEntryByTenant(tenantKey: string, entry: unknown): Promise<void> {
  const existing = localAuditByTenant.get(tenantKey) ?? [];
  localAuditByTenant.set(tenantKey, [...existing, entry]);
  if (!isConvexEnabled()) return;

  try {
    await convexCall("mutation", FN_APPEND_AUDIT, { tenantKey, entry });
    lastConvexError = null;
  } catch (error) {
    lastConvexError = getErrorMessage(error);
  }
}

export async function countAuditEntriesByTenant(tenantKey: string): Promise<number> {
  if (isConvexEnabled()) {
    try {
      const count = await convexCall<number>("query", FN_COUNT_AUDIT, { tenantKey });
      lastConvexError = null;
      return count;
    } catch (error) {
      lastConvexError = getErrorMessage(error);
    }
  }

  return (localAuditByTenant.get(tenantKey) ?? []).length;
}

export function getPersistenceDiagnostics() {
  return {
    mode: isConvexEnabled() ? "convex" : "memory",
    convexCloudUrl: CONVEX_CLOUD_URL || null,
    convexActionsUrl: CONVEX_ACTIONS_URL || null,
    lastConvexError,
  };
}
