
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  ArrowUpDown, 
  Layers, 
  Zap, 
  AlertCircle, 
  TrendingUp,
  LayoutList,
  LayoutGrid,
  Plus,
  Save,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Filter,
  X,
  Share2,
  Bot,
  Loader2,
  Send,
  CheckCircle2,
  CalendarClock,
  CalendarCheck2,
  XCircle,
  ClipboardList,
  ListChecks
} from 'lucide-react';
import { Tier, UserRole, type CalendarEvent, type MessagesLaunchContext, type StaffRosterItem } from '../types';
import { DraggableModal } from './DraggableModal';
import type { AIInterventionPlan } from '../services/geminiService';
import { generateStructuredIntervention } from '../services/geminiService';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { SidebarToggleButton } from './SidebarToggleButton';
import { getInterventionistRecipients, resolveInterventionFocus } from '../lib/interventionists';
import {
  findLinkedInterventionForReferral,
  getPendingInterventionReviewQueue,
  getPendingReferralQueue,
} from '../lib/queue-selectors';
import {
  DEFAULT_MATH_BENCHMARKS,
  applyGoalOutcomeAutomation,
  buildAutoRecommendedInterventions,
  buildCalendarMeetingEventFromProposal,
  buildMeetingProposalFromAvailability,
  createInterventionAuditEntry,
  createInterventionGoal,
  createInterventionNote,
  createWeeklyMilestones,
  normalizeInterventionRecord,
  type InterventionGoal,
  type InterventionGoalStatus,
  type InterventionMeetingProposal,
  type InterventionMilestone,
  type InterventionMilestoneStatus,
  type MathBenchmarkThreshold,
  type InterventionWorkflowFields,
  type InterventionWorkflowRecord,
} from '../lib/intervention-workflow';

const TEACHERS = ["Mr. Davis", "Mrs. Johnson", "Mr. Thompson", "Ms. Lee", "Mrs. Garcia"];
const PRINCIPAL_CONTACT = "Rosa Cortese";

type InterventionRecord = InterventionWorkflowRecord & InterventionWorkflowFields;

type StudentProfileRiskRecord = {
  id: string;
  name: string;
  grade: string;
  teacher?: string;
  teacherName?: string;
  readingLevel?: string;
  gpa?: string;
  tier?: Tier;
  avatarUrl?: string;
};

interface ReferralRecord {
  id: string;
  studentName: string;
  grade?: string;
  type: string;
  urgency: string;
  status?: string;
  createdAt?: string;
}

// --- Grouping & Sorting Types ---
type GroupBy = 'None' | 'Teacher' | 'Grade' | 'Tier' | 'Status';
type SortBy = 'Last Name' | 'First Name' | 'Progress' | 'Attendance' | 'Duration' | 'Grade' | 'Teacher' | 'Tier' | 'Plan Name';

interface InterventionManagerProps {
  onStudentClick: (name: string) => void;
  onMenuClick: () => void;
  currentUserRole: UserRole;
  currentUserName: string;
  onComposeMessage: (launch: MessagesLaunchContext) => void;
  highlightedReferralId?: string | null;
  onReferralHighlightConsumed?: () => void;
}

