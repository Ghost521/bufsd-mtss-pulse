import {
  canUserAccessContext,
  findUserById,
  getAccessibleContextsForMemberships,
  getUserGroups,
  getUserMemberships,
  normalizeContext,
} from "./tenant-store";
import type { SessionContext, TenantContext } from "./tenant-types";

const USER_COOKIE = "mtss_user";
const CONTEXT_COOKIE = "mtss_ctx";
const DEFAULT_USER_ID = "u-principal-ne";

const parseCookieHeader = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, item) => {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
};

const parseTenantContext = (value: string | null | undefined): TenantContext | null => {
  if (!value) return null;
  try {
    const decoded = JSON.parse(value) as TenantContext;
    return normalizeContext(decoded);
  } catch {
    return null;
  }
};

const serializeCookie = (name: string, value: string): string =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;

const contextKey = (context: TenantContext): string => `${context.organizationId}:${context.districtId ?? ""}:${context.schoolId ?? ""}`;

const buildSession = (userId: string, requestedContext: TenantContext | null): SessionContext | null => {
  const user = findUserById(userId);
  if (!user) return null;
  const memberships = getUserMemberships(userId);
  if (memberships.length === 0) return null;
  const groups = getUserGroups(memberships);

  const availableContexts = getAccessibleContextsForMemberships(memberships);
  if (availableContexts.length === 0) return null;

  const activeContext =
    requestedContext && canUserAccessContext(requestedContext, memberships)
      ? requestedContext
      : availableContexts[0];

  const effectiveRoles = memberships
    .filter((membership) => canUserAccessContext(activeContext, [membership]))
    .map((membership) => membership.role);

  return {
    user,
    memberships,
    groups,
    activeContext,
    effectiveRoles,
  };
};

export const getSessionFromRequest = (request: Request): SessionContext | null => {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const headerUserId = request.headers.get("x-mtss-user-id");
  const userId = headerUserId || cookies[USER_COOKIE] || DEFAULT_USER_ID;
  const requestedContext = parseTenantContext(request.headers.get("x-mtss-context") ?? cookies[CONTEXT_COOKIE]);
  return buildSession(userId, requestedContext);
};

export const getSessionSummary = (session: SessionContext | null) => {
  if (!session) return null;
  const availableContexts = getAccessibleContextsForMemberships(session.memberships);
  return {
    user: session.user,
    effectiveRoles: [...session.effectiveRoles],
    activeContext: session.activeContext,
    availableContexts,
    memberships: session.memberships,
  };
};

export const createSessionCookieHeaders = (input: {
  userId: string;
  context: TenantContext;
}): Headers => {
  const headers = new Headers();
  headers.append("Set-Cookie", serializeCookie(USER_COOKIE, input.userId));
  headers.append("Set-Cookie", serializeCookie(CONTEXT_COOKIE, JSON.stringify(input.context)));
  return headers;
};

export const resolveSessionChange = (request: Request, body: unknown): { session: SessionContext; headers: Headers } | { error: string; status: number } => {
  const current = getSessionFromRequest(request);
  if (!current) return { error: "Session unavailable.", status: 401 };

  const input = (body && typeof body === "object" ? body : {}) as {
    userId?: string;
    context?: TenantContext;
  };

  const userId = typeof input.userId === "string" && input.userId.trim().length > 0 ? input.userId.trim() : current.user.id;
  const normalizedContext = input.context ? normalizeContext(input.context) : current.activeContext;
  if (!normalizedContext) return { error: "Invalid context payload.", status: 400 };

  const next = buildSession(userId, normalizedContext);
  if (!next) return { error: "Cannot resolve target session.", status: 403 };

  const headers = createSessionCookieHeaders({
    userId: next.user.id,
    context: next.activeContext,
  });

  return { session: next, headers };
};

export const ensureContextMembership = (session: SessionContext, context: TenantContext): boolean => {
  const normalized = normalizeContext(context);
  if (!normalized) return false;
  const target = contextKey(normalized);
  const allowed = getAccessibleContextsForMemberships(session.memberships).some((candidate) => contextKey(candidate) === target);
  return allowed;
};
