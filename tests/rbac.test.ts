import { describe, expect, it } from "vitest";
import { checkPermission } from "../src/lib/server/rbac";
import { type SessionContext, type RoleKey } from "../src/lib/server/tenant-types";

const createSession = (role: RoleKey): SessionContext => ({
  user: {
    id: "u-test",
    name: "Test User",
    email: "test@example.org",
    primaryRole: role,
    linkedStudentIds: ["STU-1"],
  },
  memberships: [],
  groups: [],
  activeContext: {
    organizationId: "org-bufsd",
    districtId: "dist-bufsd",
    schoolId: "sch-ne",
  },
  effectiveRoles: [role],
});

describe("rbac permission checks", () => {
  it("allows teacher updates for approved student fields", () => {
    const session = createSession("teacher");
    const result = checkPermission(session, {
      resource: "students",
      action: "update",
      fields: ["attendance"],
    });
    expect(result.allowed).toBe(true);
  });

  it("denies teacher updates for restricted student fields", () => {
    const session = createSession("teacher");
    const result = checkPermission(session, {
      resource: "students",
      action: "update",
      fields: ["name"],
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("FIELD_DENIED");
  });

  it("allows parent read access to student list and linked student records only", () => {
    const session = createSession("parent");
    const listResult = checkPermission(session, {
      resource: "students",
      action: "read",
    });
    const linkedStudentResult = checkPermission(session, {
      resource: "students",
      action: "read",
      targetStudentId: "STU-1",
    });
    const unlinkedStudentResult = checkPermission(session, {
      resource: "students",
      action: "read",
      targetStudentId: "STU-999",
    });

    expect(listResult.allowed).toBe(true);
    expect(linkedStudentResult.allowed).toBe(true);
    expect(unlinkedStudentResult.allowed).toBe(false);
    expect(unlinkedStudentResult.code).toBe("SUBJECT_DENIED");
  });

  it("denies parent access to student profile resource by default", () => {
    const session = createSession("parent");
    const result = checkPermission(session, {
      resource: "student_profiles",
      action: "read",
      targetStudentId: "STU-1",
    });
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("NO_GRANT");
  });

  it("applies explicit deny grants before allow grants", () => {
    const session = createSession("teacher");
    session.groups = [
      {
        id: "g-deny-student-read",
        name: "Deny Student Reads",
        scopeType: "school",
        scopeId: "sch-ne",
        permissions: [
          {
            resource: "students",
            action: "read",
            effect: "deny",
          },
        ],
      },
    ];

    const result = checkPermission(session, {
      resource: "students",
      action: "read",
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("EXPLICIT_DENY");
  });
});
