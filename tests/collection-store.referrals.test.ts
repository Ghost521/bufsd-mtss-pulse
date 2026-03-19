import { describe, expect, it } from "vitest";
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

const makeReferral = (id: string, studentName: string) => ({
  id,
  studentId: `student-${id}`,
  studentName,
  grade: "4",
  type: "Academic" as const,
  urgency: "High" as const,
  notes: `${studentName} needs reading support.`,
  attachments: [],
  status: "Pending Review" as const,
  routedTo: "MTSS Team",
  createdAt: "2026-03-01T12:00:00.000Z",
});

type ReferralRow = ReturnType<typeof makeReferral>;

describe("collection-store referrals", () => {
  it("preserves replace ordering through the row-level referral store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeReferral("ref-2", "Jordan Lee"),
      makeReferral("ref-1", "Avery Stone"),
    ];

    await replaceDomainRows(session, "referrals", rows);

    const listed = await listDomainRows<ReferralRow>(session, "referrals");
    expect(listed.map((row) => row.id)).toEqual(["ref-2", "ref-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeReferral("ref-legacy", "Legacy Student");

    await writeTenantCollection(tenantKey, "referrals", [legacyRow]);

    const imported = await listDomainRows<ReferralRow>(session, "referrals");
    expect(imported.map((row) => row.id)).toEqual(["ref-legacy"]);

    const deleted = await deleteDomainRow<ReferralRow>(session, "referrals", "ref-legacy");
    expect(deleted?.id).toBe("ref-legacy");

    const listedAfterDelete = await listDomainRows<ReferralRow>(session, "referrals");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<ReferralRow>(session, "referrals", makeReferral("temp", "Casey Brown"));
    const updated = await updateDomainRow<ReferralRow>(session, "referrals", created.id, {
      notes: "Updated triage note.",
      routedTo: "Student Support Team",
    });

    const listed = await listDomainRows<ReferralRow>(session, "referrals");

    expect(updated?.notes).toBe("Updated triage note.");
    expect(updated?.routedTo).toBe("Student Support Team");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
