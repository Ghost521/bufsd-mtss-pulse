import {
  canUserAccessContext,
  ensureTenantStoreHydrated,
  findUserByEmail,
  findUserById,
  getAccessibleContextsForMemberships,
  getUserGroups,
  getUserMemberships,
  normalizeContext,
  provisionUserFromWorkOSEmail,
} from "./tenant-store";
import { clearCookie, parseCookieHeader, serializeCookie } from "./cookies";
import { authenticateSealedWorkOSSession, isWorkOSEnabled, WORKOS_SESSION_COOKIE } from "./workos";
import type { SessionContext, TenantContext } from "./tenant-types";

export const USER_COOKIE = "mtss_user";
export const CONTEXT_COOKIE = "mtss_ctx";
export const LAST_ACTIVITY_COOKIE = "mtss_last_activity";
export const IDLE_TIMEOUT_SECONDS = 60 * 30;
const DEFAULT_USER_ID = "u-principal-ne";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const COOKIE_SECURE = process.env.NODE_ENV === "production";
const ALLOW_IMPERSONATION = process.env.MTSS_ALLOW_IMPERSONATION === "true";
const DEV_AUTH_BYPASS_ENABLED = process.env.MTSS_ENABLE_DEV_AUTH_BYPASS === "true";
const IDLE_TIMEOUT_MILLISECONDS = IDLE_TIMEOUT_SECONDS * 1000;
const BYPASS_AUTH_QUERY_KEY = "bypassAuth";
const BYPASS_AUTH_QUERY_VALUE = "1";
type SessionAuthFailureReason = "IDLE_TIMEOUT";
const sessionFailureReasonByRequest = new WeakMap<Request, SessionAuthFailureReason | null>();

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

  const availableContexts = getAccessibleContextsForMemberships(memberships);
  if (availableContexts.length === 0) return null;

  const activeContext =
    requestedContext && canUserAccessContext(requestedContext, memberships)
      ? requestedContext
      : availableContexts[0];

  const contextMemberships = memberships
    .filter((membership) => canUserAccessContext(activeContext, [membership]))
  const groups = getUserGroups(contextMemberships);
  const effectiveRoles = contextMemberships.map((membership) => membership.role);

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
  if (mapped) return mapped.id;

  const fullName = [auth.user.firstName, auth.user.lastName].filter((part): part is string => Boolean(part && part.trim())).join(" ");
  const provisioned = await provisionUserFromWorkOSEmail({
    email: auth.user.email,
    name: fullName || null,
  });
  return provisioned.user?.id ?? null;
};

export const canSwitchUsersInSession = (): boolean => !isWorkOSEnabled() || ALLOW_IMPERSONATION;
export const isDevAuthBypassEnabled = (): boolean => process.env.NODE_ENV !== "production" && DEV_AUTH_BYPASS_ENABLED;

export const getSessionAuthFailureReason = (request: Request): SessionAuthFailureReason | null =>
  sessionFailureReasonByRequest.get(request) ?? null;

const setSessionAuthFailureReason = (request: Request, reason: SessionAuthFailureReason | null): void => {
  sessionFailureReasonByRequest.set(request, reason);
};

export const isSessionIdleExpired = (lastActivity: string | null, now: Date = new Date()): boolean => {
  if (!lastActivity) return true;
  const timestamp = Number(lastActivity);
  if (!Number.isFinite(timestamp)) return true;
  const elapsed = now.getTime() - timestamp;
  return elapsed >= IDLE_TIMEOUT_MILLISECONDS;
};

export const createActivityCookieHeaders = (now: Date = new Date()): Array<[string, string]> => {
  return [
    [
      "Set-Cookie",
      serializeCookie(LAST_ACTIVITY_COOKIE, `${now.getTime()}`, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: COOKIE_SECURE,
        maxAge: IDLE_TIMEOUT_SECONDS,
      }),
    ],
  ];
};

export const appendActivityCookie = (response: Response, now: Date = new Date()): Response => {
  const headers = createActivityCookieHeaders(now);
  headers.forEach(([key, value]) => response.headers.append(key, value));
  return response;
};

const hasDevBypassFlag = (value: string | null | undefined): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value, "http://localhost");
    return url.searchParams.get(BYPASS_AUTH_QUERY_KEY) === BYPASS_AUTH_QUERY_VALUE;
  } catch {
    return false;
  }
};

const shouldBypassApiAuth = (request: Request): boolean => {
  if (!isDevAuthBypassEnabled()) return false;
  if (request.headers.get("x-mtss-bypass-auth") === BYPASS_AUTH_QUERY_VALUE) return true;
  if (hasDevBypassFlag(request.url)) return true;
  return hasDevBypassFlag(request.headers.get("referer"));
};

export const getSessionFromRequest = async (request: Request): Promise<SessionContext | null> => {
  await ensureTenantStoreHydrated();
  setSessionAuthFailureReason(request, null);
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const requestedContext = parseTenantContext(request.headers.get("x-mtss-context") ?? cookies[CONTEXT_COOKIE]);
  const sealedSession = cookies[WORKOS_SESSION_COOKIE] ?? null;

  if (shouldBypassApiAuth(request)) {
    const bypassUserId = request.headers.get("x-mtss-user-id") || cookies[USER_COOKIE] || DEFAULT_USER_ID;
    return buildSession(bypassUserId, requestedContext) ?? buildSession(DEFAULT_USER_ID, requestedContext);
  }

  if (isWorkOSEnabled() && sealedSession && isSessionIdleExpired(cookies[LAST_ACTIVITY_COOKIE] ?? null)) {
    setSessionAuthFailureReason(request, "IDLE_TIMEOUT");
    return null;
  }

  const userId = isWorkOSEnabled()
    ? await resolveUserIdFromWorkOS(request)
    : cookies[USER_COOKIE] || DEFAULT_USER_ID;

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
}): Array<[string, string]> => {
  const headers: Array<[string, string]> = [];
  headers.push([
    "Set-Cookie",
    serializeCookie(USER_COOKIE, input.userId, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: COOKIE_SECURE,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    }),
  ]);
  headers.push([
    "Set-Cookie",
    serializeCookie(CONTEXT_COOKIE, JSON.stringify(input.context), {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: COOKIE_SECURE,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    }),
  ]);
  const activityHeaders = createActivityCookieHeaders();
  activityHeaders.forEach(([key, value]) => headers.push([key, value]));
  return headers;
};

export const clearSessionCookieHeaders = (): Array<[string, string]> => {
  const headers: Array<[string, string]> = [];
  headers.push([
    "Set-Cookie",
    clearCookie(USER_COOKIE, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: COOKIE_SECURE,
    }),
  ]);
  headers.push([
    "Set-Cookie",
    clearCookie(CONTEXT_COOKIE, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: COOKIE_SECURE,
    }),
  ]);
  return headers;
};

export const resolveSessionChange = async (
  request: Request,
  body: unknown
): Promise<{ session: SessionContext; headers: Array<[string, string]> } | { error: string; status: number }> => {
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
