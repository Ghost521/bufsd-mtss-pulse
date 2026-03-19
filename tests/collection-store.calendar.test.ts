import { describe, expect, it } from "vitest";
import { AttendanceStatus, EventType, UserRole } from "../src/types";
import {
  createDomainRow,
  deleteDomainRow,
  listDomainRows,
  replaceDomainRows,
  updateDomainRow,
} from "../src/lib/server/collection-store";
import { toTenantKey, writeTenantCollection } from "../src/lib/server/persistence";
import type { SessionContext } from "../src/lib/server/tenant-types";

const makeSession = (seed: string): SessionContext => ({
  user: {
    id: `user-${seed}`,
    name: "Test User",
    email: `test-${seed}@example.com`,
    primaryRole: "principal",
  },
  memberships: [],
  groups: [],
  activeContext: {
    organizationId: `org-${seed}`,
    districtId: `district-${seed}`,
    schoolId: `school-${seed}`,
  },
  effectiveRoles: ["principal"],
});

const makeCalendarEvent = (id: string, title: string) => ({
  id,
  title,
  description: `${title} description`,
  type: EventType.MTSS,
  start: "2026-03-10T14:00:00.000Z",
  end: "2026-03-10T14:45:00.000Z",
  timezone: "America/New_York",
  location: "Conference Room",
  organizer: "Rosa Cortese",
  attendees: [
    {
      name: "Rosa Cortese",
      role: UserRole.PRINCIPAL,
      status: AttendanceStatus.ORGANIZER,
    },
  ],
  attachments: [],
});

type CalendarRow = ReturnType<typeof makeCalendarEvent>;

describe("collection-store calendar", () => {
  it("preserves replace ordering through the row-level calendar store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeCalendarEvent("evt-2", "Second Event"),
      makeCalendarEvent("evt-1", "First Event"),
    ];

    await replaceDomainRows(session, "calendar", rows);

    const listed = await listDomainRows<CalendarRow>(session, "calendar");
    expect(listed.map((row) => row.id)).toEqual(["evt-2", "evt-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeCalendarEvent("evt-legacy", "Legacy Event");

    await writeTenantCollection(tenantKey, "calendar", [legacyRow]);

    const imported = await listDomainRows<CalendarRow>(session, "calendar");
    expect(imported.map((row) => row.id)).toEqual(["evt-legacy"]);

    const deleted = await deleteDomainRow<CalendarRow>(session, "calendar", "evt-legacy");
    expect(deleted?.id).toBe("evt-legacy");

    const listedAfterDelete = await listDomainRows<CalendarRow>(session, "calendar");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<CalendarRow>(session, "calendar", makeCalendarEvent("temp", "Casey Meeting"));
    const updated = await updateDomainRow<CalendarRow>(session, "calendar", created.id, {
      location: "Updated Room",
      title: "Updated Meeting",
    });

    const listed = await listDomainRows<CalendarRow>(session, "calendar");

    expect(updated?.location).toBe("Updated Room");
    expect(updated?.title).toBe("Updated Meeting");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
