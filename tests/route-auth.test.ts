import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLoginRedirectHref,
  clearRouteAuthStatusCache,
  getAvailableUserRoles,
  getRouteAuthStatus,
  mapSessionRoleToUserRole,
  resolveRouteUserRole,
  shouldBypassRouteAuth,
} from "../src/lib/route-auth";
import { UserRole } from "../src/types";

const asFetch = (impl: () => Promise<Response>): typeof fetch =>
  impl as unknown as typeof fetch;

afterEach(() => {
  clearRouteAuthStatusCache();
  vi.unstubAllGlobals();
});

describe("route auth helpers", () => {
  it("returns signed-in auth status from health payload", async () => {
    const status = await getRouteAuthStatus(
      asFetch(async () =>
        new Response(
          JSON.stringify({
            session: {
              user: {
                id: "u-principal-ne",
                primaryRole: "principal",
              },
              effectiveRoles: ["principal", "teacher"],
            },
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
      reason: null,
      userId: "u-principal-ne",
      primaryRole: "principal",
      effectiveRoles: ["principal", "teacher"],
    });
  });

  it("treats health failures as unauthorized", async () => {
    const nonOk = await getRouteAuthStatus(asFetch(async () => new Response("nope", { status: 500 })));
    const thrown = await getRouteAuthStatus(
      asFetch(async () => {
        throw new Error("network");
      })
    );

    expect(nonOk).toEqual({
      signedIn: false,
      workosEnabled: false,
      reason: null,
      userId: null,
      primaryRole: null,
      effectiveRoles: [],
    });
    expect(thrown).toEqual({
      signedIn: false,
      workosEnabled: false,
      reason: null,
      userId: null,
      primaryRole: null,
      effectiveRoles: [],
    });
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
      reason: null,
      userId: null,
      primaryRole: null,
      effectiveRoles: [],
    });
  });

  it("returns idle-timeout reason when health reports it", async () => {
    const status = await getRouteAuthStatus(
      asFetch(async () =>
        new Response(
          JSON.stringify({
            auth: {
              signedIn: false,
              workosEnabled: true,
              reason: "IDLE_TIMEOUT",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    expect(status).toEqual({
      signedIn: false,
      workosEnabled: true,
      reason: "IDLE_TIMEOUT",
      userId: null,
      primaryRole: null,
      effectiveRoles: [],
    });
  });

  it("dedupes repeated client-side auth checks for the same fetch implementation", async () => {
    vi.stubGlobal("window", {} as Window & typeof globalThis);

    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          auth: {
            signedIn: true,
            workosEnabled: true,
          },
          session: {
            user: {
              id: "u-principal-ne",
              primaryRole: "principal",
            },
            effectiveRoles: ["principal"],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const fetchImpl = fetchSpy as unknown as typeof fetch;
    const [first, second] = await Promise.all([
      getRouteAuthStatus(fetchImpl),
      getRouteAuthStatus(fetchImpl),
    ]);

    expect(first).toEqual(second);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("maps session roles to UserRole values", () => {
    expect(mapSessionRoleToUserRole("principal")).toBe(UserRole.PRINCIPAL);
    expect(mapSessionRoleToUserRole("teacher")).toBe(UserRole.TEACHER);
    expect(mapSessionRoleToUserRole("district_admin")).toBe(UserRole.DISTRICT);
    expect(mapSessionRoleToUserRole("parent")).toBe(UserRole.PARENT);
    expect(mapSessionRoleToUserRole("unknown")).toBeNull();
  });

  it("derives deduped available roles from primary and effective role keys", () => {
    const roles = getAvailableUserRoles({
      primaryRole: "teacher",
      effectiveRoles: ["teacher", "principal", "teacher"],
    });

    expect(roles).toEqual([UserRole.TEACHER, UserRole.PRINCIPAL]);
  });

  it("resolves route role using primary role by default", () => {
    const resolved = resolveRouteUserRole({
      signedIn: true,
      primaryRole: "principal",
      effectiveRoles: ["teacher", "principal"],
    });

    expect(resolved).toBe(UserRole.PRINCIPAL);
  });

  it("resolves route role using valid dev override", () => {
    const resolved = resolveRouteUserRole(
      {
        signedIn: true,
        primaryRole: "principal",
        effectiveRoles: ["principal", "teacher"],
      },
      { devRoleOverride: UserRole.TEACHER }
    );

    expect(resolved).toBe(UserRole.TEACHER);
  });

  it("builds encoded login redirect urls", () => {
    const href = buildLoginRedirectHref("/app/calendar?filter=open&day=2026-02-18");
    expect(href).toBe("/api/auth/login?returnTo=%2Fapp%2Fcalendar%3Ffilter%3Dopen%26day%3D2026-02-18");
  });

  it("builds login redirect urls with explicit reauth flag", () => {
    const href = buildLoginRedirectHref("/app", true);
    expect(href).toBe("/api/auth/login?returnTo=%2Fapp&reauth=1");
  });

  it("enables bypass only when explicitly requested in dev", () => {
    expect(shouldBypassRouteAuth("/app/class-roster")).toBe(false);
    expect(shouldBypassRouteAuth("/app/class-roster?bypassAuth=0")).toBe(false);
    expect(shouldBypassRouteAuth("/app/class-roster?bypassAuth=1")).toBe(import.meta.env.DEV);
  });
});
