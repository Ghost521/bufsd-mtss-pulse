import { createFileRoute } from "@tanstack/react-router";
import { newRequestId } from "../../lib/server/audit-log";
import {
  appendActivityCookie,
  getSessionAuthFailureReason,
  getSessionFromRequest,
} from "../../lib/server/auth-context";
import { logApiResponse } from "../../lib/server/request-logging";
import { requirePermission } from "../../lib/server/rbac";
import { geocodeAddress } from "../../lib/server/geocoding";
import { getDistricts, getMemberships, getSchools, getUsers } from "../../lib/server/tenant-store";
import type { SchoolRecord, SessionContext } from "../../lib/server/tenant-types";

type SchoolLevel = "Elementary" | "Middle" | "High";

type SchoolSummaryRow = {
  id: string;
  districtId: string;
  name: string;
  type: SchoolLevel;
  principalName: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

const schoolTypeFromName = (name: string): SchoolLevel => {
  const value = name.toLowerCase();
  if (value.includes("high")) return "High";
  if (value.includes("middle")) return "Middle";
  return "Elementary";
};

const buildAddressLabel = (school: SchoolRecord): string | null => {
  const parts = [school.addressLine1, school.city, school.state, school.postalCode]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (parts.length === 0) return null;
  return parts.join(", ");
};

const resolveScopedSchools = (session: SessionContext): SchoolRecord[] => {
  const schools = getSchools();
  const context = session.activeContext;
  if (context.schoolId) {
    return schools.filter((school) => school.id === context.schoolId);
  }
  if (context.districtId) {
    return schools.filter((school) => school.districtId === context.districtId);
  }

  const districts = getDistricts();
  const orgDistrictIds = new Set(
    districts.filter((district) => district.organizationId === context.organizationId).map((district) => district.id)
  );
  return schools.filter((school) => orgDistrictIds.has(school.districtId));
};

const buildPrincipalMap = (): Map<string, string> => {
  const users = new Map(getUsers().map((user) => [user.id, user.name]));
  const candidates = getMemberships().filter(
    (membership) =>
      membership.status === "active" &&
      membership.scopeType === "school" &&
      (membership.role === "principal" || membership.role === "school_admin")
  );

  const bySchool = new Map<string, { roleWeight: number; name: string }>();
  for (const membership of candidates) {
    const principalName = users.get(membership.userId) ?? membership.userId;
    const roleWeight = membership.role === "principal" ? 0 : 1;
    const existing = bySchool.get(membership.scopeId);
    if (!existing || roleWeight < existing.roleWeight || principalName.localeCompare(existing.name) < 0) {
      bySchool.set(membership.scopeId, { roleWeight, name: principalName });
    }
  }

  const principalMap = new Map<string, string>();
  bySchool.forEach((value, schoolId) => {
    principalMap.set(schoolId, value.name);
  });
  return principalMap;
};

const fillCoordinates = async (school: SchoolRecord): Promise<{ latitude: number | null; longitude: number | null }> => {
  const latitude = Number(school.latitude);
  const longitude = Number(school.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  const address = buildAddressLabel(school);
  if (!address) return { latitude: null, longitude: null };
  const geocoded = await geocodeAddress(address);
  if (!geocoded) return { latitude: null, longitude: null };
  return geocoded;
};

export const Route = createFileRoute("/api/schools")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const startedAt = Date.now();
        const session = await getSessionFromRequest(request);

        const response = await (async () => {
          if (!session) {
            const reason = getSessionAuthFailureReason(request);
            return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
          }

          const permission = requirePermission(session, { resource: "dashboard", action: "read" });
          if (!permission.ok) {
            return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
          }

          const scopedSchools = resolveScopedSchools(session);
          const principals = buildPrincipalMap();
          const rows: SchoolSummaryRow[] = [];
          for (const school of scopedSchools) {
            const coordinates = await fillCoordinates(school);
            rows.push({
              id: school.id,
              districtId: school.districtId,
              name: school.name,
              type: schoolTypeFromName(school.name),
              principalName: principals.get(school.id) ?? "No principal assigned",
              addressLine1: school.addressLine1 ?? null,
              city: school.city ?? null,
              state: school.state ?? null,
              postalCode: school.postalCode ?? null,
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
            });
          }

          rows.sort((left, right) => left.name.localeCompare(right.name));
          return appendActivityCookie(
            Response.json({
              ok: true,
              rows,
              total: rows.length,
              requestId,
            })
          );
        })();

        return logApiResponse({
          request,
          requestId,
          route: "/api/schools",
          startedAt,
          response,
          session,
        });
      },
    },
  },
});
