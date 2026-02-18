import { WorkOS } from "@workos-inc/node";

const DEFAULT_BASE_URL = "http://localhost:3000";

export const WORKOS_SESSION_COOKIE = "mtss_workos_session";
export const WORKOS_OAUTH_STATE_COOKIE = "mtss_workos_state";
export const WORKOS_RETURN_TO_COOKIE = "mtss_workos_return_to";
type CreateWorkOSLoginUrlOptions = {
  forcePromptLogin?: boolean;
};

const WORKOS_API_KEY = process.env.WORKOS_API_KEY ?? "";
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID ?? "";
const WORKOS_COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD ?? "";
const WORKOS_PROVIDER = process.env.WORKOS_PROVIDER ?? "authkit";
const WORKOS_CONNECTION_ID = process.env.WORKOS_CONNECTION_ID ?? "";
const APP_BASE_URL = process.env.APP_BASE_URL ?? DEFAULT_BASE_URL;
const WORKOS_REDIRECT_URI = process.env.WORKOS_REDIRECT_URI ?? "";

const WORKOS_ENABLED = Boolean(WORKOS_API_KEY && WORKOS_CLIENT_ID && WORKOS_COOKIE_PASSWORD);

let workos: WorkOS | null = null;

const getClient = (): WorkOS | null => {
  if (!WORKOS_ENABLED) return null;
  if (workos) return workos;
  workos = new WorkOS(WORKOS_API_KEY, {
    clientId: WORKOS_CLIENT_ID,
  });
  return workos;
};

export const isWorkOSEnabled = (): boolean => WORKOS_ENABLED;

export const getWorkOSConfigSummary = () => ({
  enabled: WORKOS_ENABLED,
  provider: WORKOS_PROVIDER,
  redirectUri: WORKOS_REDIRECT_URI || `${APP_BASE_URL}/api/auth/callback`,
  redirectUriMode: WORKOS_REDIRECT_URI ? "env" : "derived",
  hasClientId: Boolean(WORKOS_CLIENT_ID),
  hasApiKey: Boolean(WORKOS_API_KEY),
  hasCookiePassword: Boolean(WORKOS_COOKIE_PASSWORD),
});

const deriveRedirectUri = (requestUrl?: string): string => {
  if (WORKOS_REDIRECT_URI) return WORKOS_REDIRECT_URI;
  if (!requestUrl) return `${APP_BASE_URL}/api/auth/callback`;

  try {
    const origin = new URL(requestUrl).origin;
    return `${origin}/api/auth/callback`;
  } catch {
    return `${APP_BASE_URL}/api/auth/callback`;
  }
};

export const createWorkOSLoginUrl = (
  state: string,
  requestUrl?: string,
  options: CreateWorkOSLoginUrlOptions = {}
): string | null => {
  const client = getClient();
  if (!client) return null;
  const redirectUri = deriveRedirectUri(requestUrl);
  const prompt = options.forcePromptLogin ? "login" : undefined;

  const url = client.userManagement.getAuthorizationUrl({
    provider: WORKOS_PROVIDER,
    clientId: WORKOS_CLIENT_ID,
    redirectUri,
    state,
    ...(prompt ? { prompt } : {}),
    ...(WORKOS_CONNECTION_ID ? { connectionId: WORKOS_CONNECTION_ID } : {}),
  });
  return url;
};

export const authenticateWorkOSCode = async (code: string) => {
  const client = getClient();
  if (!client) return null;

  return client.userManagement.authenticateWithCode({
    code,
    clientId: WORKOS_CLIENT_ID,
    session: {
      sealSession: true,
      cookiePassword: WORKOS_COOKIE_PASSWORD,
    },
  });
};

export const authenticateSealedWorkOSSession = async (sessionData: string) => {
  const client = getClient();
  if (!client) return null;

  return client.userManagement.authenticateWithSessionCookie({
    sessionData,
    cookiePassword: WORKOS_COOKIE_PASSWORD,
  });
};

export const createWorkOSLogoutUrl = async (sealedSession: string, returnTo?: string): Promise<string | null> => {
  const client = getClient();
  if (!client) return null;

  const auth = await client.userManagement.authenticateWithSessionCookie({
    sessionData: sealedSession,
    cookiePassword: WORKOS_COOKIE_PASSWORD,
  });

  if (!auth.authenticated) return null;

  return client.userManagement.getLogoutUrl({
    sessionId: auth.sessionId,
    returnTo: returnTo ?? APP_BASE_URL,
  });
};
