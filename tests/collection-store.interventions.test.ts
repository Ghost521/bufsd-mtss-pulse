import { describe, expect, it } from "vitest";
import { Tier } from "../src/types";
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

const makeIntervention = (id: string, studentName: string) => ({
  id,
  studentName,
  firstName: studentName.split(" ")[0] ?? studentName,
  lastName: studentName.split(" ").slice(1).join(" ") || "Student",
  grade: "4",
  teacher: "Mr. Davis",
  tier: Tier.TIER_2,
  focusArea: "Reading",
  planName: `${studentName} Reading Plan`,
  startDate: "2026-03-01",
  durationWeeks: 6,
  progress: 25,
  attendance: 96,
  status: "At Risk" as const,
  avatarSeed: studentName.replace(/\s+/g, ""),
});

type InterventionRow = ReturnType<typeof makeIntervention>;

describe("collection-store interventions", () => {
  it("preserves replace ordering through the row-level intervention store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeIntervention("int-2", "Jordan Lee"),
      makeIntervention("int-1", "Avery Stone"),
    ];

    await replaceDomainRows(session, "interventions", rows);

    const listed = await listDomainRows<InterventionRow>(session, "interventions");
    expect(listed.map((row) => row.id)).toEqual(["int-2", "int-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeIntervention("int-legacy", "Legacy Student");

    await writeTenantCollection(tenantKey, "interventions", [legacyRow]);

    const imported = await listDomainRows<InterventionRow>(session, "interventions");
    expect(imported.map((row) => row.id)).toEqual(["int-legacy"]);

    const deleted = await deleteDomainRow<InterventionRow>(session, "interventions", "int-legacy");
    expect(deleted?.id).toBe("int-legacy");

    const listedAfterDelete = await listDomainRows<InterventionRow>(session, "interventions");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<InterventionRow>(session, "interventions", makeIntervention("temp", "Casey Brown"));
    const updated = await updateDomainRow<InterventionRow>(session, "interventions", created.id, {
      progress: 60,
      status: "On Track" as InterventionRow["status"],
    });

    const listed = await listDomainRows<InterventionRow>(session, "interventions");

    expect(updated?.progress).toBe(60);
    expect(updated?.status).toBe("On Track");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