export const InterventionManager: React.FC<InterventionManagerProps> = ({
  onStudentClick,
  onMenuClick,
  currentUserRole,
  currentUserName,
  onComposeMessage,
  highlightedReferralId,
  onReferralHighlightConsumed,
}) => {
  const interventionsCollection = useTenantCollection<InterventionRecord>('interventions');
  const calendarCollection = useTenantCollection<CalendarEvent>('calendar');
  const studentProfilesCollection = useTenantCollection<StudentProfileRiskRecord>('student-profiles');
  const referralsCollection = useTenantCollection<ReferralRecord>('referrals');
  const staffCollection = useTenantCollection<StaffRosterItem>('staff');
  const [records, setRecords] = useState<InterventionRecord[]>([]);
  
  // View Controls
  const [groupBy, setGroupBy] = useState<GroupBy>('None');
  const [sortBy, setSortBy] = useState<SortBy>('Last Name');
  const [sortDesc, setSortDesc] = useState(false);
  const [layout, setLayout] = useState<'List' | 'Cards'>('List');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All'); // 'All', 'Active', 'Completed'
  const [teacherFilter, setTeacherFilter] = useState<string>('All');

  // Expansion State
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Modal State
  const [isNewPlanOpen, setIsNewPlanOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [selectedWorkflowRecordId, setSelectedWorkflowRecordId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [selectedPlanForShare, setSelectedPlanForShare] = useState<InterventionRecord | null>(null);
  const [shareTargets, setShareTargets] = useState({
    family: true,
    principal: false,
    support: true,
  });
  const [shareNote, setShareNote] = useState("");
  
  // New Plan Data & AI State
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatedPlanDetails, setGeneratedPlanDetails] = useState<AIInterventionPlan | null>(null);
  const [newPlanData, setNewPlanData] = useState({
    studentName: '',
    planName: '',
    tier: Tier.TIER_2,
    teacher: 'Mr. Davis',
    focusArea: 'Reading Comprehension'
  });

  // Monitoring Agent State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanCreatedCount, setScanCreatedCount] = useState(0);
  const [mathBenchmarks, setMathBenchmarks] = useState<Record<string, MathBenchmarkThreshold>>(DEFAULT_MATH_BENCHMARKS);
  const hasHydratedRef = useRef(false);
  const lastPersistedRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("mtss.math-benchmarks");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, MathBenchmarkThreshold>;
      if (!parsed || typeof parsed !== "object") return;
      setMathBenchmarks((previous) => ({ ...previous, ...parsed }));
    } catch {
      // Ignore parse failures and keep defaults.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("mtss.math-benchmarks", JSON.stringify(mathBenchmarks));
    } catch {
      // Ignore storage write failures in restricted contexts.
    }
  }, [mathBenchmarks]);

  useEffect(() => {
    const rows = interventionsCollection.query.data?.rows;
    if (!rows) return;
    const normalizedRows = rows.map((row) =>
      applyGoalOutcomeAutomation(normalizeInterventionRecord(row, currentUserName), "Automation"),
    );
    hasHydratedRef.current = true;
    const serialized = JSON.stringify(normalizedRows);
    lastPersistedRef.current = serialized;
    setRecords(normalizedRows);
  }, [currentUserName, interventionsCollection.query.data]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    const serialized = JSON.stringify(records);
    if (serialized === lastPersistedRef.current) return;
    const timeout = window.setTimeout(() => {
      lastPersistedRef.current = serialized;
      interventionsCollection.replaceMutation.mutate(records);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [interventionsCollection.replaceMutation, records]);

  useEffect(() => {
    const runAutomationPass = () => {
      setRecords((previous) => {
        const now = new Date();
        let changed = false;
        const next = previous.map((record) => {
          let updated = applyGoalOutcomeAutomation(record, "Automation", now);

          if (
            updated.workflowStatus === "approved_provisional" &&
            updated.requiresPrincipalCosign &&
            updated.decisionAt
          ) {
            const decidedAt = new Date(updated.decisionAt);
            const hoursSinceDecision = (now.getTime() - decidedAt.getTime()) / (1000 * 60 * 60);
            if (!Number.isNaN(hoursSinceDecision) && hoursSinceDecision >= 48) {
              const resetNote = createInterventionNote(
                "Approval acknowledgement timeout",
                "Principal acknowledgement was not completed within 48 hours. Intervention returned to pending review.",
                "Automation",
              );
              updated = {
                ...updated,
                workflowStatus: "pending_review",
                decision: "pending",
                requiresPrincipalCosign: false,
                notes: [...updated.notes, resetNote],
                auditTrail: [
                  ...updated.auditTrail,
                  createInterventionAuditEntry(
                    "outcome_updated",
                    "Automation",
                    "Provisional approval expired after 48 hours without principal acknowledgement.",
                  ),
                ],
              };
            }
          }

          if (updated !== record) {
            changed = true;
          }
          return updated;
        });

        return changed ? next : previous;
      });
    };

    runAutomationPass();
    const interval = window.setInterval(runAutomationPass, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const referrals = useMemo(
    () => referralsCollection.query.data?.rows ?? [],
    [referralsCollection.query.data?.rows],
  );
  const staffRows = useMemo(
    () => staffCollection.query.data?.rows ?? [],
    [staffCollection.query.data?.rows],
  );
  const studentProfiles = useMemo(
    () => studentProfilesCollection.query.data?.rows ?? [],
    [studentProfilesCollection.query.data?.rows],
  );
  const calendarEvents = useMemo(
    () => calendarCollection.query.data?.rows ?? [],
    [calendarCollection.query.data?.rows],
  );

  const selectedWorkflowRecord = useMemo(
    () => records.find((item) => item.id === selectedWorkflowRecordId) ?? null,
    [records, selectedWorkflowRecordId],
  );

  const isCurrentUserInterventionist = useMemo(() => {
    const currentName = currentUserName.trim().toLowerCase();
    if (!currentName) return false;
    return staffRows.some(
      (row) =>
        row.isInterventionist &&
        row.name.trim().toLowerCase() === currentName,
    );
  }, [currentUserName, staffRows]);

  const canApproveOrDeny = useMemo(() => {
    if (currentUserRole === UserRole.PRINCIPAL || currentUserRole === UserRole.DISTRICT) return true;
    return isCurrentUserInterventionist;
  }, [currentUserRole, isCurrentUserInterventionist]);
  const canConfigureMathBenchmarks = currentUserRole === UserRole.PRINCIPAL || currentUserRole === UserRole.DISTRICT;

  const pendingReferrals = useMemo(() => getPendingReferralQueue(referrals), [referrals]);

  const recentReferrals = useMemo(() => {
    const toTime = (value?: string) => {
      if (!value) return 0;
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    return [...pendingReferrals]
      .sort((left, right) => toTime(right.createdAt) - toTime(left.createdAt))
      .slice(0, 6);
  }, [pendingReferrals]);

  const selectedInterventionFocuses = useMemo(() => {
    if (!selectedPlanForShare) return [];
    return resolveInterventionFocus({
      focusArea: selectedPlanForShare.focusArea,
      planName: selectedPlanForShare.planName,
      note: shareNote,
    });
  }, [selectedPlanForShare, shareNote]);

  const autoInterventionists = useMemo(() => {
    if (!selectedPlanForShare) return [];
    const names = getInterventionistRecipients(staffRows, selectedInterventionFocuses);
    return names.filter((name) => name.toLowerCase() !== selectedPlanForShare.teacher.toLowerCase());
  }, [selectedInterventionFocuses, selectedPlanForShare, staffRows]);

  useEffect(() => {
    if (!highlightedReferralId || !onReferralHighlightConsumed) return;
    const timeout = window.setTimeout(() => onReferralHighlightConsumed(), 8000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [highlightedReferralId, onReferralHighlightConsumed]);

  // Filter & Sort Logic
  const processedData = useMemo<Record<string, InterventionRecord[]>>(() => {
    let data = [...records];

    // 1. Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(r => 
        r.studentName.toLowerCase().includes(q) || 
        r.planName.toLowerCase().includes(q) ||
        r.teacher.toLowerCase().includes(q)
      );
    }

    if (tierFilter !== 'All') {
      data = data.filter(r => r.tier === tierFilter);
    }

    if (teacherFilter !== 'All') {
      data = data.filter(r => r.teacher === teacherFilter);
    }

    if (statusFilter !== 'All') {
      if (statusFilter === 'Active') {
        data = data.filter(
          (r) =>
            r.workflowStatus === 'active' ||
            r.workflowStatus === 'approved' ||
            r.workflowStatus === 'approved_provisional',
        );
      } else if (statusFilter === 'Completed') {
        data = data.filter(
          (r) => r.workflowStatus === 'completed_success' || r.workflowStatus === 'completed_unsuccessful',
        );
      } else if (statusFilter === 'Pending Review') {
        data = data.filter((r) => r.workflowStatus === 'pending_review' || r.workflowStatus === 'approved_provisional');
      } else if (statusFilter === 'Needs Reassessment') {
        data = data.filter((r) => r.workflowStatus === 'needs_reassessment');
      }
    }

    // 2. Sort (Helper Function)
    const sortFn = (a: InterventionRecord, b: InterventionRecord) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortBy) {
        case 'Last Name': valA = a.lastName; valB = b.lastName; break;
        case 'First Name': valA = a.firstName; valB = b.firstName; break;
        case 'Progress': valA = a.progress; valB = b.progress; break;
        case 'Attendance': valA = a.attendance; valB = b.attendance; break;
        case 'Duration': valA = a.durationWeeks; valB = b.durationWeeks; break;
        case 'Grade': valA = a.grade; valB = b.grade; break;
        case 'Teacher': valA = a.teacher; valB = b.teacher; break;
        case 'Tier': valA = a.tier; valB = b.tier; break;
        case 'Plan Name': valA = a.planName; valB = b.planName; break;
      }

      if (valA < valB) return sortDesc ? 1 : -1;
      if (valA > valB) return sortDesc ? -1 : 1;
      return 0;
    };

    data.sort(sortFn);

    // 3. Group
    if (groupBy === 'None') {
      return { 'All Plans': data };
    }

    const groups: Record<string, InterventionRecord[]> = {};
    data.forEach(item => {
      let key = '';
      switch (groupBy) {
        case 'Teacher': key = item.teacher; break;
        case 'Grade': key = item.grade; break;
        case 'Tier': key = item.tier; break;
        case 'Status': key = item.workflowStatus.replace(/_/g, ' '); break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    // Sort Group Keys logic
    return Object.keys(groups).sort().reduce((acc, key) => {
        acc[key] = groups[key];
        return acc;
    }, {} as Record<string, InterventionRecord[]>);

  }, [records, searchQuery, groupBy, sortBy, sortDesc, tierFilter, statusFilter, teacherFilter]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const handleHeaderSort = (column: SortBy) => {
    if (sortBy === column) {
        setSortDesc(!sortDesc);
    } else {
        setSortBy(column);
        setSortDesc(false);
    }
  };

  const createInterventionFromReferral = (referral: ReferralRecord): InterventionRecord => {
    const [firstName, ...rest] = referral.studentName.trim().split(" ");
    const urgency = referral.urgency.toLowerCase();
    const suggestedTier = urgency.includes("critical") || urgency.includes("high") ? Tier.TIER_3 : Tier.TIER_2;
    const referralFocus = referral.type || "Academic";
    const baseStatus: InterventionRecord["status"] = urgency.includes("critical")
      ? "Critical"
      : urgency.includes("high")
        ? "At Risk"
        : "On Track";
    const goal = createInterventionGoal({
      title: `${referralFocus} intervention goal`,
      description: `Referral-driven intervention created from ${referral.id}.`,
      startDate: new Date().toISOString().slice(0, 10),
      progress: 0,
      actorName: currentUserName,
      durationMonths: 6,
      aiSuggested: true,
    });
    const meetingProposal = buildMeetingProposalFromAvailability({
      participants: [PRINCIPAL_CONTACT, TEACHERS[0], "Intervention Team"],
      events: calendarEvents,
    });

    return normalizeInterventionRecord(
      {
        id: `ref-${referral.id}-${Date.now()}`,
        referralId: referral.id,
        studentName: referral.studentName,
        firstName: firstName || referral.studentName,
        lastName: rest.join(" ") || "Student",
        grade: referral.grade || "N/A",
        teacher: TEACHERS[0],
        tier: suggestedTier,
        focusArea: referralFocus,
        planName: `${referralFocus} Referral Intervention`,
        startDate: new Date().toISOString().slice(0, 10),
        durationWeeks: 24,
        progress: 0,
        attendance: 100,
        status: baseStatus,
        avatarSeed: referral.studentName.replace(/\s+/g, ""),
        workflowStatus: "pending_review",
        decision: "pending",
        requiresPrincipalCosign: false,
        meetingProposal,
        goals: [goal],
        milestones: createWeeklyMilestones(goal),
        notes: [
          createInterventionNote(
            "Referral intake",
            `Intervention created from referral ${referral.id} (${referral.type}, ${referral.urgency}).`,
            currentUserName,
          ),
        ],
        outcome: { met: null },
        auditTrail: [
          createInterventionAuditEntry("recommended", currentUserName, `Created from referral queue item ${referral.id}.`),
          createInterventionAuditEntry("meeting_proposed", currentUserName, "Draft meeting proposal generated during intake."),
        ],
      },
      currentUserName,
    );
  };

  const ensureInterventionForReferral = (referral: ReferralRecord): InterventionRecord => {
    const existing = findLinkedInterventionForReferral(referral, records);
    if (existing) return existing;
    const created = createInterventionFromReferral(referral);
    setRecords((previous) => [created, ...previous]);
    return created;
  };

  const openReferralWorkflow = (referral: ReferralRecord) => {
    const intervention = ensureInterventionForReferral(referral);
    openWorkflowModal(intervention);
  };

  const approveFromReferralQueue = (referral: ReferralRecord) => {
    const intervention = ensureInterventionForReferral(referral);
    approveIntervention(intervention, `Approved from referral ${referral.id}.`);
    openWorkflowModal(intervention);
  };

  const denyFromReferralQueue = (referral: ReferralRecord) => {
    const intervention = ensureInterventionForReferral(referral);
    denyIntervention(intervention, `Denied from referral ${referral.id}.`);
    openWorkflowModal(intervention);
  };

  const setupMeetingFromReferralQueue = (referral: ReferralRecord) => {
    const intervention = ensureInterventionForReferral(referral);
    reproposeMeeting(intervention);
    openWorkflowModal(intervention);
  };

  const updateRecordById = (id: string, updater: (record: InterventionRecord) => InterventionRecord) => {
    setRecords((previous) =>
      previous.map((record) => (record.id === id ? updater(record) : record)),
    );
  };

  const openWorkflowModal = (record: InterventionRecord) => {
    setSelectedWorkflowRecordId(record.id);
    setDecisionReason(record.decisionReason ?? "");
    setIsWorkflowModalOpen(true);
  };

  const closeWorkflowModal = () => {
    setIsWorkflowModalOpen(false);
    setSelectedWorkflowRecordId(null);
    setDecisionReason("");
  };

  const approveIntervention = (record: InterventionRecord, reasonOverride?: string) => {
    if (!canApproveOrDeny) return;
    const resolvedReason = (reasonOverride ?? decisionReason).trim();
    const provisional = isCurrentUserInterventionist && currentUserRole !== UserRole.PRINCIPAL && currentUserRole !== UserRole.DISTRICT;
    updateRecordById(record.id, (current) => {
      const nextMeetingProposal =
        current.meetingProposal ??
        buildMeetingProposalFromAvailability({
          participants: [current.teacher, PRINCIPAL_CONTACT, "Intervention Team"],
          events: calendarEvents,
        });

      return {
        ...current,
        workflowStatus: provisional ? "approved_provisional" : "approved",
        decision: "approved",
        decisionByName: currentUserName,
        decisionByRole: currentUserRole,
        decisionAt: new Date().toISOString(),
        decisionReason: resolvedReason || undefined,
        requiresPrincipalCosign: provisional,
        meetingProposal: nextMeetingProposal,
        auditTrail: [
          ...current.auditTrail,
          createInterventionAuditEntry(
            "approved",
            currentUserName,
            provisional
              ? "Provisionally approved by interventionist; principal acknowledgement required within 48 hours."
              : "Intervention approved for activation.",
          ),
          createInterventionAuditEntry(
            "meeting_proposed",
            currentUserName,
            "Draft meeting proposal generated from participant availability.",
          ),
        ],
      };
    });
  };

  const denyIntervention = (record: InterventionRecord, reasonOverride?: string) => {
    if (!canApproveOrDeny) return;
    const resolvedReason = (reasonOverride ?? decisionReason).trim();
    updateRecordById(record.id, (current) => ({
      ...current,
      workflowStatus: "denied",
      decision: "denied",
      decisionByName: currentUserName,
      decisionByRole: currentUserRole,
      decisionAt: new Date().toISOString(),
      decisionReason: resolvedReason || "No reason provided.",
      auditTrail: [
        ...current.auditTrail,
        createInterventionAuditEntry("denied", currentUserName, `Intervention denied. Reason: ${resolvedReason || "No reason provided."}`),
      ],
    }));
  };

  const principalAcknowledge = (record: InterventionRecord) => {
    if (currentUserRole !== UserRole.PRINCIPAL) return;
    updateRecordById(record.id, (current) => ({
      ...current,
      workflowStatus: "approved",
      requiresPrincipalCosign: false,
      principalCosignAt: new Date().toISOString(),
      principalCosignByName: currentUserName,
      principalCosignByUserId: currentUserName,
      auditTrail: [
        ...current.auditTrail,
        createInterventionAuditEntry("cosigned", currentUserName, "Principal acknowledged provisional intervention approval."),
      ],
    }));
  };

  const reproposeMeeting = (record: InterventionRecord) => {
    updateRecordById(record.id, (current) => ({
      ...current,
      meetingProposal: buildMeetingProposalFromAvailability({
        participants: current.meetingProposal?.participants ?? [current.teacher, PRINCIPAL_CONTACT, "Intervention Team"],
        events: calendarEvents,
      }),
      auditTrail: [
        ...current.auditTrail,
        createInterventionAuditEntry("meeting_proposed", currentUserName, "Draft meeting proposal refreshed."),
      ],
    }));
  };

  const declineMeetingProposal = (record: InterventionRecord) => {
    if (!record.meetingProposal) return;
    updateRecordById(record.id, (current) => ({
      ...current,
      meetingProposal: current.meetingProposal
        ? {
            ...current.meetingProposal,
            status: "declined",
          }
        : current.meetingProposal,
      auditTrail: [
        ...current.auditTrail,
        createInterventionAuditEntry("meeting_proposed", currentUserName, "Meeting proposal declined."),
      ],
    }));
  };

  const confirmMeetingProposal = async (record: InterventionRecord) => {
    if (!record.meetingProposal) return;
    const proposal = record.meetingProposal;
    const event = buildCalendarMeetingEventFromProposal({
      interventionId: record.id,
      studentName: record.studentName,
      planName: record.planName,
      proposal,
      organizerName: currentUserName || PRINCIPAL_CONTACT,
    });

    try {
      await calendarCollection.createMutation.mutateAsync(event);
      updateRecordById(record.id, (current) => ({
        ...current,
        workflowStatus: "active",
        meetingEventId: event.id,
        meetingProposal: current.meetingProposal
          ? {
              ...current.meetingProposal,
              status: "confirmed",
            }
          : current.meetingProposal,
        auditTrail: [
          ...current.auditTrail,
          createInterventionAuditEntry("meeting_confirmed", currentUserName, "Intervention meeting confirmed and added to calendar."),
        ],
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const setGoalProgress = (recordId: string, goalId: string, progress: number) => {
    updateRecordById(recordId, (current) => {
      const timestamp = new Date().toISOString();
      const nextGoals = current.goals.map((goal) =>
        goal.id === goalId
          ? {
              ...goal,
              currentProgress: Math.max(0, Math.min(100, Math.round(progress))),
              status: Math.round(progress) >= goal.progressTarget ? ("met" as InterventionGoalStatus) : goal.status,
              editedAt: timestamp,
              editedByName: currentUserName,
            }
          : goal,
      );
      const allGoalsMet = nextGoals.length > 0 && nextGoals.every((goal) => goal.status === "met");
      return {
        ...current,
        goals: nextGoals,
        progress: Math.max(0, Math.min(100, Math.round(nextGoals.reduce((acc, goal) => acc + goal.currentProgress, 0) / Math.max(1, nextGoals.length)))),
        workflowStatus: allGoalsMet ? "completed_success" : current.workflowStatus,
        outcome: allGoalsMet
          ? {
              met: true,
              evaluatedAt: timestamp,
              evaluatorType: "manual",
              summaryNoteId: current.outcome.summaryNoteId,
            }
          : current.outcome,
        auditTrail: [
          ...current.auditTrail,
          createInterventionAuditEntry("goal_updated", currentUserName, "Goal progress manually updated."),
        ],
      };
    });
  };

  const updateMilestoneStatus = (recordId: string, milestoneId: string, status: InterventionMilestoneStatus) => {
    updateRecordById(recordId, (current) => ({
      ...current,
      milestones: current.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              status,
              editedAt: new Date().toISOString(),
            }
          : milestone,
      ),
      auditTrail: [
        ...current.auditTrail,
        createInterventionAuditEntry("milestone_updated", currentUserName, `Milestone marked ${status}.`),
      ],
    }));
  };

  const applyAiMilestoneSuggestions = (record: InterventionRecord) => {
    updateRecordById(record.id, (current) => ({
      ...current,
      milestones: current.milestones.map((milestone, index) => ({
        ...milestone,
        title: `Week ${index + 1}: ${current.focusArea || "Intervention"} checkpoint and evidence review`,
        aiSuggested: true,
        editedAt: new Date().toISOString(),
      })),
      auditTrail: [
        ...current.auditTrail,
        createInterventionAuditEntry("milestone_updated", currentUserName, "Applied AI suggested milestone wording."),
      ],
    }));
  };

  const updateMathBenchmark = (grade: string, value: number) => {
    setMathBenchmarks((previous) => ({
      ...previous,
      [grade]: {
        minimumGpa: Number.isFinite(value) ? Math.max(0, Math.min(4, Number(value.toFixed(2)))) : (previous[grade]?.minimumGpa ?? 2.5),
      },
    }));
  };

  const handleGeneratePlan = async () => {
    if (!newPlanData.studentName) return;
    setIsGeneratingPlan(true);
    try {
      const plan = await generateStructuredIntervention(
        newPlanData.studentName,
        '4th', // Simplified for demo
        newPlanData.tier,
        newPlanData.focusArea
      );
      setGeneratedPlanDetails(plan);
      setNewPlanData(prev => ({ ...prev, planName: plan.title }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleSaveNewPlan = () => {
    const [first, ...rest] = newPlanData.studentName.split(' ');
    const goal = createInterventionGoal({
      title: `${newPlanData.focusArea} growth goal`,
      description: `Support ${newPlanData.studentName || "student"} in ${newPlanData.focusArea}.`,
      startDate: new Date().toISOString().slice(0, 10),
      progress: 0,
      actorName: currentUserName,
      durationMonths: 6,
      aiSuggested: true,
    });
    const newRecord = normalizeInterventionRecord({
      id: `new-${Date.now()}`,
      studentName: newPlanData.studentName || 'New Student',
      firstName: first || 'New',
      lastName: rest.join(' ') || 'Student',
      grade: '4th', // Default
      teacher: newPlanData.teacher,
      tier: newPlanData.tier,
      focusArea: newPlanData.focusArea,
      planName: newPlanData.planName,
      startDate: new Date().toISOString().split('T')[0],
      durationWeeks: 6,
      progress: 0,
      attendance: 100,
      status: 'On Track',
      avatarSeed: (newPlanData.studentName || 'new').replace(/ /g, ''),
      lessonPlan: generatedPlanDetails || undefined,
      workflowStatus: "pending_review",
      decision: "pending",
      requiresPrincipalCosign: false,
      goals: [goal],
      milestones: createWeeklyMilestones(goal),
      notes: [],
      outcome: { met: null },
      auditTrail: [createInterventionAuditEntry("created", currentUserName, "Intervention plan created.")],
    }, currentUserName);

    setRecords([newRecord, ...records]);
    setIsNewPlanOpen(false);
    // Reset
    setNewPlanData({ studentName: '', planName: '', tier: Tier.TIER_2, teacher: 'Mr. Davis', focusArea: 'Reading' });
    setGeneratedPlanDetails(null);
  };

  const handleScanClass = () => {
    setIsScanning(true);
    window.setTimeout(() => {
      const autoRecommended = buildAutoRecommendedInterventions({
        students: studentProfiles.map((student) => ({
          id: student.id,
          name: student.name,
          grade: student.grade,
          teacherName: student.teacherName || student.teacher,
          readingLevel: student.readingLevel,
          gpa: student.gpa,
          tier: student.tier,
          avatarSeed: student.name.replace(/\s+/g, ""),
        })),
        existingInterventions: records,
        calendarEvents,
        mathBenchmarks,
        durationWeeks: 6,
        actorName: "MTSS Auto Monitor",
      });

      if (autoRecommended.length > 0) {
        setRecords((previous) => [...autoRecommended, ...previous]);
      }
      setScanCreatedCount(autoRecommended.length);
      setIsScanning(false);
      if (autoRecommended.length === 0) {
        setScanResult("No new students met the 6-week below-benchmark recommendation threshold.");
      } else {
        setScanResult(
          `Queued ${autoRecommended.length} auto-recommended intervention${autoRecommended.length === 1 ? "" : "s"} with draft meeting proposals.`,
        );
      }
      window.setTimeout(() => setScanResult(null), 5000);
    }, 1200);
  };

  type ShareRecipient = {
    recipientName: string;
    recipientRole: UserRole;
    label: string;
  };

  const resolveShareRecipient = (plan: InterventionRecord, target: "family" | "support" | "principal") => {
    if (target === "family") {
      return {
        recipientName: `Family of ${plan.firstName || plan.studentName}`,
        recipientRole: UserRole.PARENT,
        label: "Family",
      };
    }
    if (target === "support") {
      return {
        recipientName: plan.teacher || TEACHERS[0],
        recipientRole: UserRole.TEACHER,
        label: "Support staff",
      };
    }
    return {
      recipientName: PRINCIPAL_CONTACT,
      recipientRole: UserRole.PRINCIPAL,
      label: "Principal",
    };
  };

  const handleSharePlan = (plan: InterventionRecord) => {
      setSelectedPlanForShare(plan);
      setShareTargets({ family: true, principal: false, support: true });
      setShareNote("");
      setIsShareModalOpen(true);
  };

  const handleConfirmShare = () => {
      if (!selectedPlanForShare) return;
      const selectedTargets = (["family", "support", "principal"] as const).filter(
        (target) => shareTargets[target],
      );
      const manualRecipients = selectedTargets.map((target) => resolveShareRecipient(selectedPlanForShare, target));
      const autoRecipients: ShareRecipient[] = autoInterventionists.map((name) => ({
        recipientName: name,
        recipientRole: UserRole.TEACHER,
        label: "Interventionist",
      }));
      const recipients = [...manualRecipients, ...autoRecipients].reduce<ShareRecipient[]>((accumulator, recipient) => {
        const key = recipient.recipientName.trim().toLowerCase();
        if (!key || accumulator.some((entry) => entry.recipientName.trim().toLowerCase() === key)) {
          return accumulator;
        }
        accumulator.push(recipient);
        return accumulator;
      }, []);
      if (recipients.length === 0) return;

      const [primaryRecipient, ...additionalRecipients] = recipients;
      const note = shareNote.trim();
      const defaultDraft = `Sharing ${selectedPlanForShare.planName} for ${selectedPlanForShare.studentName}.`;
      const collaboratorLine = additionalRecipients.length > 0
        ? ` Please include ${additionalRecipients.map((recipient) => recipient.recipientName).join(", ")} in follow-up.`
        : "";
      const recipientRolesByName = recipients.reduce<Record<string, UserRole>>((accumulator, recipient) => {
        accumulator[recipient.recipientName] = recipient.recipientRole;
        return accumulator;
      }, {});

      onComposeMessage({
        recipientName: primaryRecipient.recipientName,
        recipientRole: primaryRecipient.recipientRole,
        recipientNames: recipients.map((recipient) => recipient.recipientName),
        recipientRolesByName,
        draft: `${note || defaultDraft}${collaboratorLine}`,
        context: {
          type: "intervention",
          studentName: selectedPlanForShare.studentName,
          interventionId: selectedPlanForShare.id,
          interventionPlanName: selectedPlanForShare.planName,
        },
      });
      setIsShareModalOpen(false);
      setSelectedPlanForShare(null);
      setShareNote("");
  };

  const handleReferralMessage = (referral: ReferralRecord) => {
    const isEscalated = /high|critical/i.test(referral.urgency);
    onComposeMessage({
      recipientName: isEscalated ? PRINCIPAL_CONTACT : TEACHERS[0],
      recipientRole: isEscalated ? UserRole.PRINCIPAL : UserRole.TEACHER,
      draft: `Follow up on ${referral.studentName}'s ${referral.type.toLowerCase()} referral (${referral.urgency.toLowerCase()} urgency).`,
      context: {
        type: "referral",
        studentName: referral.studentName,
        referralId: referral.id,
        referralType: referral.type,
        referralUrgency: /low|medium|high|critical/i.test(referral.urgency)
          ? (referral.urgency[0].toUpperCase() + referral.urgency.slice(1).toLowerCase()) as "Low" | "Medium" | "High" | "Critical"
          : undefined,
      },
    });
  };

  const clearFilters = () => {
    setTierFilter('All');
    setStatusFilter('All');
    setTeacherFilter('All');
    setSearchQuery('');
  };

  const formatReferralTime = (value?: string) => {
    if (!value) return 'Unknown time';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown time';
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // --- Render Helpers ---

  const formatWorkflowStatus = (status: InterventionRecord["workflowStatus"]) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const getWorkflowBadge = (status: InterventionRecord["workflowStatus"]) => {
    const tone =
      status === "completed_success"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : status === "needs_reassessment" || status === "completed_unsuccessful" || status === "denied"
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : status === "approved" || status === "active"
            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
            : status === "approved_provisional"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-100 text-slate-700 border-slate-200";
    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone}`}>{formatWorkflowStatus(status)}</span>;
  };

  const formatMeetingTime = (proposal?: InterventionMeetingProposal) => {
    if (!proposal) return "No meeting draft";
    const start = new Date(proposal.proposedStart);
    const end = new Date(proposal.proposedEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "No meeting draft";
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  };

  const getTierBadge = (tier: Tier) => {
    const colors = {
      [Tier.TIER_1]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      [Tier.TIER_2]: 'bg-amber-50 text-amber-700 border-amber-200',
      [Tier.TIER_3]: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colors[tier]}`}>
        {tier}
      </span>
    );
  };

  const getProgressBar = (val: number) => {
    let color = 'bg-emerald-500';
    if (val < 50) color = 'bg-rose-500';
    else if (val < 75) color = 'bg-amber-500';
    
    return (
      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
      </div>
    );
  };

  const renderSortIcon = (column: SortBy) => {
      if (sortBy !== column) return <ArrowUpDown size={12} className="opacity-30" />;
      return sortDesc ? <ArrowDown size={12} className="text-indigo-600" /> : <ArrowUp size={12} className="text-indigo-600" />;
  };

  const stats = {
    total: records.length,
    critical: records.filter(r => r.status === 'Critical').length,
    tier3: records.filter(r => r.tier === Tier.TIER_3).length,
    pendingReview: records.filter((r) => r.workflowStatus === "pending_review" || r.workflowStatus === "approved_provisional").length,
    needsReassessment: records.filter((r) => r.workflowStatus === "needs_reassessment").length,
    avgProgress: records.length > 0
      ? Math.round(records.reduce((acc, r) => acc + r.progress, 0) / records.length)
      : 0
  };

  const pendingReviewQueue = useMemo(
    () => getPendingInterventionReviewQueue(records, referrals),
    [records, referrals],
  );
  const pendingReviewRecords = pendingReviewQueue.interventionRecords;
  const pendingReferralWithoutIntervention = pendingReviewQueue.referralIntakeItems;
  const totalPendingReviewCount = pendingReviewQueue.total;
  const autoRecommendedRecords = useMemo(
    () => records.filter((record) => Boolean(record.autoRecommendation)),
    [records],
  );

  const activeFilterCount = [
    tierFilter !== 'All',
    statusFilter !== 'All',
    teacherFilter !== 'All'
  ].filter(Boolean).length;
  const hasShareRecipients = shareTargets.family || shareTargets.principal || shareTargets.support || autoInterventionists.length > 0;

  return (
    <div className="app-responsive-pane flex h-full min-w-0 flex-col bg-slate-50/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Share Modal */}
      <DraggableModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setSelectedPlanForShare(null);
          setShareNote("");
        }}
        title="Share Lesson Plan"
        initialWidth={500}
        initialHeight={400}
        footer={
            <div className="flex justify-end gap-3 w-full">
                <button
                  onClick={() => {
                    setIsShareModalOpen(false);
                    setSelectedPlanForShare(null);
                    setShareNote("");
                  }}
                  className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmShare}
                  disabled={!hasShareRecipients}
                  className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Send size={16} /> Send
                </button>
            </div>
        }
      >
          <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="font-bold text-slate-800 text-sm">{selectedPlanForShare?.planName}</h4>
                  <p className="text-xs text-slate-500">For: {selectedPlanForShare?.studentName}</p>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Recipients</label>
                  <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-indigo-600 rounded"
                            checked={shareTargets.family}
                            onChange={(event) =>
                              setShareTargets((previous) => ({ ...previous, family: event.target.checked }))
                            }
                          />
                          <div className="flex-1">
                              <span className="text-sm font-bold text-slate-700 block">Parents / Guardians</span>
                              <span className="text-xs text-slate-400">Via Parent Portal & Email</span>
                          </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-indigo-600 rounded"
                            checked={shareTargets.principal}
                            onChange={(event) =>
                              setShareTargets((previous) => ({ ...previous, principal: event.target.checked }))
                            }
                          />
                          <div className="flex-1">
                              <span className="text-sm font-bold text-slate-700 block">Principal</span>
                              <span className="text-xs text-slate-400">For approval/review</span>
                          </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-indigo-600 rounded"
                            checked={shareTargets.support}
                            onChange={(event) =>
                              setShareTargets((previous) => ({ ...previous, support: event.target.checked }))
                            }
                          />
                          <div className="flex-1">
                              <span className="text-sm font-bold text-slate-700 block">Support Staff</span>
                              <span className="text-xs text-slate-400">Intervention specialists</span>
                          </div>
                      </label>
                  </div>
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-800">
                    {autoInterventionists.length > 0 ? (
                      <p>
                        Auto-included {selectedInterventionFocuses.join(" + ")} interventionists: {autoInterventionists.join(", ")}.
                      </p>
                    ) : (
                      <p>
                        No tagged interventionists match this plan yet. Principals can tag teachers in Staff Directory.
                      </p>
                    )}
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Message (Optional)</label>
                  <textarea
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none"
                    placeholder="Add a note..."
                    value={shareNote}
                    onChange={(event) => setShareNote(event.target.value)}
                  />
              </div>
          </div>
      </DraggableModal>

      {/* New Plan Modal */}
      <DraggableModal
        isOpen={isNewPlanOpen}
        onClose={() => setIsNewPlanOpen(false)}
        title="Create Intervention Lesson Plan"
        initialWidth={700}
        initialHeight={700}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button onClick={() => setIsNewPlanOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button 
                onClick={handleSaveNewPlan} 
                disabled={!generatedPlanDetails}
                className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} /> Save Plan
            </button>
          </div>
        }
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Student Name</label>
                <input 
                type="text" 
                value={newPlanData.studentName}
                onChange={(e) => setNewPlanData({...newPlanData, studentName: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Jordan Lee"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Focus Area</label>
                <input 
                type="text" 
                value={newPlanData.focusArea}
                onChange={(e) => setNewPlanData({...newPlanData, focusArea: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Reading Comprehension"
                />
            </div>
          </div>
          
          <div className="flex gap-4">
             <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tier Level</label>
                <div className="flex gap-2">
                {[Tier.TIER_1, Tier.TIER_2, Tier.TIER_3].map(t => (
                    <button
                    key={t}
                    onClick={() => setNewPlanData({...newPlanData, tier: t})}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        newPlanData.tier === t 
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700 ring-1 ring-indigo-600' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    >
                    {t}
                    </button>
                ))}
                </div>
             </div>
             <div className="flex items-end">
                 <button 
                    onClick={handleGeneratePlan}
                    disabled={isGeneratingPlan || !newPlanData.studentName}
                    className="h-[38px] px-4 bg-indigo-100 text-indigo-700 font-semibold text-sm rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                 >
                     {isGeneratingPlan ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                     Generate Lesson Plan
                 </button>
             </div>
          </div>

          {generatedPlanDetails && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                      <div>
                          <h3 className="font-bold text-indigo-900 text-lg">{generatedPlanDetails.title}</h3>
                          <p className="text-sm text-slate-600">{generatedPlanDetails.strategy}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                          <p>Freq: {generatedPlanDetails.frequency}</p>
                          <p>Duration: {generatedPlanDetails.duration}</p>
                      </div>
                  </div>
                  
                  <div className="space-y-3">
                      <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase">Objective</h4>
                          <p className="text-sm text-slate-800">{generatedPlanDetails.lessonPlan.objective}</p>
                      </div>
                      <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase">Procedure</h4>
                          <ul className="list-disc pl-4 text-sm text-slate-700 space-y-1">
                              {generatedPlanDetails.lessonPlan.procedure.map((step, i) => (
                                  <li key={i}>{step}</li>
                              ))}
                          </ul>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase">Materials</h4>
                              <p className="text-xs text-slate-600">{generatedPlanDetails.lessonPlan.materials.join(', ')}</p>
                          </div>
                          <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase">Assessment</h4>
                              <p className="text-xs text-slate-600">{generatedPlanDetails.lessonPlan.assessment}</p>
                          </div>
                      </div>
                  </div>
              </div>
          )}
        </div>
      </DraggableModal>

      <DraggableModal
        isOpen={isWorkflowModalOpen && Boolean(selectedWorkflowRecord)}
        onClose={closeWorkflowModal}
        title="Intervention Workflow"
        initialWidth={920}
        initialHeight={760}
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeWorkflowModal}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedWorkflowRecord ? (
          <div className="space-y-5 p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedWorkflowRecord.studentName}</h3>
                  <p className="text-sm text-slate-600">{selectedWorkflowRecord.planName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Teacher: {selectedWorkflowRecord.teacher} | Grade {selectedWorkflowRecord.grade} | Tier {selectedWorkflowRecord.tier}
                  </p>
                </div>
                <div className="space-y-2 text-right">
                  {getWorkflowBadge(selectedWorkflowRecord.workflowStatus)}
                  <p className="text-xs text-slate-500">
                    Decision: <span className="font-semibold text-slate-700">{selectedWorkflowRecord.decision}</span>
                  </p>
                  {selectedWorkflowRecord.requiresPrincipalCosign ? (
                    <p className="text-xs font-semibold text-amber-700">Principal acknowledgement required within 48 hours.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks size={16} className="text-slate-500" />
                <h4 className="text-sm font-bold text-slate-900">Review and Approval</h4>
              </div>
              <textarea
                className="mb-3 h-20 w-full resize-none rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700"
                placeholder="Decision reason or implementation notes"
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => approveIntervention(selectedWorkflowRecord)}
                  disabled={!canApproveOrDeny}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => denyIntervention(selectedWorkflowRecord)}
                  disabled={!canApproveOrDeny}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle size={14} /> Deny
                </button>
                {selectedWorkflowRecord.workflowStatus === "approved_provisional" && currentUserRole === UserRole.PRINCIPAL ? (
                  <button
                    type="button"
                    onClick={() => principalAcknowledge(selectedWorkflowRecord)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    <CheckCircle2 size={14} /> Principal Acknowledge
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock size={16} className="text-slate-500" />
                <h4 className="text-sm font-bold text-slate-900">Meeting Proposal</h4>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">{formatMeetingTime(selectedWorkflowRecord.meetingProposal)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedWorkflowRecord.meetingProposal?.reason ?? "No proposal generated yet."}
                </p>
                {selectedWorkflowRecord.meetingProposal?.participants?.length ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Participants: {selectedWorkflowRecord.meetingProposal.participants.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => reproposeMeeting(selectedWorkflowRecord)}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <CalendarClock size={14} /> Propose Slot
                </button>
                <button
                  type="button"
                  onClick={() => confirmMeetingProposal(selectedWorkflowRecord)}
                  disabled={!selectedWorkflowRecord.meetingProposal || selectedWorkflowRecord.meetingProposal.status === "confirmed"}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CalendarCheck2 size={14} /> Confirm
                </button>
                <button
                  type="button"
                  onClick={() => declineMeetingProposal(selectedWorkflowRecord)}
                  disabled={!selectedWorkflowRecord.meetingProposal}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle size={14} /> Decline
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList size={16} className="text-slate-500" />
                  <h4 className="text-sm font-bold text-slate-900">Goals</h4>
                </div>
                <div className="space-y-3">
                  {selectedWorkflowRecord.goals.map((goal: InterventionGoal) => (
                    <div key={goal.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{goal.title}</p>
                          <p className="text-xs text-slate-500">{goal.description}</p>
                          <p className="mt-1 text-[11px] text-slate-500">Target: {goal.targetDate}</p>
                        </div>
                        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {goal.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-2">
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Progress</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={goal.currentProgress}
                          onChange={(event) => setGoalProgress(selectedWorkflowRecord.id, goal.id, Number(event.target.value))}
                          className="w-full"
                        />
                        <p className="text-xs font-semibold text-slate-700">{goal.currentProgress}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ListChecks size={16} className="text-slate-500" />
                    <h4 className="text-sm font-bold text-slate-900">Weekly Milestones</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyAiMilestoneSuggestions(selectedWorkflowRecord)}
                    className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    AI Suggestions
                  </button>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {selectedWorkflowRecord.milestones.map((milestone: InterventionMilestone) => (
                    <div key={milestone.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-xs font-semibold text-slate-800">{milestone.title}</p>
                      <p className="text-[11px] text-slate-500">Due {milestone.dueDate}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(["pending", "met", "missed"] as InterventionMilestoneStatus[]).map((status) => (
                          <button
                            key={`${milestone.id}-${status}`}
                            type="button"
                            onClick={() => updateMilestoneStatus(selectedWorkflowRecord.id, milestone.id, status)}
                            className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                              milestone.status === status
                                ? "bg-indigo-600 text-white"
                                : "border border-slate-300 bg-white text-slate-700"
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">
                Outcome:{" "}
                <span className="text-slate-900">
                  {selectedWorkflowRecord.outcome.met === null
                    ? "Not evaluated"
                    : selectedWorkflowRecord.outcome.met
                      ? "Success"
                      : "Unmet"}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Notes are visible to Teachers, Principals, District Admins, and Interventionists.
              </p>
            </div>
          </div>
        ) : null}
      </DraggableModal>

      {/* Header & Stats */}
      <div className="bg-white border-b border-slate-200 p-6 pb-0">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="flex min-w-0 items-center gap-3">
                <SidebarToggleButton
                    onClick={onMenuClick}
                    className="lg:hidden p-2 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-lg"
                />
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Intervention Plans</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage and track support plans across the school.</p>
                </div>
            </div>
            
            <div className="app-responsive-actions w-full md:w-auto">
                <button 
                    onClick={handleScanClass}
                    disabled={isScanning}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl font-semibold text-sm shadow-sm hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-70"
                >
                    {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                    Scan Class for Needs
                </button>
                <button 
                onClick={() => setIsNewPlanOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-all active:scale-95"
                >
                    <Plus size={18} /> New Plan
                </button>
            </div>
        </div>

        {scanResult && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 text-indigo-800 text-sm animate-in fade-in slide-in-from-top-2">
                <Bot size={20} className="text-indigo-600" />
                <span className="font-bold">Agent Report:</span> {scanResult}
            </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Plans</p>
                    <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Zap size={20} /></div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical Status</p>
                    <p className="text-2xl font-bold text-rose-600">{stats.critical}</p>
                </div>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertCircle size={20} /></div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Review</p>
                    <p className="text-2xl font-bold text-amber-600">{totalPendingReviewCount}</p>
                </div>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><ClipboardList size={20} /></div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Progress</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.avgProgress}%</p>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={20} /></div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Needs Reassessment</p>
                    <p className="text-2xl font-bold text-rose-600">{stats.needsReassessment}</p>
                </div>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><XCircle size={20} /></div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tier 3 Load</p>
                    <p className="text-2xl font-bold text-slate-800">{stats.tier3}</p>
                </div>
                <div className="p-2 bg-slate-100 text-slate-700 rounded-lg"><Layers size={20} /></div>
            </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Intervention Review Queue</h2>
                        <p className="text-xs text-slate-600">Approve, deny, or provisionally approve interventions before activation.</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
                        {totalPendingReviewCount} pending
                    </span>
                </div>
                {totalPendingReviewCount === 0 ? (
                    <p className="text-sm text-slate-600">No interventions currently waiting for review.</p>
                ) : (
                    <div className="space-y-2">
                        {pendingReviewRecords.slice(0, 4).map((record) => (
                            <div key={`pending-${record.id}`} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">{record.studentName}</p>
                                        <p className="text-xs text-slate-500">{record.planName}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getWorkflowBadge(record.workflowStatus)}
                                        <button
                                          type="button"
                                          onClick={() => openWorkflowModal(record)}
                                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                        >
                                          Review
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {pendingReferralWithoutIntervention.slice(0, 4).map((referral) => (
                            <div key={`pending-referral-${referral.id}`} className="rounded-lg border border-indigo-200 bg-white px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">{referral.studentName}</p>
                                        <p className="text-xs text-slate-500">
                                          Referral {referral.id} • {referral.type} • {referral.urgency}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                          Pending Referral
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => openReferralWorkflow(referral)}
                                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                        >
                                          Review
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Auto Recommendations</h2>
                        <p className="text-xs text-slate-600">Students below benchmark for 6 weeks are queued with a proposed meeting slot.</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {autoRecommendedRecords.length} total
                    </span>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  Last scan created <span className="font-semibold text-slate-900">{scanCreatedCount}</span> recommendation{scanCreatedCount === 1 ? "" : "s"}.
                </p>
                {canConfigureMathBenchmarks ? (
                  <div className="mb-3 rounded-lg border border-indigo-200 bg-white p-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Math GPA Thresholds (Admin)</p>
                    <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                      {["3", "4", "5", "6", "7", "8"].map((grade) => (
                        <label key={`math-threshold-${grade}`} className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold text-slate-500">Grade {grade}</span>
                          <input
                            type="number"
                            min={0}
                            max={4}
                            step={0.1}
                            value={mathBenchmarks[grade]?.minimumGpa ?? 2.5}
                            onChange={(event) => updateMathBenchmark(grade, Number.parseFloat(event.target.value))}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                    {autoRecommendedRecords.slice(0, 3).map((record) => (
                        <div key={`auto-${record.id}`} className="rounded-lg border border-indigo-200 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{record.studentName}</p>
                                    <p className="text-xs text-slate-500">
                                      {record.autoRecommendation?.source.toUpperCase()} risk since {record.autoRecommendation?.belowSince}
                                    </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openWorkflowModal(record)}
                                  className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                                >
                                  Open
                                </button>
                            </div>
                        </div>
                    ))}
                    {autoRecommendedRecords.length === 0 ? (
                        <p className="text-sm text-slate-600">No benchmark-based recommendations yet.</p>
                    ) : null}
                </div>
            </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold text-slate-900">Referral Queue</h2>
                    <p className="text-xs text-slate-500">Most recent referrals awaiting review.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {pendingReferrals.length} pending
                </span>
            </div>

            {referralsCollection.query.isLoading ? (
                <div className="py-4 text-sm text-slate-500">Loading referral queue...</div>
            ) : recentReferrals.length === 0 ? (
                <div className="py-4 text-sm text-slate-500">No referrals in the queue yet.</div>
            ) : (
                <div className="space-y-2">
                    {recentReferrals.map((referral) => {
                        const isHighlighted = referral.id === highlightedReferralId;
                        const linkedIntervention = findLinkedInterventionForReferral(referral, records);
                        return (
                            <div
                                key={referral.id}
                                onClick={() => openReferralWorkflow(referral)}
                                className={`rounded-lg border p-3 transition-colors ${
                                    isHighlighted
                                        ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-300'
                                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                } cursor-pointer`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">
                                            {referral.studentName}
                                            <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                                {referral.id}
                                            </span>
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Grade {referral.grade ?? 'N/A'} | {referral.type} | {referral.urgency}
                                        </p>
                                        {linkedIntervention ? (
                                          <p className="mt-1 text-[11px] font-semibold text-indigo-700">
                                            Linked intervention: {linkedIntervention.planName}
                                          </p>
                                        ) : (
                                          <p className="mt-1 text-[11px] font-semibold text-amber-700">
                                            Not yet in review queue. Click to open and create workflow item.
                                          </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500">{formatReferralTime(referral.createdAt)}</p>
                                            <p className="text-xs font-semibold text-amber-700">{referral.status ?? 'Pending Review'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(event) => { event.stopPropagation(); onStudentClick(referral.studentName); }}
                                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                        >
                                            Open Student
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => { event.stopPropagation(); handleReferralMessage(referral); }}
                                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                                        >
                                            Message Team
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => { event.stopPropagation(); approveFromReferralQueue(referral); }}
                                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => { event.stopPropagation(); denyFromReferralQueue(referral); }}
                                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                        >
                                            Deny
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => { event.stopPropagation(); setupMeetingFromReferralQueue(referral); }}
                                            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                                        >
                                            Set Meeting
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col gap-4 pb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Search & Filter Toggle */}
                <div className="flex gap-3 flex-1 w-full">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search students, teachers, or plans..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-sm font-medium ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                        <Filter size={18} />
                        {activeFilterCount > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Group By */}
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    <div className="relative shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Layers size={14} /></span>
                        <select 
                            value={groupBy} 
                            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                            className="pl-8 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none cursor-pointer hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="None">No Grouping</option>
                            <option value="Teacher">Group by Teacher</option>
                            <option value="Grade">Group by Grade</option>
                            <option value="Tier">Group by Tier</option>
                            <option value="Status">Group by Status</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Sort By */}
                    <div className="relative shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><ArrowUpDown size={14} /></span>
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value as SortBy)}
                            className="pl-8 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none cursor-pointer hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option>Last Name</option>
                            <option>First Name</option>
                            <option>Progress</option>
                            <option>Attendance</option>
                            <option>Duration</option>
                            <option>Grade</option>
                            <option>Teacher</option>
                            <option>Tier</option>
                            <option>Plan Name</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    <button 
                        onClick={() => setSortDesc(!sortDesc)}
                        className={`p-2.5 rounded-xl border transition-all ${sortDesc ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}
                        title={sortDesc ? "Descending" : "Ascending"}
                    >
                        <ArrowUpDown size={16} className={sortDesc ? "rotate-180 transition-transform" : "transition-transform"} />
                    </button>

                    <div className="w-px h-8 bg-slate-200 mx-1"></div>

                    <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                        <button onClick={() => setLayout('List')} className={`p-1.5 rounded-lg transition-all ${layout === 'List' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                            <LayoutList size={18} />
                        </button>
                        <button onClick={() => setLayout('Cards')} className={`p-1.5 rounded-lg transition-all ${layout === 'Cards' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Collapsible Filter Row */}
            {showFilters && (
                <div className="flex flex-wrap gap-4 pt-2 animate-in slide-in-from-top-2 border-t border-slate-100">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tier Level</label>
                        <select 
                            value={tierFilter}
                            onChange={(e) => setTierFilter(e.target.value)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                        >
                            <option value="All">All Tiers</option>
                            <option value={Tier.TIER_1}>{Tier.TIER_1}</option>
                            <option value={Tier.TIER_2}>{Tier.TIER_2}</option>
                            <option value={Tier.TIER_3}>{Tier.TIER_3}</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Intervention Status</label>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Pending Review">Pending Review</option>
                            <option value="Active">Active</option>
                            <option value="Completed">Completed</option>
                            <option value="Needs Reassessment">Needs Reassessment</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teacher</label>
                        <select 
                            value={teacherFilter}
                            onChange={(e) => setTeacherFilter(e.target.value)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                        >
                            <option value="All">All Teachers</option>
                            {TEACHERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {(activeFilterCount > 0 || searchQuery) && (
                        <div className="flex flex-col justify-end">
                            <button 
                                onClick={clearFilters}
                                className="p-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <X size={14} /> Clear All
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Content Area */}
      <div className="app-responsive-content flex-1 p-4 sm:p-6">
        <div className="space-y-6 max-w-7xl mx-auto">
            
            {/* Sticky Header for List View */}
            {layout === 'List' && (
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 p-3 text-xs font-bold uppercase tracking-wider text-slate-500 shadow-sm">
                    <div 
                        className="flex min-w-0 flex-[1.4] items-center gap-2 cursor-pointer hover:text-indigo-600"
                        onClick={() => handleHeaderSort('Last Name')}
                    >
                        Student Name {renderSortIcon('Last Name')}
                    </div>
                    <div 
                        className="hidden flex-1 items-center gap-2 cursor-pointer hover:text-indigo-600 md:flex"
                        onClick={() => handleHeaderSort('Teacher')}
                    >
                        Teacher / Grade {renderSortIcon('Teacher')}
                    </div>
                    <div 
                        className="hidden flex-[0.8] items-center gap-2 cursor-pointer hover:text-indigo-600 sm:flex"
                        onClick={() => handleHeaderSort('Tier')}
                    >
                        Tier {renderSortIcon('Tier')}
                    </div>
                    <div 
                        className="flex min-w-0 flex-[1.2] items-center gap-2 cursor-pointer hover:text-indigo-600"
                        onClick={() => handleHeaderSort('Progress')}
                    >
                        Plan Progress {renderSortIcon('Progress')}
                    </div>
                    <div className="w-auto shrink-0 text-right">Actions</div>
                </div>
            )}

            {Object.keys(processedData).length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <Filter size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No interventions match your filters.</p>
                    <button onClick={clearFilters} className="text-indigo-600 font-semibold text-sm hover:underline mt-2">Clear Filters</button>
                </div>
            ) : (
                Object.entries(processedData).map(([groupName, groupItems]: [string, InterventionRecord[]]) => {
                    const isCollapsed = collapsedGroups[groupName];
                    
                    return (
                    <div key={groupName} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        {groupBy !== 'None' && (
                            <div 
                                onClick={() => toggleGroup(groupName)}
                                className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>
                                        <ChevronRight size={18} />
                                    </span>
                                    <h3 className="font-bold text-slate-800 text-base">{groupName}</h3>
                                    <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {groupItems.length}
                                    </span>
                                </div>
                                {/* Group Summary Stats */}
                                <div className="hidden sm:flex items-center gap-6 text-xs text-slate-500 font-medium">
                                    <span>Avg Progress: <span className="text-slate-800 font-bold">{groupItems.length > 0 ? Math.round(groupItems.reduce((a,b)=>a+b.progress,0)/groupItems.length) : 0}%</span></span>
                                    {groupBy !== 'Tier' && (
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-rose-500" title="Tier 3"></span>
                                            <span>{groupItems.filter(i => i.tier === Tier.TIER_3).length} T3</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Items Container - Default to expanded (NOT collapsed) */}
                        {!isCollapsed && (
                            <div className={`p-4 ${layout === 'Cards' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'flex flex-col gap-0'}`}>
                                {groupItems.map((item) => (
                                    layout === 'Cards' ? (
                                        // CARD VIEW
                                        <div 
                                            key={item.id} 
                                            onClick={() => onStudentClick(item.studentName)}
                                            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group relative"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                                        <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${item.avatarSeed}&backgroundColor=e0e7ff`} alt={item.studentName} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{item.studentName}</h4>
                                                        <p className="text-[10px] text-slate-500">{item.grade} • {item.teacher}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    {getTierBadge(item.tier)}
                                                    {getWorkflowBadge(item.workflowStatus)}
                                                </div>
                                            </div>
                                            
                                            <div className="bg-slate-50 rounded-lg p-2 mb-3 border border-slate-100">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan</span>
                                                    <span className="text-[10px] font-bold text-indigo-600">{item.durationWeeks} wks</span>
                                                </div>
                                                <p className="text-xs font-semibold text-slate-700 truncate">{item.planName}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="flex justify-between text-[10px] mb-1">
                                                        <span className="text-slate-500 font-bold">Progress</span>
                                                        <span className="text-slate-800 font-bold">{item.progress}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${item.progress < 60 ? 'bg-rose-500' : item.progress < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${item.progress}%` }} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[10px] mb-1">
                                                        <span className="text-slate-500 font-bold">Attendance</span>
                                                        <span className="text-slate-800 font-bold">{item.attendance}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${item.attendance < 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${item.attendance}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Share Button (Cards) */}
                                            <div className="absolute top-2 right-2 flex items-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openWorkflowModal(item); }}
                                                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm"
                                                    title="Open intervention workflow"
                                                >
                                                    <CalendarClock size={14} />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleSharePlan(item); }}
                                                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm"
                                                    title="Share Lesson Plan"
                                                >
                                                    <Share2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // LIST VIEW
                                        <div 
                                            key={item.id}
                                            onClick={() => onStudentClick(item.studentName)} 
                                            className="group flex items-center justify-between gap-2 border-b border-slate-100 p-3 transition-colors last:border-0 cursor-pointer hover:bg-slate-50"
                                        >
                                            <div className="flex min-w-0 flex-[1.4] items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                                                    <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${item.avatarSeed}&backgroundColor=e0e7ff`} alt={item.studentName} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="truncate text-sm font-bold text-slate-800 group-hover:text-indigo-600">{item.studentName}</h4>
                                                    <p className="text-[10px] text-slate-500 hidden sm:block">{item.id}</p>
                                                </div>
                                            </div>

                                            <div className="hidden flex-1 md:block">
                                                <p className="text-xs font-semibold text-slate-700">{item.teacher}</p>
                                                <p className="text-[10px] text-slate-500">{item.grade}</p>
                                            </div>

                                            <div className="hidden flex-[0.8] sm:block">
                                                {getTierBadge(item.tier)}
                                            </div>

                                            <div className="min-w-0 flex-[1.2]">
                                                <div className="flex items-center gap-2">
                                                    {getProgressBar(item.progress)}
                                                    <span className="text-xs font-bold text-slate-700 w-8 text-right">{item.progress}%</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">{item.planName}</p>
                                                <div className="mt-1">{getWorkflowBadge(item.workflowStatus)}</div>
                                            </div>

                                            <div className="w-auto shrink-0 text-right flex justify-end gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openWorkflowModal(item); }}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                                                    title="Open intervention workflow"
                                                >
                                                    <CalendarClock size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleSharePlan(item); }}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                                                    title="Share Lesson Plan"
                                                >
                                                    <Share2 size={16} />
                                                </button>
                                                <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors">
                                                    <MoreHorizontal size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                )})
            )}
        </div>
      </div>
    </div>
  );
};

