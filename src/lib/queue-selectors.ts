type ReferralLike = {
  id: string;
  studentName: string;
  status?: string | null;
};

type InterventionLike = {
  id: string;
  studentName: string;
  referralId?: string | null;
  workflowStatus?: string | null;
};

const TERMINAL_WORKFLOW_STATUSES = new Set([
  "denied",
  "completed_success",
  "completed_unsuccessful",
]);

const normalizeText = (value?: string | null): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isPendingReferralStatus = (status?: string | null): boolean => {
  const normalizedStatus = normalizeText(status);
  if (!normalizedStatus) return true;
  return (
    normalizedStatus.includes("pending") ||
    normalizedStatus.includes("new") ||
    normalizedStatus.includes("queue") ||
    normalizedStatus.includes("review")
  );
};

export const isPendingInterventionWorkflowStatus = (workflowStatus?: string | null): boolean => {
  const normalizedStatus = normalizeText(workflowStatus);
  return normalizedStatus === "pending_review" || normalizedStatus === "approved_provisional";
};

const isTerminalInterventionWorkflowStatus = (workflowStatus?: string | null): boolean =>
  TERMINAL_WORKFLOW_STATUSES.has(normalizeText(workflowStatus));

export const findLinkedInterventionForReferral = <TIntervention extends InterventionLike>(
  referral: ReferralLike,
  interventions: TIntervention[],
): TIntervention | null => {
  const byReferralId = interventions.find((item) => item.referralId === referral.id);
  if (byReferralId) return byReferralId;

  const referralStudentName = normalizeText(referral.studentName);
  if (!referralStudentName) return null;

  return (
    interventions.find(
      (item) =>
        normalizeText(item.studentName) === referralStudentName &&
        !isTerminalInterventionWorkflowStatus(item.workflowStatus),
    ) ?? null
  );
};

export const getPendingReferralQueue = <TReferral extends ReferralLike>(referrals: TReferral[]): TReferral[] =>
  referrals.filter((referral) => isPendingReferralStatus(referral.status));

export const getPendingInterventionReviewQueue = <
  TIntervention extends InterventionLike,
  TReferral extends ReferralLike,
>(
  interventions: TIntervention[],
  referrals: TReferral[],
) => {
  const interventionRecords = interventions.filter((intervention) =>
    isPendingInterventionWorkflowStatus(intervention.workflowStatus),
  );

  const referralIntakeItems = getPendingReferralQueue(referrals).filter(
    (referral) => !findLinkedInterventionForReferral(referral, interventions),
  );

  return {
    interventionRecords,
    referralIntakeItems,
    total: interventionRecords.length + referralIntakeItems.length,
  };
};

export const getPendingInterventionReviewCount = <
  TIntervention extends InterventionLike,
  TReferral extends ReferralLike,
>(
  interventions: TIntervention[],
  referrals: TReferral[],
): number => getPendingInterventionReviewQueue(interventions, referrals).total;
