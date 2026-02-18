import { describe, expect, it } from "vitest";
import { buildLoginRedirectHref, getRouteAuthStatus, shouldBypassRouteAuth } from "../src/lib/route-auth";

const asFetch = (impl: () => Promise<Response>): typeof fetch =>
  impl as unknown as typeof fetch;

describe("route auth helpers", () => {
  it("returns signed-in auth status from health payload", async () => {
    const status = await getRouteAuthStatus(
      asFetch(async () =>
        new Response(
          JSON.stringify({
            auth: {
              signedIn: true,
              workosEnabled: true,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    expect(status).toEqual({
      signedIn: true,
      workosEnabled: true,
    });
  });

  it("treats health failures as unauthorized", async () => {
    const nonOk = await getRouteAuthStatus(asFetch(async () => new Response("nope", { status: 500 })));
    const thrown = await getRouteAuthStatus(
      asFetch(async () => {
        throw new Error("network");
      })
    );

    expect(nonOk).toEqual({ signedIn: false, workosEnabled: false });
    expect(thrown).toEqual({ signedIn: false, workosEnabled: false });
  });

  it("preserves workos mode for signed-out sessions", async () => {
    const status = await getRouteAuthStatus(
      asFetch(async () =>
        new Response(
          JSON.stringify({
            auth: {
              signedIn: false,
              workosEnabled: true,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    expect(status).toEqual({
      signedIn: false,
      workosEnabled: true,
    });
  });

  it("builds encoded login redirect urls", () => {
    const href = buildLoginRedirectHref("/app/calendar?filter=open&day=2026-02-18");
    expect(href).toBe("/api/auth/login?returnTo=%2Fapp%2Fcalendar%3Ffilter%3Dopen%26day%3D2026-02-18");
  });

  it("enables bypass only when explicitly requested in dev", () => {
    expect(shouldBypassRouteAuth("/app/class-roster")).toBe(false);
    expect(shouldBypassRouteAuth("/app/class-roster?bypassAuth=0")).toBe(false);
    expect(shouldBypassRouteAuth("/app/class-roster?bypassAuth=1")).toBe(import.meta.env.DEV);
  });
});
