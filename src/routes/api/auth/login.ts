import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookieHeaders, LAST_ACTIVITY_COOKIE } from "../../../lib/server/auth-context";
import { clearCookie, serializeCookie } from "../../../lib/server/cookies";
import {
  WORKOS_OAUTH_STATE_COOKIE,
  WORKOS_RETURN_TO_COOKIE,
  WORKOS_SESSION_COOKIE,
  createWorkOSLoginUrl,
  getWorkOSConfigSummary,
  isWorkOSEnabled,
} from "../../../lib/server/workos";

const COOKIE_SECURE = process.env.NODE_ENV === "production";
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

const sanitizeReturnTo = (value: string | null): string => {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};

const isForcedReauth = (value: string | null): boolean => value === "1";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isWorkOSEnabled()) {
          return Response.json(
            {
              ok: false,
              error: "WorkOS auth is not configured on this server.",
              config: getWorkOSConfigSummary(),
            },
            { status: 503 }
          );
        }

        const url = new URL(request.url);
        const state = crypto.randomUUID();
        const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
        const forceReauth = isForcedReauth(url.searchParams.get("reauth"));
        const loginUrl = createWorkOSLoginUrl(state, request.url, { forcePromptLogin: forceReauth });

        if (!loginUrl) {
          return Response.json({ ok: false, error: "Failed to initialize WorkOS login URL." }, { status: 500 });
        }

        const headers = new Headers();
        headers.set("Location", loginUrl);
        if (forceReauth) {
          const localSessionHeaders = clearSessionCookieHeaders();
          localSessionHeaders.forEach(([key, value]) => headers.append(key, value));
          headers.append(
            "Set-Cookie",
            clearCookie(LAST_ACTIVITY_COOKIE, {
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
              secure: COOKIE_SECURE,
            })
          );
          headers.append(
            "Set-Cookie",
            clearCookie(WORKOS_SESSION_COOKIE, {
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
              secure: COOKIE_SECURE,
            })
          );
        }
        headers.append(
          "Set-Cookie",
          serializeCookie(WORKOS_OAUTH_STATE_COOKIE, state, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: COOKIE_SECURE,
            maxAge: OAUTH_STATE_TTL_SECONDS,
          })
        );
        headers.append(
          "Set-Cookie",
          serializeCookie(WORKOS_RETURN_TO_COOKIE, returnTo, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: COOKIE_SECURE,
            maxAge: OAUTH_STATE_TTL_SECONDS,
          })
        );
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
