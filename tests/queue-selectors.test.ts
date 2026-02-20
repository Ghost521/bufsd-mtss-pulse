import { describe, expect, it } from "vitest";

import {
  findLinkedInterventionForReferral,
  getPendingInterventionReviewCount,
  getPendingInterventionReviewQueue,
  getPendingReferralQueue,
  isPendingReferralStatus,
} from "../src/lib/queue-selectors";

type ReferralFixture = {
  id: string;
  studentName: string;
  status?: string;
};

type InterventionFixture = {
  id: string;
  studentName: string;
  referralId?: string;
  workflowStatus?: string;
};

const referral = (overrides: Partial<ReferralFixture>): ReferralFixture => ({
  id: "ref-1",
  studentName: "Jordan Lee",
  status: "Pending Review",
  ...overrides,
});

const intervention = (overrides: Partial<InterventionFixture>): InterventionFixture => ({
  id: "int-1",
  studentName: "Jordan Lee",
  workflowStatus: "pending_review",
  ...overrides,
});

describe("queue-selectors", () => {
  it("identifies pending referral statuses", () => {
    expect(isPendingReferralStatus("Pending Review")).toBe(true);
    expect(isPendingReferralStatus("New")).toBe(true);
    expect(isPendingReferralStatus("Queued")).toBe(true);
    expect(isPendingReferralStatus("Closed")).toBe(false);
    expect(isPendingReferralStatus(undefined)).toBe(true);
  });

  it("finds linked intervention by referral id first", () => {
    const ref = referral({ id: "ref-10" });
    const linked = intervention({ id: "int-10", referralId: "ref-10", workflowStatus: "approved" });
    const result = findLinkedInterventionForReferral(ref, [linked]);
    expect(result?.id).toBe("int-10");
  });

  it("falls back to student-name match for non-terminal interventions", () => {
    const ref = referral({ id: "ref-20", studentName: "Ava Patel" });
    const linked = intervention({ id: "int-20", studentName: "ava patel", workflowStatus: "active" });
    const result = findLinkedInterventionForReferral(ref, [linked]);
    expect(result?.id).toBe("int-20");
  });

  it("does not treat terminal interventions as active links in intake queue", () => {
    const ref = referral({ id: "ref-30", studentName: "Liam Chen" });
    const denied = intervention({ id: "int-30", studentName: "Liam Chen", workflowStatus: "denied" });
    const completed = intervention({
      id: "int-31",
      studentName: "Liam Chen",
      workflowStatus: "completed_success",
    });
    const pending = getPendingInterventionReviewQueue([denied, completed], [ref]).referralIntakeItems;
    expect(pending.map((item) => item.id)).toEqual(["ref-30"]);
  });

  it("returns pending referral queue only", () => {
    const rows = [
      referral({ id: "ref-1", status: "Pending Review" }),
      referral({ id: "ref-2", status: "Closed" }),
      referral({ id: "ref-3", status: "New" }),
    ];
    expect(getPendingReferralQueue(rows).map((item) => item.id)).toEqual(["ref-1", "ref-3"]);
  });

  it("combines pending interventions and unlinked pending referrals", () => {
    const interventions = [
      intervention({ id: "int-1", workflowStatus: "pending_review", referralId: "ref-1" }),
      intervention({ id: "int-2", workflowStatus: "approved_provisional" }),
      intervention({ id: "int-3", workflowStatus: "active", referralId: "ref-2" }),
    ];
    const referrals = [
      referral({ id: "ref-1", status: "Pending Review", studentName: "Jordan Lee" }),
      referral({ id: "ref-2", status: "Pending Review", studentName: "Mila Ray" }),
      referral({ id: "ref-3", status: "Pending Review", studentName: "Noah Fox" }),
      referral({ id: "ref-4", status: "Closed", studentName: "Sam Doe" }),
    ];

    const queue = getPendingInterventionReviewQueue(interventions, referrals);
    expect(queue.interventionRecords.map((item) => item.id)).toEqual(["int-1", "int-2"]);
    expect(queue.referralIntakeItems.map((item) => item.id)).toEqual(["ref-3"]);
    expect(queue.total).toBe(3);
    expect(getPendingInterventionReviewCount(interventions, referrals)).toBe(3);
  });
});
