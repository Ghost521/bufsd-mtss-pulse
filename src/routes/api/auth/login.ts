import { createFileRoute } from "@tanstack/react-router";
import { serializeCookie } from "../../../lib/server/cookies";
import {
  WORKOS_OAUTH_STATE_COOKIE,
  WORKOS_RETURN_TO_COOKIE,
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
        const loginUrl = createWorkOSLoginUrl(state, request.url);

        if (!loginUrl) {
          return Response.json({ ok: false, error: "Failed to initialize WorkOS login URL." }, { status: 500 });
        }

        const headers = new Headers();
        headers.set("Location", loginUrl);
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
