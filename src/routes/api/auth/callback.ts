import { createFileRoute } from "@tanstack/react-router";
import { buildSessionForUser, createSessionCookieHeaders } from "../../../lib/server/auth-context";
import { clearCookie, parseCookieHeader, serializeCookie } from "../../../lib/server/cookies";
import { findUserByEmail } from "../../../lib/server/tenant-store";
import {
  WORKOS_OAUTH_STATE_COOKIE,
  WORKOS_RETURN_TO_COOKIE,
  WORKOS_SESSION_COOKIE,
  authenticateWorkOSCode,
  isWorkOSEnabled,
} from "../../../lib/server/workos";

const COOKIE_SECURE = process.env.NODE_ENV === "production";
const WORKOS_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const sanitizeReturnTo = (value: string | null): string => {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isWorkOSEnabled()) {
          return Response.json({ ok: false, error: "WorkOS auth is not configured on this server." }, { status: 503 });
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
        if (providerError) {
          return Response.json({ ok: false, error: providerError }, { status: 400 });
        }

        const cookies = parseCookieHeader(request.headers.get("cookie"));
        const expectedState = cookies[WORKOS_OAUTH_STATE_COOKIE] ?? null;
        const returnTo = sanitizeReturnTo(cookies[WORKOS_RETURN_TO_COOKIE] ?? "/");
        if (!code || !state || !expectedState || state !== expectedState) {
          return Response.json({ ok: false, error: "Invalid OAuth state or code." }, { status: 400 });
        }

        const auth = await authenticateWorkOSCode(code).catch(() => null);
        if (!auth?.user?.email || !auth.sealedSession) {
          return Response.json({ ok: false, error: "WorkOS authentication failed." }, { status: 401 });
        }

        const mappedUser = findUserByEmail(auth.user.email);
        if (!mappedUser) {
          return Response.json(
            {
              ok: false,
              error: `No local tenant user mapping found for ${auth.user.email}.`,
            },
            { status: 403 }
          );
        }

        const session = buildSessionForUser(mappedUser.id);
        if (!session) {
          return Response.json({ ok: false, error: "Mapped user has no active tenant memberships." }, { status: 403 });
        }

        const headers = new Headers();
        headers.set("Location", returnTo);
        headers.append(
          "Set-Cookie",
          serializeCookie(WORKOS_SESSION_COOKIE, auth.sealedSession, {
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: COOKIE_SECURE,
            maxAge: WORKOS_SESSION_TTL_SECONDS,
          })
        );

        const localSessionHeaders = createSessionCookieHeaders({
          userId: session.user.id,
          context: session.activeContext,
        });
        localSessionHeaders.forEach((value, key) => headers.append(key, value));

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

        return new Response(null, { status: 302, headers });
      },
    },
  },
});
