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
