import {
  DEFAULT_DISTRICT_BRANDING,
  districtBrandingEditableSchema,
  districtBrandingRecordSchema,
  type DistrictBrandingRecord,
} from "../schemas/branding";
import { readTenantCollection, toTenantKey, writeTenantCollection } from "./persistence";
import type { RoleKey, SessionContext } from "./tenant-types";

const BRANDING_DOMAIN = "branding" as const;
const BRANDING_RECORD_ID = "branding::district-default";

export class BrandingStoreError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "BrandingStoreError";
    this.status = status;
  }
}

export const isBrandingManageAllowedForRoles = (roles: RoleKey[]): boolean =>
  roles.includes("org_admin") || roles.includes("district_admin");

const toDistrictBrandingTenantKey = (session: SessionContext): string =>
  toTenantKey({
    organizationId: session.activeContext.organizationId,
    districtId: session.activeContext.districtId,
    schoolId: undefined,
  });

const createDefaultBrandingRecord = (session: SessionContext): DistrictBrandingRecord => ({
  id: BRANDING_RECORD_ID,
  version: 1,
  organizationId: session.activeContext.organizationId,
  districtId: session.activeContext.districtId ?? null,
  mascotName: DEFAULT_DISTRICT_BRANDING.mascotName,
  logoUrl: DEFAULT_DISTRICT_BRANDING.logoUrl,
  colors: DEFAULT_DISTRICT_BRANDING.colors,
  updatedAt: new Date().toISOString(),
  updatedBy: session.user.id,
});

const readBrandingRows = async (session: SessionContext): Promise<DistrictBrandingRecord[]> => {
  const tenantKey = toDistrictBrandingTenantKey(session);
  const rows = await readTenantCollection<DistrictBrandingRecord>(tenantKey, BRANDING_DOMAIN, () => []);
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => districtBrandingRecordSchema.safeParse(row))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data);
};

const writeBrandingRows = async (session: SessionContext, rows: DistrictBrandingRecord[]): Promise<void> => {
  const tenantKey = toDistrictBrandingTenantKey(session);
  await writeTenantCollection(tenantKey, BRANDING_DOMAIN, rows);
};

export const getOrCreateDistrictBranding = async (session: SessionContext): Promise<DistrictBrandingRecord> => {
  const rows = await readBrandingRows(session);
  const existing = rows.find((row) => row.id === BRANDING_RECORD_ID) ?? rows[0];
  if (existing) return existing;

  const created = createDefaultBrandingRecord(session);
  await writeBrandingRows(session, [created]);
  return created;
};

export const updateDistrictBranding = async (session: SessionContext, data: unknown): Promise<DistrictBrandingRecord> => {
  if (!isBrandingManageAllowedForRoles(session.effectiveRoles)) {
    throw new BrandingStoreError("You do not have permission to update district branding.", 403);
  }

  const parsed = districtBrandingEditableSchema.safeParse(data);
  if (!parsed.success) {
    throw new BrandingStoreError(parsed.error.issues[0]?.message ?? "Invalid branding payload.", 400);
  }

  const rows = await readBrandingRows(session);
  const existing = rows.find((row) => row.id === BRANDING_RECORD_ID) ?? createDefaultBrandingRecord(session);

  const next = districtBrandingRecordSchema.parse({
    ...existing,
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: session.user.id,
  });

  const remaining = rows.filter((row) => row.id !== BRANDING_RECORD_ID);
  await writeBrandingRows(session, [next, ...remaining]);
  return next;
};
