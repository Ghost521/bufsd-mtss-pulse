import {
  canUserAccessContext,
  findUserByEmail,
  findUserById,
  getAccessibleContextsForMemberships,
  getUserGroups,
  getUserMemberships,
  normalizeContext,
} from "./tenant-store";
import { clearCookie, parseCookieHeader, serializeCookie } from "./cookies";
import { authenticateSealedWorkOSSession, isWorkOSEnabled, WORKOS_SESSION_COOKIE } from "./workos";
import type { SessionContext, TenantContext } from "./tenant-types";

export const USER_COOKIE = "mtss_user";
export const CONTEXT_COOKIE = "mtss_ctx";
const DEFAULT_USER_ID = "u-principal-ne";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const COOKIE_SECURE = process.env.NODE_ENV === "production";
const ALLOW_IMPERSONATION = process.env.MTSS_ALLOW_IMPERSONATION === "true";

const parseTenantContext = (value: string | null | undefined): TenantContext | null => {
  if (!value) return null;
  try {
    const decoded = JSON.parse(value) as TenantContext;
    return normalizeContext(decoded);
  } catch {
    return null;
  }
};

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

export const buildSessionForUser = (userId: string, requestedContext: TenantContext | null = null): SessionContext | null =>
  buildSession(userId, requestedContext);

const resolveUserIdFromWorkOS = async (request: Request): Promise<string | null> => {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const sealedSession = cookies[WORKOS_SESSION_COOKIE];
  if (!sealedSession) return null;

  const auth = await authenticateSealedWorkOSSession(sealedSession).catch(() => null);
  if (!auth?.authenticated || !auth.user?.email) return null;

  const mapped = findUserByEmail(auth.user.email);
  return mapped?.id ?? null;
};

export const canSwitchUsersInSession = (): boolean => !isWorkOSEnabled() || ALLOW_IMPERSONATION;

export const getSessionFromRequest = async (request: Request): Promise<SessionContext | null> => {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const requestedContext = parseTenantContext(request.headers.get("x-mtss-context") ?? cookies[CONTEXT_COOKIE]);

  const userId = isWorkOSEnabled()
    ? await resolveUserIdFromWorkOS(request)
    : request.headers.get("x-mtss-user-id") || cookies[USER_COOKIE] || DEFAULT_USER_ID;

  if (!userId) return null;
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
  headers.append(
    "Set-Cookie",
    serializeCookie(USER_COOKIE, input.userId, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: COOKIE_SECURE,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })
  );
  headers.append(
    "Set-Cookie",
    serializeCookie(CONTEXT_COOKIE, JSON.stringify(input.context), {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: COOKIE_SECURE,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })
  );
  return headers;
};

export const clearSessionCookieHeaders = (): Headers => {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    clearCookie(USER_COOKIE, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: COOKIE_SECURE,
    })
  );
  headers.append(
    "Set-Cookie",
    clearCookie(CONTEXT_COOKIE, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: COOKIE_SECURE,
    })
  );
  return headers;
};

export const resolveSessionChange = async (
  request: Request,
  body: unknown
): Promise<{ session: SessionContext; headers: Headers } | { error: string; status: number }> => {
  const current = await getSessionFromRequest(request);
  if (!current) return { error: "Session unavailable.", status: 401 };

  const input = (body && typeof body === "object" ? body : {}) as {
    userId?: string;
    context?: TenantContext;
  };

  if (typeof input.userId === "string" && input.userId.trim().length > 0 && input.userId.trim() !== current.user.id && !canSwitchUsersInSession()) {
    return { error: "User switching is disabled for external auth sessions.", status: 403 };
  }

  const userId =
    typeof input.userId === "string" && input.userId.trim().length > 0 && canSwitchUsersInSession()
      ? input.userId.trim()
      : current.user.id;
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
