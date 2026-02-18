import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookieHeaders, LAST_ACTIVITY_COOKIE } from "../../../lib/server/auth-context";
import { clearCookie, parseCookieHeader } from "../../../lib/server/cookies";
import {
  WORKOS_OAUTH_STATE_COOKIE,
  WORKOS_RETURN_TO_COOKIE,
  WORKOS_SESSION_COOKIE,
  createWorkOSLogoutUrl,
  isWorkOSEnabled,
} from "../../../lib/server/workos";

const COOKIE_SECURE = process.env.NODE_ENV === "production";

const sanitizeReturnTo = (value: string | null): string => {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));
        const cookies = parseCookieHeader(request.headers.get("cookie"));
        const sealedSession = cookies[WORKOS_SESSION_COOKIE] ?? "";

        const headers = new Headers();
        const sessionHeaders = clearSessionCookieHeaders();
        sessionHeaders.forEach((value, key) => headers.append(key, value));
        headers.append(
          "Set-Cookie",
          clearCookie(WORKOS_SESSION_COOKIE, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: COOKIE_SECURE,
          })
        );
        headers.append(
          "Set-Cookie",
          clearCookie(WORKOS_OAUTH_STATE_COOKIE, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: COOKIE_SECURE,
          })
        );
        headers.append(
          "Set-Cookie",
          clearCookie(WORKOS_RETURN_TO_COOKIE, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: COOKIE_SECURE,
          })
        );
        headers.append(
          "Set-Cookie",
          clearCookie(LAST_ACTIVITY_COOKIE, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: COOKIE_SECURE,
          })
        );

        const providerLogout =
          sealedSession && isWorkOSEnabled() ? await createWorkOSLogoutUrl(sealedSession).catch(() => null) : null;
        headers.set("Location", providerLogout ?? returnTo);
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
