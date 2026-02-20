import { UserRole } from "../types";

type HealthPayload = {
  auth?: {
    signedIn?: boolean;
    workosEnabled?: boolean;
    reason?: string;
  };
  session?: {
    user?: {
      id?: string;
      primaryRole?: string;
    };
    effectiveRoles?: string[];
  } | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type RouteAuthStatus = {
  signedIn: boolean;
  workosEnabled: boolean;
  reason: string | null;
  userId: string | null;
  primaryRole: string | null;
  effectiveRoles: string[];
};

const UNAUTHORIZED_STATUS: RouteAuthStatus = {
  signedIn: false,
  workosEnabled: false,
  reason: null,
  userId: null,
  primaryRole: null,
  effectiveRoles: [],
};

const BYPASS_QUERY_KEY = "bypassAuth";
const BYPASS_QUERY_VALUE = "1";

const DEV_ROLE_SWITCHING_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_SIDEBAR_TEST_CONTROLS === "true";

export const DEV_ROLE_OVERRIDE_STORAGE_KEY = "mtss.dev.roleOverride";

const isUserRole = (value: unknown): value is UserRole =>
  value === UserRole.PRINCIPAL ||
  value === UserRole.TEACHER ||
  value === UserRole.DISTRICT ||
  value === UserRole.PARENT;

const resolveStorage = (storage?: StorageLike | null): StorageLike | null => {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const dedupeRoles = (roles: UserRole[]): UserRole[] => {
  const deduped: UserRole[] = [];
  for (const role of roles) {
    if (!deduped.includes(role)) deduped.push(role);
  }
  return deduped;
};

export const mapSessionRoleToUserRole = (role: string | null | undefined): UserRole | null => {
  if (role === "principal" || role === "school_admin") return UserRole.PRINCIPAL;
  if (role === "teacher") return UserRole.TEACHER;
  if (role === "district_admin" || role === "org_admin") return UserRole.DISTRICT;
  if (role === "parent") return UserRole.PARENT;
  return null;
};

export const getAvailableUserRoles = (
  auth: Pick<RouteAuthStatus, "primaryRole" | "effectiveRoles">
): UserRole[] => {
  const mappedPrimary = mapSessionRoleToUserRole(auth.primaryRole);
  const mappedEffective = auth.effectiveRoles
    .map((role) => mapSessionRoleToUserRole(role))
    .filter((role): role is UserRole => role !== null);

  if (!mappedPrimary) return dedupeRoles(mappedEffective);
  return dedupeRoles([mappedPrimary, ...mappedEffective]);
};

export const getDevRoleOverrideFromStorage = (storage?: StorageLike | null): UserRole | null => {
  if (!DEV_ROLE_SWITCHING_ENABLED) return null;
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return null;

  try {
    const value = resolvedStorage.getItem(DEV_ROLE_OVERRIDE_STORAGE_KEY);
    if (!isUserRole(value)) return null;
    return value;
  } catch {
    return null;
  }
};

export const setDevRoleOverrideInStorage = (role: UserRole | null, storage?: StorageLike | null): void => {
  if (!DEV_ROLE_SWITCHING_ENABLED) return;
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) return;

  try {
    if (role === null) {
      resolvedStorage.removeItem(DEV_ROLE_OVERRIDE_STORAGE_KEY);
      return;
    }
    resolvedStorage.setItem(DEV_ROLE_OVERRIDE_STORAGE_KEY, role);
  } catch {
    // Ignore local storage write errors in restricted browsing contexts.
  }
};

export const clearDevRoleOverrideInStorage = (storage?: StorageLike | null): void => {
  setDevRoleOverrideInStorage(null, storage);
};

export const resolveRouteUserRole = (
  auth: Pick<RouteAuthStatus, "signedIn" | "primaryRole" | "effectiveRoles">,
  options?: { devRoleOverride?: UserRole | null }
): UserRole | null => {
  if (!auth.signedIn) return null;
  const availableRoles = getAvailableUserRoles(auth);
  if (availableRoles.length === 0) return null;

  const override = options?.devRoleOverride ?? null;
  if (override && availableRoles.includes(override)) {
    return override;
  }

  const primaryRole = mapSessionRoleToUserRole(auth.primaryRole);
  if (primaryRole && availableRoles.includes(primaryRole)) {
    return primaryRole;
  }

  return availableRoles[0];
};

export const shouldBypassRouteAuth = (href: string): boolean => {
  // Playwright-only bypass. Never allow in production builds.
  if (!import.meta.env.DEV) return false;
  if (!href) return false;

  try {
    const url = href.startsWith("http") ? new URL(href) : new URL(href, "http://localhost");
    return url.searchParams.get(BYPASS_QUERY_KEY) === BYPASS_QUERY_VALUE;
  } catch {
    return false;
  }
};

export const getRouteAuthStatus = async (
  fetchImpl: typeof fetch = fetch
): Promise<RouteAuthStatus> => {
  try {
    const response = await fetchImpl("/api/health", {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) return UNAUTHORIZED_STATUS;

    const payload = (await response.json()) as HealthPayload;
    return {
      signedIn: Boolean(payload?.auth?.signedIn),
      workosEnabled: Boolean(payload?.auth?.workosEnabled),
      reason: typeof payload?.auth?.reason === "string" ? payload.auth.reason : null,
      userId: typeof payload?.session?.user?.id === "string" ? payload.session.user.id : null,
      primaryRole: typeof payload?.session?.user?.primaryRole === "string" ? payload.session.user.primaryRole : null,
      effectiveRoles: Array.isArray(payload?.session?.effectiveRoles)
        ? payload.session.effectiveRoles.filter((role): role is string => typeof role === "string")
        : [],
    };
  } catch {
    return UNAUTHORIZED_STATUS;
  }
};

export const buildLoginRedirectHref = (returnTo: string, forceReauth = false): string => {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo || "/app");
  if (forceReauth) {
    params.set("reauth", "1");
  }
  return `/api/auth/login?${params.toString()}`;
};
