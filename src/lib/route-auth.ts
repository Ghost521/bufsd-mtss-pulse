type HealthPayload = {
  auth?: {
    signedIn?: boolean;
    workosEnabled?: boolean;
  };
};

export type RouteAuthStatus = {
  signedIn: boolean;
  workosEnabled: boolean;
};

const UNAUTHORIZED_STATUS: RouteAuthStatus = {
  signedIn: false,
  workosEnabled: false,
};

const BYPASS_QUERY_KEY = "bypassAuth";
const BYPASS_QUERY_VALUE = "1";

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
    };
  } catch {
    return UNAUTHORIZED_STATUS;
  }
};

export const buildLoginRedirectHref = (returnTo: string): string =>
  `/api/auth/login?returnTo=${encodeURIComponent(returnTo || "/app")}`;
