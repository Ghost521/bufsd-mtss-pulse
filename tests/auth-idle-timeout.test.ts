import { describe, expect, it } from "vitest";
import {
  IDLE_TIMEOUT_SECONDS,
  LAST_ACTIVITY_COOKIE,
  createActivityCookieHeaders,
  createSessionCookieHeaders,
  isSessionIdleExpired,
} from "../src/lib/server/auth-context";

describe("auth idle timeout", () => {
  it("expires when elapsed inactivity is 30 minutes or more", () => {
    const now = new Date("2026-02-18T12:30:00.000Z");
    const exactlyThirtyMinutesAgo = `${now.getTime() - IDLE_TIMEOUT_SECONDS * 1000}`;
    const thirtyMinutesAndOneMsAgo = `${now.getTime() - IDLE_TIMEOUT_SECONDS * 1000 - 1}`;

    expect(isSessionIdleExpired(exactlyThirtyMinutesAgo, now)).toBe(true);
    expect(isSessionIdleExpired(thirtyMinutesAndOneMsAgo, now)).toBe(true);
  });

  it("stays active when less than 30 minutes have elapsed", () => {
    const now = new Date("2026-02-18T12:30:00.000Z");
    const twentyNineMinutesAgo = `${now.getTime() - (IDLE_TIMEOUT_SECONDS - 60) * 1000}`;

    expect(isSessionIdleExpired(twentyNineMinutesAgo, now)).toBe(false);
  });

  it("treats missing or invalid activity values as expired", () => {
    const now = new Date("2026-02-18T12:30:00.000Z");

    expect(isSessionIdleExpired(null, now)).toBe(true);
    expect(isSessionIdleExpired("invalid", now)).toBe(true);
  });

  it("creates an http-only activity cookie", () => {
    const now = new Date("2026-02-18T12:30:00.000Z");
    const headers = createActivityCookieHeaders(now);
    const value = headers.find(([key]) => key.toLowerCase() === "set-cookie")?.[1];

    expect(value).toContain(`${LAST_ACTIVITY_COOKIE}=${now.getTime()}`);
    expect(value).toContain("HttpOnly");
    expect(value).toContain("SameSite=Lax");
  });

  it("includes activity cookie when creating session cookies", () => {
    const headers = createSessionCookieHeaders({
      userId: "u-principal-ne",
      context: {
        organizationId: "org-bufsd",
        districtId: "district-bufsd",
        schoolId: "school-ne",
      },
    });
    const cookieHeaders = headers
      .filter(([key]) => key.toLowerCase() === "set-cookie")
      .map(([, value]) => value);

    expect(cookieHeaders.some((cookie) => cookie.startsWith(`${LAST_ACTIVITY_COOKIE}=`))).toBe(true);
  });
});
