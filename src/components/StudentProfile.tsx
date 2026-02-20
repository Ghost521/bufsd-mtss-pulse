import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Ear,
  Eye,
  FileBadge,
  FileText,
  Loader2,
  Mail,
  Pill,
  Save,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Tier,
  UserRole,
  type Intervention,
  type InterventionDataPoint,
  type ReadingAssessment,
  type ReadingStage,
  type StudentDetails,
  type StudentRosterItem,
} from '../types';
import { generateStudentProfileSummaryStream } from '../services/geminiService';
import { RichTextRenderer } from './RichTextRenderer';
import { ReferralModal } from './ReferralModal';
import { SidebarToggleButton } from './SidebarToggleButton';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { useStudents } from '../hooks/useStudents';
import { buildStudentProfileRecord, syncProfileWithRoster, type StudentProfileRecord } from '../lib/student-profile-record';
import { canAccessStudentNotes } from '../lib/role-access';
import { StudentNotesPanel } from './notes/StudentNotesPanel';
import { DEFAULT_READING_BENCHMARKS, normalizeGrade } from '../lib/reading-benchmarks';
import {
  FP_LEVEL_ORDER,
  LEXILE_LEVEL_SUMMARIES,
  fpLevelToIndex,
  getLexileSummaryForFpLevel,
  getStageForFpLevel,
  normalizeFpLevel,
} from '../lib/lexile-conversion';

type ProfileTab = 'overview' | 'reading' | 'interventions' | 'academics' | 'notes' | 'documents';
type AcademicFilter = 'All' | 'Math' | 'Reading';
type ReadingAssessmentDraft = {
  date: string;
  fAndPLevel: string;
  notes: string;
};

type ProfileDocument = {
  id: string;
  title: string;
  category: string;
  updated: string;
  status: 'Reviewed' | 'Needs Review' | 'Draft';
};

type SummarySections = {
  strengths: string[];
  risks: string[];
  actions: string[];
};
type AcademicChartPoint = {
  id: string;
  date: string;
  label: string;
  mathScore: number;
  readingScore: number;
};

interface StudentProfileProps {
  studentName: string;
  onBack: () => void;
  onMenuClick: () => void;
  onMessageClick?: () => void;
  currentUserRole: UserRole;
  currentUserName: string;
  currentUserId?: string | null;
}

const READING_LEVELS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
const ACADEMIC_FILTERS: AcademicFilter[] = ['All', 'Math', 'Reading'];
const PROFILE_TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'reading', label: 'Reading' },
  { id: 'interventions', label: 'Interventions' },
  { id: 'academics', label: 'Academics' },
  { id: 'notes', label: 'Notes' },
  { id: 'documents', label: 'Documents' },
];
const ACADEMIC_PROGRESS_FALLBACK: Array<{ label: string; mathScore: number; readingScore: number }> = [
  { label: 'Sep', mathScore: 64, readingScore: 61 },
  { label: 'Oct', mathScore: 70, readingScore: 66 },
  { label: 'Nov', mathScore: 73, readingScore: 69 },
  { label: 'Dec', mathScore: 75, readingScore: 71 },
  { label: 'Jan', mathScore: 79, readingScore: 74 },
  { label: 'Feb', mathScore: 81, readingScore: 77 },
  { label: 'Mar', mathScore: 84, readingScore: 80 },
];
const READING_STAGE_BANDS: Array<{
  stage: ReadingStage;
  minLevel: string;
  maxLevel: string;
  fill: string;
  textClassName: string;
}> = [
  { stage: 'Emergent', minLevel: 'A', maxLevel: 'C', fill: '#ecfdf5', textClassName: 'text-emerald-700' },
  { stage: 'Early', minLevel: 'D', maxLevel: 'I', fill: '#eff6ff', textClassName: 'text-blue-700' },
  { stage: 'Transitional', minLevel: 'J', maxLevel: 'P', fill: '#fff7ed', textClassName: 'text-orange-700' },
  { stage: 'Fluent', minLevel: 'Q', maxLevel: 'Z', fill: '#f5f3ff', textClassName: 'text-violet-700' },
  { stage: 'Advanced', minLevel: 'Z+', maxLevel: 'Z+', fill: '#fdf2f8', textClassName: 'text-pink-700' },
];

const createReadingAssessmentDraft = (seedLevel = 'M'): ReadingAssessmentDraft => ({
  date: new Date().toISOString().slice(0, 10),
  fAndPLevel: normalizeFpLevel(seedLevel) ?? 'M',
  notes: '',
});

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSentence = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeAiSummary = (rawSummary: string, studentName: string): string => {
  const trimmed = rawSummary.trim();
  if (!trimmed) return '';

  const collapsed = trimmed.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/\u2022/g, ' ');
  const tokens = collapsed
    .split(/(?<=[.!?])\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 12);

  const uniqueSentences: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    let sentence = token.replace(
      new RegExp(`^#{0,3}\\s*Student Profile Summary:\\s*${escapeRegex(studentName)}\\s*`, 'i'),
      '',
    );
    sentence = sentence.replace(/[#*_`]/g, ' ').replace(/\s+/g, ' ').trim();
    sentence = sentence.replace(/\b(\w+)(\s+\1\b){1,}/gi, '$1');
    if (!sentence) continue;
    const normalized = normalizeSentence(sentence);
    if (!normalized || seen.has(normalized)) continue;
    if (sentence.length < 24 || sentence.length > 220) continue;
    seen.add(normalized);
    uniqueSentences.push(sentence);
  }

  const narrative = uniqueSentences.slice(0, 8).join('\n\n');
  return `### Student Profile Summary: ${studentName}\n\n${narrative}`;
};

const buildSummarySections = (summary: string, student: StudentDetails | null): SummarySections => {
  const strengths: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  if (student) {
    const completedCount = student.interventions.filter((item) => item.status.toLowerCase() === 'completed').length;
    strengths.push(`${student.name} maintains ${student.attendance}% attendance and a ${student.gpa} GPA baseline.`);
    strengths.push(`${completedCount} intervention plan(s) have already been completed.`);
    strengths.push(`Current support profile is ${student.support.planType} with active accommodations documented.`);

    const recentBehavior = student.recentActivity.find((item) => item.type.toLowerCase() === 'behavior');
    risks.push(`Reading level (${student.readingLevel}) should be tracked against current grade-level benchmarks.`);
    if (recentBehavior) risks.push(`Recent behavior note: ${recentBehavior.note}`);
    risks.push(`Tier placement (${student.tier}) indicates ongoing targeted support is still needed.`);

    actions.push(student.aiRecommendations[0]?.action ?? 'Schedule weekly intervention follow-up checkpoints.');
    actions.push(student.aiRecommendations[1]?.action ?? 'Share a concise family update with next-step supports.');
    actions.push('Confirm owner and date for each intervention action in the next MTSS meeting.');
  }

  const parsedLines = summary
    .replace(/^###.*$/gm, '')
    .split(/\n+/)
    .map((line) => line.replace(/[#*_`]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 24 && line.length < 180);

  parsedLines.forEach((line) => {
    const normalized = normalizeSentence(line);
    if (!normalized) return;
    if (/(recommend|action|implement|enroll|schedule|next step)/.test(normalized)) actions.push(line);
    if (/(below|risk|lag|missing|concern|struggle|absent|disrupt)/.test(normalized)) risks.push(line);
    if (/(progress|strong|improv|stable|attendance|success)/.test(normalized)) strengths.push(line);
  });

  const uniq = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()))).slice(0, 3);
  return { strengths: uniq(strengths), risks: uniq(risks), actions: uniq(actions) };
};

const getTierColor = (tier: Tier): string => {
  if (tier === 'Tier 1') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (tier === 'Tier 2') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-rose-100 text-rose-800 border-rose-200';
};

const getDocumentStatusColor = (status: ProfileDocument['status']): string => {
  if (status === 'Reviewed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'Needs Review') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const toAcademicLabel = (value: string): string => {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, { month: 'short' });
  }
  return value.trim().slice(0, 3) || value;
};

const toLocalTimestamp = (value: Date | null): string =>
  value
    ? value.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Not yet generated';

const formatIsoDateLabel = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const cloneIntervention = (intervention: Intervention): Intervention => ({
  ...intervention,
  dataPoints: intervention.dataPoints.map((point) => ({ ...point })),
  notes: (intervention.notes ?? []).map((note) => ({
    ...note,
    revisions: note.revisions.map((revision) => ({ ...revision })),
  })),
});

export const StudentProfile: React.FC<StudentProfileProps> = ({
  studentName,
  onBack,
  onMenuClick,
  onMessageClick,
  currentUserRole,
  currentUserName,
  currentUserId,
}) => {
  const profileCollection = useTenantCollection<StudentProfileRecord>('student-profiles');
  const seedProfile = profileCollection.createMutation.mutate;
  const masterStudentsApi = useStudents('master');
  const classStudentsApi = useStudents('class');
  const seededProfileIdsRef = useRef<Set<string>>(new Set());
  const [student, setStudent] = useState<StudentProfileRecord | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [draftStudent, setDraftStudent] = useState<StudentProfileRecord | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profileSummary, setProfileSummary] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<Date | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [academicFilter, setAcademicFilter] = useState<AcademicFilter>('All');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isReadingAssessmentEditorOpen, setIsReadingAssessmentEditorOpen] = useState(false);
  const [editingReadingAssessmentId, setEditingReadingAssessmentId] = useState<string | null>(null);
  const [readingAssessmentDraft, setReadingAssessmentDraft] = useState<ReadingAssessmentDraft>(() =>
    createReadingAssessmentDraft('M'),
  );
  const [selectedInterventionId, setSelectedInterventionId] = useState<number | null>(null);
  const [isInterventionEditing, setIsInterventionEditing] = useState(false);
  const [interventionDraft, setInterventionDraft] = useState<Intervention | null>(null);
  const [interventionOriginal, setInterventionOriginal] = useState<Intervention | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const canViewStudentNotes = canAccessStudentNotes(currentUserRole);
  const staffDisplayName = currentUserName.trim().length > 0 ? currentUserName : 'Staff Member';

  const loadProfileSummary = useCallback(async (details: StudentProfileRecord) => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    setProfileSummary('');
    try {
      await generateStudentProfileSummaryStream({ ...details, name: details.name }, [], (chunk) => {
        setProfileSummary((previous) => previous + chunk);
      });
      setSummaryUpdatedAt(new Date());
    } catch (error) {
      console.error(error);
      setSummaryError('Unable to generate profile summary. Please try again.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  const students = useMemo(() => {
    const merged = [
      ...(masterStudentsApi.studentsQuery.data?.rows ?? []),
      ...(classStudentsApi.studentsQuery.data?.rows ?? []),
    ] as Array<StudentRosterItem & { teacher?: string }>;
    const seen = new Set<string>();
    return merged.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [classStudentsApi.studentsQuery.data?.rows, masterStudentsApi.studentsQuery.data?.rows]);

  const persistProfile = useCallback(
    (nextProfile: StudentProfileRecord) => {
      const exists = profileCollection.query.data?.rows?.some((row) => row.id === nextProfile.id) ?? false;
      if (exists) {
        profileCollection.updateMutation.mutate({
          id: nextProfile.id,
          patch: nextProfile,
        });
        return;
      }
      profileCollection.createMutation.mutate(nextProfile);
    },
    [profileCollection.createMutation, profileCollection.query.data?.rows, profileCollection.updateMutation],
  );

  useEffect(() => {
    if (!studentName) return;

    const rosterMatch = students.find((row) => row.name === studentName);
    const existing = profileCollection.query.data?.rows?.find((row) =>
      rosterMatch ? row.id === rosterMatch.id || row.name === studentName : row.name === studentName
    );
    let nextStudent: StudentProfileRecord | null = null;

    if (existing && rosterMatch) {
      nextStudent = syncProfileWithRoster(existing, {
        ...rosterMatch,
        teacher: rosterMatch.teacher ?? existing.teacher,
      });
    } else if (existing) {
      nextStudent = existing;
    } else if (rosterMatch) {
      nextStudent = buildStudentProfileRecord({
        ...rosterMatch,
        teacher: rosterMatch.teacher ?? 'Assigned Teacher',
      });
      if (!seededProfileIdsRef.current.has(nextStudent.id)) {
        seededProfileIdsRef.current.add(nextStudent.id);
        seedProfile(nextStudent);
      }
    }

    if (!nextStudent) {
      const syntheticId = `STU-${studentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      nextStudent = buildStudentProfileRecord({
        id: syntheticId,
        name: studentName,
        grade: '4th',
        tier: Tier.TIER_1,
        gpa: '3.0',
        attendance: 95,
        readingLevel: 'M',
        alerts: 0,
        teacher: 'Assigned Teacher',
      });
      if (!seededProfileIdsRef.current.has(nextStudent.id)) {
        seededProfileIdsRef.current.add(nextStudent.id);
        seedProfile(nextStudent);
      }
    }

    setStudent(nextStudent);

    setActiveTab('overview');
    setAcademicFilter('All');
    setSelectedMonth(null);
    setIsReadingAssessmentEditorOpen(false);
    setEditingReadingAssessmentId(null);
    setReadingAssessmentDraft(createReadingAssessmentDraft(nextStudent.readingLevel));

    setIsEditing(false);
    setDraftStudent(null);
    setAvatarUrl(nextStudent.avatarUrl ?? null);
    setDraftAvatarUrl(nextStudent.avatarUrl ?? null);
    setSelectedInterventionId(null);
    setIsInterventionEditing(false);
    setInterventionDraft(null);
    setInterventionOriginal(null);

    setShowSummary(true);
    setIsSummaryExpanded(typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true);
    setSummaryUpdatedAt(null);

    void loadProfileSummary(nextStudent);
  }, [studentName, loadProfileSummary, profileCollection.query.data?.rows, seedProfile, students]);

  useEffect(() => {
    if (activeTab !== 'academics') return;
    const node = chartContainerRef.current;
    if (!node) return;

    const updateWidth = () => {
      const width = Math.floor(node.clientWidth);
      setChartWidth(width > 0 ? width : 0);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [activeTab]);

  useEffect(() => {
    if (!canViewStudentNotes && activeTab === 'notes') {
      setActiveTab('overview');
    }
  }, [activeTab, canViewStudentNotes]);

  const hasUnsavedChanges = useMemo(() => {
    if (!isEditing || !student || !draftStudent) return false;
    return (
      draftStudent.tier !== student.tier ||
      draftStudent.readingLevel !== student.readingLevel ||
      draftAvatarUrl !== avatarUrl
    );
  }, [avatarUrl, draftAvatarUrl, draftStudent, isEditing, student]);

  const hasUnsavedInterventionChanges = useMemo(() => {
    if (!isInterventionEditing || !interventionDraft || !interventionOriginal) return false;
    return JSON.stringify(interventionDraft) !== JSON.stringify(interventionOriginal);
  }, [interventionDraft, interventionOriginal, isInterventionEditing]);

  const hasAnyUnsavedChanges = hasUnsavedChanges || hasUnsavedInterventionChanges;

  const confirmDiscardEdits = useCallback((): boolean => {
    if (!hasUnsavedChanges && !hasUnsavedInterventionChanges) return true;
    if (hasUnsavedChanges && hasUnsavedInterventionChanges) {
      return window.confirm('You have unsaved profile and intervention changes. Discard them?');
    }
    if (hasUnsavedInterventionChanges) {
      return window.confirm('You have unsaved intervention changes. Discard them?');
    }
    return window.confirm('You have unsaved profile changes. Discard them?');
  }, [hasUnsavedChanges, hasUnsavedInterventionChanges]);

  useEffect(() => {
    if (!hasAnyUnsavedChanges) return;
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    return () => window.removeEventListener('beforeunload', beforeUnloadHandler);
  }, [hasAnyUnsavedChanges]);

  const currentStudent = isEditing && draftStudent ? draftStudent : student;
  const currentAvatar = isEditing ? draftAvatarUrl : avatarUrl;
  const resolvedAvatar =
    currentAvatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(studentName)}&backgroundColor=e0e7ff`;

  const cleanedSummary = useMemo(() => sanitizeAiSummary(profileSummary, studentName), [profileSummary, studentName]);
  const summarySections = useMemo(() => buildSummarySections(cleanedSummary, student), [cleanedSummary, student]);

  const interventions = currentStudent?.interventions ?? [];
  const selectedIntervention =
    selectedInterventionId === null ? null : interventions.find((item) => item.id === selectedInterventionId) ?? null;
  const activeInterventions = interventions.filter((item) => item.status.toLowerCase() === 'active');
  const completedInterventions = interventions.filter((item) => item.status.toLowerCase() === 'completed');
  const averageInterventionProgress =
    interventions.length > 0
      ? Math.round(interventions.reduce((total, item) => total + item.progress, 0) / interventions.length)
      : 0;

  const readingAssessments = useMemo(
    () => currentStudent?.readingAssessments ?? [],
    [currentStudent?.readingAssessments],
  );
  const sortedReadingAssessments = useMemo(
    () => [...readingAssessments].sort((left, right) => left.date.localeCompare(right.date)),
    [readingAssessments],
  );
  const currentReadingSummary = useMemo(
    () => getLexileSummaryForFpLevel(currentStudent?.readingLevel ?? ''),
    [currentStudent?.readingLevel],
  );
  const readingChartPoints = useMemo(
    () =>
      sortedReadingAssessments
        .map((assessment) => {
          const normalizedLevel = normalizeFpLevel(assessment.fAndPLevel);
          const levelIndex = normalizedLevel ? fpLevelToIndex(normalizedLevel) : null;
          if (!normalizedLevel || levelIndex === null) return null;
          const summary = getLexileSummaryForFpLevel(normalizedLevel);
          const stage = getStageForFpLevel(normalizedLevel);
          const parsedDate = new Date(`${assessment.date}T00:00:00`);
          const dateLabel = Number.isNaN(parsedDate.getTime())
            ? assessment.date
            : parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return {
            id: assessment.id,
            date: assessment.date,
            dateLabel,
            fAndPLevel: normalizedLevel,
            levelIndex,
            stage: stage ?? 'Transitional',
            lexileLabel: summary?.lexileLabel ?? 'No Lexile mapping',
            atosLabel: summary?.atosLabel ?? 'N/A',
            notes: assessment.notes ?? '',
          };
        })
        .filter((point): point is NonNullable<typeof point> => point !== null),
    [sortedReadingAssessments],
  );
  const latestReadingChartPoint =
    readingChartPoints.length > 0 ? readingChartPoints[readingChartPoints.length - 1] : null;
  const readingGrowthDelta =
    readingChartPoints.length > 1
      ? readingChartPoints[readingChartPoints.length - 1].levelIndex - readingChartPoints[0].levelIndex
      : null;
  const gradeTargetBand = useMemo(() => {
    const normalizedGrade = normalizeGrade(currentStudent?.grade ?? '');
    if (!normalizedGrade) return null;
    return DEFAULT_READING_BENCHMARKS[normalizedGrade] ?? null;
  }, [currentStudent?.grade]);
  const gradeTargetRange = useMemo(() => {
    if (!gradeTargetBand) return null;
    const minIndex = fpLevelToIndex(gradeTargetBand.min);
    const maxIndex = fpLevelToIndex(gradeTargetBand.max);
    if (minIndex === null || maxIndex === null) return null;
    return { minIndex, maxIndex };
  }, [gradeTargetBand]);
  const stageRanges = useMemo(
    () =>
      READING_STAGE_BANDS.map((band) => {
        const minIndex = fpLevelToIndex(band.minLevel);
        const maxIndex = fpLevelToIndex(band.maxLevel);
        return {
          ...band,
          minIndex,
          maxIndex,
        };
      }).filter(
        (
          band,
        ): band is {
          stage: ReadingStage;
          minLevel: string;
          maxLevel: string;
          fill: string;
          textClassName: string;
          minIndex: number;
          maxIndex: number;
        } => band.minIndex !== null && band.maxIndex !== null,
      ),
    [],
  );

  const academicProgress = useMemo(
    () => currentStudent?.academicProgress ?? [],
    [currentStudent?.academicProgress],
  );
  const academicChartData = useMemo<AcademicChartPoint[]>(() => {
    if (academicProgress.length === 0) {
      return ACADEMIC_PROGRESS_FALLBACK.map((point, index) => ({
        id: `fallback-${index + 1}`,
        date: point.label,
        label: point.label,
        mathScore: point.mathScore,
        readingScore: point.readingScore,
      }));
    }

    return [...academicProgress]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((point) => ({
        id: point.id,
        date: point.date,
        label: toAcademicLabel(point.date),
        mathScore: Math.max(0, Math.min(100, Math.round(point.mathScore))),
        readingScore: Math.max(0, Math.min(100, Math.round(point.readingScore))),
      }));
  }, [academicProgress]);
  const showMathSeries = academicFilter !== 'Reading';
  const showReadingSeries = academicFilter !== 'Math';

  const academicNotes = useMemo(() => {
    if (!currentStudent) return [];
    return currentStudent.recentActivity.filter((item) => {
      if (item.type.toLowerCase() !== 'academic') return false;
      if (selectedMonth && !item.date.toLowerCase().startsWith(selectedMonth.toLowerCase())) return false;
      if (academicFilter === 'All') return true;
      return item.tags?.some((tag) => tag.toLowerCase().includes(academicFilter.toLowerCase())) ?? false;
    });
  }, [academicFilter, currentStudent, selectedMonth]);

  const profileDocuments = useMemo<ProfileDocument[]>(() => {
    if (!currentStudent) return [];

    const docs: ProfileDocument[] = [];
    if (currentStudent.support.planType !== 'None') {
      docs.push({
        id: 'doc-support-plan',
        title: `${currentStudent.support.planType} Summary`,
        category: 'Support Plan',
        updated: currentStudent.support.nextReviewDate ?? 'May 20, 2025',
        status: 'Reviewed',
      });
    }
    docs.push({
      id: 'doc-screening',
      title: 'Health Screening Snapshot',
      category: 'Health',
      updated: currentStudent.medical.visionScreening.date,
      status: 'Reviewed',
    });

    currentStudent.recentActivity.slice(0, 3).forEach((activity, index) => {
      docs.push({
        id: `doc-activity-${index}`,
        title: `${activity.type} Note (${activity.date})`,
        category: 'Activity',
        updated: activity.date,
        status: index === 0 ? 'Needs Review' : 'Draft',
      });
    });

    return docs;
  }, [currentStudent]);

  const profileTabs = useMemo(
    () => (canViewStudentNotes ? PROFILE_TABS : PROFILE_TABS.filter((tab) => tab.id !== 'notes')),
    [canViewStudentNotes],
  );
  const tabIds = profileTabs.map((tab) => tab.id);

  const resetEditState = useCallback(() => {
    setIsEditing(false);
    setDraftStudent(null);
    setDraftAvatarUrl(null);
  }, []);

  const resetInterventionEditState = useCallback(() => {
    setIsInterventionEditing(false);
    setInterventionDraft(null);
    setInterventionOriginal(null);
  }, []);

  const applyInterventionUpdate = useCallback(
    (updatedIntervention: Intervention, shouldPersist = true) => {
      if (!student) return;
      const timestamp = new Date().toISOString();
      const normalizeAndUpdate = (rows: Intervention[]): Intervention[] =>
        rows.map((item) => (item.id === updatedIntervention.id ? cloneIntervention(updatedIntervention) : item));

      const nextStudent: StudentProfileRecord = {
        ...student,
        interventions: normalizeAndUpdate(student.interventions),
        updatedAt: timestamp,
      };
      setStudent(nextStudent);
      setDraftStudent((previous) =>
        previous
          ? {
              ...previous,
              interventions: normalizeAndUpdate(previous.interventions),
              updatedAt: timestamp,
            }
          : previous,
      );
      if (shouldPersist) persistProfile(nextStudent);
    },
    [persistProfile, student],
  );

  const handleStartEdit = () => {
    if (!student) return;
    if (!confirmDiscardEdits()) return;
    resetInterventionEditState();
    setDraftStudent({ ...student });
    setDraftAvatarUrl(avatarUrl);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!draftStudent) return;
    const nextStudent: StudentProfileRecord = {
      ...draftStudent,
      name: studentName,
      avatarUrl: draftAvatarUrl ?? undefined,
      updatedAt: new Date().toISOString(),
    };
    setStudent(nextStudent);
    setAvatarUrl(draftAvatarUrl);
    persistProfile(nextStudent);
    resetEditState();
  };

  const handleNotesChange = (nextNotes: StudentProfileRecord['notes']) => {
    if (!student) return;
    const nextStudent: StudentProfileRecord = {
      ...student,
      notes: nextNotes,
      updatedAt: new Date().toISOString(),
    };
    setStudent(nextStudent);
    setDraftStudent((previous) => (previous ? { ...previous, notes: nextNotes } : previous));
    persistProfile(nextStudent);
  };

  const applyReadingAssessmentsUpdate = useCallback(
    (nextAssessments: NonNullable<StudentProfileRecord['readingAssessments']>) => {
      if (!student) return;
      const timestamp = new Date().toISOString();
      const latestAssessment = [...nextAssessments].sort((left, right) => left.date.localeCompare(right.date)).at(-1);
      const nextReadingLevel = latestAssessment?.fAndPLevel ?? student.readingLevel;
      const nextStudent: StudentProfileRecord = {
        ...student,
        readingLevel: nextReadingLevel,
        readingAssessments: nextAssessments,
        updatedAt: timestamp,
      };
      setStudent(nextStudent);
      setDraftStudent((previous) =>
        previous
          ? {
              ...previous,
              readingLevel: nextReadingLevel,
              readingAssessments: nextAssessments,
              updatedAt: timestamp,
            }
          : previous,
      );
      persistProfile(nextStudent);
    },
    [persistProfile, student],
  );

  const resetReadingAssessmentEditor = useCallback(
    (seedLevel: string) => {
      setEditingReadingAssessmentId(null);
      setIsReadingAssessmentEditorOpen(false);
      setReadingAssessmentDraft(createReadingAssessmentDraft(seedLevel));
    },
    [],
  );

  const handleStartReadingAssessmentCreate = () => {
    setEditingReadingAssessmentId(null);
    setIsReadingAssessmentEditorOpen(true);
    setReadingAssessmentDraft(createReadingAssessmentDraft(student?.readingLevel ?? 'M'));
  };

  const handleStartReadingAssessmentEdit = (assessment: ReadingAssessment) => {
    setEditingReadingAssessmentId(assessment.id);
    setIsReadingAssessmentEditorOpen(true);
    setReadingAssessmentDraft({
      date: assessment.date,
      fAndPLevel: normalizeFpLevel(assessment.fAndPLevel) ?? assessment.fAndPLevel,
      notes: assessment.notes ?? '',
    });
  };

  const handleSaveReadingAssessment = () => {
    if (!student) return;
    if (!readingAssessmentDraft.date.trim()) {
      window.alert('Assessment date is required.');
      return;
    }
    const normalizedLevel = normalizeFpLevel(readingAssessmentDraft.fAndPLevel);
    if (!normalizedLevel) {
      window.alert('Please select a valid Fountas & Pinnell level from the chart.');
      return;
    }

    const timestamp = new Date().toISOString();
    if (editingReadingAssessmentId) {
      const target = readingAssessments.find((item) => item.id === editingReadingAssessmentId);
      if (!target) return;
      const nextAssessments = readingAssessments.map((assessment) =>
        assessment.id === editingReadingAssessmentId
          ? {
              ...assessment,
              date: readingAssessmentDraft.date,
              fAndPLevel: normalizedLevel,
              notes: readingAssessmentDraft.notes.trim() || undefined,
              updatedAt: timestamp,
            }
          : assessment,
      );
      applyReadingAssessmentsUpdate(nextAssessments);
      resetReadingAssessmentEditor(normalizedLevel);
      return;
    }

    const createdAssessment: ReadingAssessment = {
      id: `reading-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
      date: readingAssessmentDraft.date,
      fAndPLevel: normalizedLevel,
      notes: readingAssessmentDraft.notes.trim() || undefined,
      enteredByName: staffDisplayName,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    applyReadingAssessmentsUpdate([...readingAssessments, createdAssessment]);
    resetReadingAssessmentEditor(normalizedLevel);
  };

  const handleDeleteReadingAssessment = (assessmentId: string) => {
    const target = readingAssessments.find((item) => item.id === assessmentId);
    if (!target) return;
    if (!window.confirm('Remove this reading assessment?')) return;
    applyReadingAssessmentsUpdate(readingAssessments.filter((assessment) => assessment.id !== assessmentId));
    if (editingReadingAssessmentId === assessmentId) {
      resetReadingAssessmentEditor(student?.readingLevel ?? 'M');
    }
  };

  const handleSelectIntervention = (interventionId: number) => {
    if (selectedInterventionId === interventionId) {
      if (hasUnsavedInterventionChanges && !window.confirm('Discard unsaved intervention changes?')) return;
      setSelectedInterventionId(null);
      resetInterventionEditState();
      return;
    }
    if (hasUnsavedInterventionChanges && !window.confirm('Discard unsaved intervention changes?')) return;
    setSelectedInterventionId(interventionId);
    resetInterventionEditState();
  };

  const handleStartInterventionEdit = () => {
    if (!selectedIntervention) return;
    const source = cloneIntervention(selectedIntervention);
    setInterventionOriginal(source);
    setInterventionDraft(cloneIntervention(source));
    setIsInterventionEditing(true);
  };

  const handleCancelInterventionEdit = () => {
    if (hasUnsavedInterventionChanges && !window.confirm('Discard unsaved intervention changes?')) return;
    resetInterventionEditState();
  };

  const handleSaveInterventionEdit = () => {
    if (!interventionDraft) return;
    applyInterventionUpdate(interventionDraft, true);
    resetInterventionEditState();
  };

  const handleInterventionFieldChange = (field: keyof Intervention, value: string | number) => {
    setInterventionDraft((previous) => {
      if (!previous) return previous;
      if (field === 'progress' || field === 'baselineScore' || field === 'goalScore') {
        const numericValue =
          typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : previous[field];
        if (field === 'progress') {
          return { ...previous, progress: Math.max(0, Math.min(100, Math.round(numericValue))) };
        }
        return { ...previous, [field]: numericValue };
      }
      return { ...previous, [field]: String(value) };
    });
  };

  const handleAddInterventionDataPoint = () => {
    setInterventionDraft((previous) => {
      if (!previous) return previous;
      const nextIndex = previous.dataPoints.length + 1;
      const nextPoint: InterventionDataPoint = {
        date: `Week ${nextIndex}`,
        score: previous.baselineScore,
      };
      return { ...previous, dataPoints: [...previous.dataPoints, nextPoint] };
    });
  };

  const handleInterventionDataPointChange = (
    dataPointIndex: number,
    field: keyof InterventionDataPoint,
    value: string | number,
  ) => {
    setInterventionDraft((previous) => {
      if (!previous) return previous;
      const nextPoints = previous.dataPoints.map((point, index) => {
        if (index !== dataPointIndex) return point;
        if (field === 'score') {
          const numericValue =
            typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : point.score;
          return { ...point, score: numericValue };
        }
        return { ...point, [field]: String(value) };
      });
      return { ...previous, dataPoints: nextPoints };
    });
  };

  const handleRemoveInterventionDataPoint = (dataPointIndex: number) => {
    setInterventionDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        dataPoints: previous.dataPoints.filter((_, index) => index !== dataPointIndex),
      };
    });
  };

  const handleInterventionNotesChange = (interventionId: number, nextNotes: NonNullable<Intervention['notes']>) => {
    const source = student?.interventions.find((item) => item.id === interventionId);
    if (!source) return;
    const updatedIntervention: Intervention = {
      ...source,
      notes: nextNotes,
    };
    applyInterventionUpdate(updatedIntervention, true);
    if (interventionDraft?.id === interventionId) {
      setInterventionDraft((previous) => (previous ? { ...previous, notes: nextNotes } : previous));
    }
    if (interventionOriginal?.id === interventionId) {
      setInterventionOriginal((previous) => (previous ? { ...previous, notes: nextNotes } : previous));
    }
  };

  const handleCancelEdit = () => {
    if (!confirmDiscardEdits()) return;
    resetEditState();
  };

  const handleBackClick = () => {
    if (!confirmDiscardEdits()) return;
    resetEditState();
    setSelectedInterventionId(null);
    resetInterventionEditState();
    resetReadingAssessmentEditor(student?.readingLevel ?? 'M');
    onBack();
  };

  const handleTabChange = (nextTab: ProfileTab) => {
    if (nextTab === activeTab) return;
    if (!confirmDiscardEdits()) return;
    resetEditState();
    if (nextTab !== 'interventions') setSelectedInterventionId(null);
    if (nextTab !== 'reading') resetReadingAssessmentEditor(student?.readingLevel ?? 'M');
    resetInterventionEditState();
    setActiveTab(nextTab);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tabId: ProfileTab) => {
    const currentIndex = tabIds.indexOf(tabId);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabIds.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabIds.length - 1;
    if (nextIndex === currentIndex) return;

    event.preventDefault();
    const nextTab = tabIds[nextIndex];
    handleTabChange(nextTab);
    const nextButton = document.getElementById(`student-profile-tab-${nextTab}`) as HTMLButtonElement | null;
    nextButton?.focus();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isEditing) return;

    const reader = new FileReader();
    reader.onloadend = () => setDraftAvatarUrl((reader.result as string) ?? null);
    reader.readAsDataURL(file);
  };

  const retrySummary = () => {
    if (!student) return;
    void loadProfileSummary(student);
  };

  if (!currentStudent) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-7xl space-y-6 pb-20">
      <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />

      <ReferralModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
        defaultStudentId={currentStudent.id}
        onViewQueue={() => {
          setIsReferralModalOpen(false);
          handleTabChange('interventions');
        }}
      />

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-slate-50 to-transparent" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <SidebarToggleButton
              onClick={onMenuClick}
              className="lg:hidden -mr-2 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
              iconSize={20}
            />
            <button
              onClick={handleBackClick}
              className="-ml-2 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Back to previous page"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex items-center gap-5">
              <div className="group/avatar relative">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md ring-1 ring-slate-100 transition-all duration-300 group-hover/avatar:ring-indigo-200">
                  <img src={resolvedAvatar} alt={currentStudent.name} className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => isEditing && avatarInputRef.current?.click()}
                  aria-label="Upload profile photo"
                  disabled={!isEditing}
                  className="absolute inset-0 z-20 flex items-center justify-center rounded-full border-4 border-transparent bg-slate-900/40 opacity-0 transition-opacity group-hover/avatar:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
                >
                  <Camera size={20} className="text-white" />
                </button>
                <div
                  className={`pointer-events-none absolute -bottom-1 -right-1 z-30 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm ${
                    currentStudent.tier === 'Tier 1'
                      ? 'bg-emerald-500'
                      : currentStudent.tier === 'Tier 2'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                >
                  {currentStudent.tier.split(' ')[1]}
                </div>
              </div>

              <div>
                <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
                  {currentStudent.name}
                  {isEditing && draftStudent ? (
                    <select
                      value={draftStudent.tier}
                      onChange={(event) => setDraftStudent({ ...draftStudent, tier: event.target.value as Tier })}
                      className="rounded border border-indigo-300 bg-white px-2 py-0.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Tier 1">Tier 1</option>
                      <option value="Tier 2">Tier 2</option>
                      <option value="Tier 3">Tier 3</option>
                    </select>
                  ) : (
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${getTierColor(currentStudent.tier)}`}>
                      {currentStudent.tier}
                    </span>
                  )}
                </h1>
                <div className="mt-1.5 flex items-center gap-3 text-sm font-medium text-slate-500">
                  <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    ID: {currentStudent.id}
                  </span>
                  <span className="text-slate-300">&middot;</span>
                  <span>{currentStudent.grade}</span>
                  <span className="text-slate-300">&middot;</span>
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Enrolled
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pl-14 md:pl-0">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                >
                  <Save size={16} />
                  Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <X size={16} />
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <FileText size={16} />
                Edit Profile
              </button>
            )}
            <button
              onClick={onMessageClick}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Mail size={16} />
              Message Parents
            </button>
            <button
              onClick={() => setIsReferralModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-100"
            >
              <ShieldAlert size={16} />
              New Referral
            </button>
          </div>
        </div>
      </div>

      {showSummary && (
        <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-1 shadow-md">
          <div className="relative overflow-hidden rounded-[10px] bg-white/95 p-5 backdrop-blur-sm md:p-6">
            <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-5">
              <Sparkles size={120} />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-indigo-900">
                    <span className="rounded-lg bg-indigo-100 p-1.5">
                      <BrainCircuit size={18} className="text-indigo-600" />
                    </span>
                    {currentStudent.name}&apos;s AI Profile Summary
                  </h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Last updated: {toLocalTimestamp(summaryUpdatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSummaryExpanded((current) => !current)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 md:hidden"
                  >
                    {isSummaryExpanded ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => setShowSummary(false)}
                    className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Dismiss AI summary"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className={`${isSummaryExpanded ? 'block' : 'hidden'} md:block`}>
                {summaryError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle size={16} />
                      {summaryError}
                    </div>
                    <button
                      onClick={retrySummary}
                      className="mt-2 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Retry Summary
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">Key Strengths</p>
                        <ul className="space-y-1 text-sm text-emerald-900">
                          {summarySections.strengths.map((item, index) => (
                            <li key={`strength-${index}`} className="flex gap-2">
                              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">Risk Signals</p>
                        <ul className="space-y-1 text-sm text-amber-900">
                          {summarySections.risks.map((item, index) => (
                            <li key={`risk-${index}`} className="flex gap-2">
                              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-700">Recommended Actions</p>
                        <ul className="space-y-1 text-sm text-indigo-900">
                          {summarySections.actions.map((item, index) => (
                            <li key={`action-${index}`} className="flex gap-2">
                              <BrainCircuit size={14} className="mt-0.5 shrink-0 text-indigo-600" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {isLoadingSummary && !cleanedSummary ? (
                      <div className="mt-4 max-w-3xl animate-pulse space-y-2">
                        <div className="h-4 w-3/4 rounded bg-indigo-50" />
                        <div className="h-4 w-full rounded bg-indigo-50" />
                        <div className="h-4 w-5/6 rounded bg-indigo-50" />
                      </div>
                    ) : cleanedSummary ? (
                      <details className="mt-4 rounded-lg border border-slate-200 bg-white">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">
                          Full Narrative Summary
                        </summary>
                        <div className="border-t border-slate-100 px-3 py-3">
                          <RichTextRenderer content={cleanedSummary} variant="dark" isTyping={isLoadingSummary} />
                        </div>
                      </details>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!showSummary && (
        <button
          onClick={() => setShowSummary(true)}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
        >
          Show AI Summary
        </button>
      )}

      <div className="border-b border-slate-200">
        <div role="tablist" aria-label="Student profile sections" className="flex gap-2 overflow-x-auto pb-1">
          {profileTabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`student-profile-tab-${tab.id}`}
                role="tab"
                tabIndex={selected ? 0 : -1}
                aria-selected={selected}
                aria-controls={`student-profile-panel-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                className={`relative whitespace-nowrap rounded-t-lg px-3 pb-3 pt-2 text-sm font-bold transition-colors ${
                  selected ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {selected && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-indigo-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && (
      <section
        id="student-profile-panel-overview"
        role="tabpanel"
        aria-labelledby="student-profile-tab-overview"
        className="space-y-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="rounded-md bg-indigo-50 p-1.5 text-indigo-600">
                <Clock size={16} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">Attendance</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${currentStudent.attendance < 90 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {currentStudent.attendance}%
              </span>
              <span className="text-xs font-medium uppercase text-slate-400">YTD</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="rounded-md bg-blue-50 p-1.5 text-blue-600">
                <BookOpen size={16} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">Reading Level</span>
            </div>
            <div className="flex items-baseline gap-2">
              {isEditing && draftStudent ? (
                <select
                  value={draftStudent.readingLevel}
                  onChange={(event) => setDraftStudent({ ...draftStudent, readingLevel: event.target.value })}
                  className="cursor-pointer border-b-2 border-indigo-200 bg-transparent text-xl font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  {READING_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-2xl font-bold text-slate-800">{currentStudent.readingLevel}</span>
              )}
              <span className="text-xs font-medium uppercase text-slate-400">F&P</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="rounded-md bg-violet-50 p-1.5 text-violet-600">
                <Activity size={16} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">GPA</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800">{currentStudent.gpa}</span>
              <span className="text-xs font-medium uppercase text-slate-400">Scale 4.0</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={20} />
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">Student Snapshot</h3>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-700">
                <FileBadge size={14} />
                Support Profile
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Plan Type</span>
                  <span className={`font-bold ${currentStudent.support.planType !== 'None' ? 'text-indigo-600' : 'text-slate-700'}`}>
                    {currentStudent.support.planType}
                  </span>
                </div>
                {currentStudent.support.primaryDisability && (
                  <div className="text-sm">
                    <span className="mb-1 block text-slate-500">Primary Disability</span>
                    <span className="block font-medium leading-snug text-slate-800">{currentStudent.support.primaryDisability}</span>
                  </div>
                )}
                {currentStudent.support.accommodations.length > 0 && (
                  <div>
                    <span className="mb-1 block text-xs text-slate-500">Accommodations</span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentStudent.support.accommodations.map((accommodation, index) => (
                        <span
                          key={`${accommodation}-${index}`}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"
                        >
                          {accommodation}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-700">
                <Stethoscope size={14} />
                Health and Safety
              </h4>
              <div className="space-y-3">
                <div>
                  <span className="mb-1 block text-xs text-slate-500">Allergies / Medications</span>
                  {currentStudent.medical.allergies.length === 0 && currentStudent.medical.medications.length === 0 ? (
                    <span className="text-sm italic text-slate-400">None reported</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {currentStudent.medical.allergies.map((allergy) => (
                        <span
                          key={allergy}
                          className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700"
                        >
                          <ShieldAlert size={10} />
                          {allergy}
                        </span>
                      ))}
                      {currentStudent.medical.medications.map((medication) => (
                        <span
                          key={medication}
                          className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700"
                        >
                          <Pill size={10} />
                          {medication}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Eye
                      size={14}
                      className={currentStudent.medical.visionScreening.status === 'Corrected' ? 'text-indigo-500' : 'text-slate-400'}
                    />
                    <span>Vis: {currentStudent.medical.visionScreening.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Ear
                      size={14}
                      className={currentStudent.medical.hearingScreening.status !== 'Pass' ? 'text-rose-500' : 'text-slate-400'}
                    />
                    <span>Hear: {currentStudent.medical.hearingScreening.status}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {activeTab === 'reading' && (
      <section
        id="student-profile-panel-reading"
        role="tabpanel"
        aria-labelledby="student-profile-tab-reading"
        className="space-y-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current F&amp;P</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{normalizeFpLevel(currentStudent.readingLevel) ?? currentStudent.readingLevel}</p>
            <p className="mt-1 text-xs text-slate-500">{currentReadingSummary?.stage ?? 'Not mapped to stage yet'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lexile Range</p>
            <p className="mt-1 text-xl font-bold text-indigo-700">{currentReadingSummary?.lexileLabel ?? 'No mapping'}</p>
            <p className="mt-1 text-xs text-slate-500">ATOS {currentReadingSummary?.atosLabel ?? 'N/A'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Grade Target Band</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">
              {gradeTargetBand ? `${gradeTargetBand.min} - ${gradeTargetBand.max}` : 'No grade target'}
            </p>
            <p className="mt-1 text-xs text-slate-500">{gradeTargetRange ? `Indexed ${gradeTargetRange.minIndex} - ${gradeTargetRange.maxIndex}` : 'Target unavailable for this grade'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Growth Since First Assessment</p>
            <p className={`mt-1 text-xl font-bold ${readingGrowthDelta === null ? 'text-slate-800' : readingGrowthDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {readingGrowthDelta === null ? 'Need 2+ assessments' : `${readingGrowthDelta >= 0 ? '+' : ''}${readingGrowthDelta} levels`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {latestReadingChartPoint ? `Latest: ${latestReadingChartPoint.fAndPLevel} on ${latestReadingChartPoint.dateLabel}` : 'No charted assessments yet'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800">Reading Trajectory vs Lexile Conversion Chart</h3>
              <p className="text-sm text-slate-500">Tracks every saved assessment against all F&amp;P levels and reading stages from the 2017 Lexile conversion guide.</p>
            </div>
            <button
              type="button"
              onClick={handleStartReadingAssessmentCreate}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Add Assessment
            </button>
          </div>

          {isReadingAssessmentEditorOpen && (
            <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
              <p className="mb-3 text-sm font-semibold text-indigo-900">
                {editingReadingAssessmentId ? 'Edit Reading Assessment' : 'New Reading Assessment'}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[170px_180px_1fr_auto]">
                <label className="text-xs font-semibold text-slate-600">
                  Date
                  <input
                    type="date"
                    value={readingAssessmentDraft.date}
                    onChange={(event) =>
                      setReadingAssessmentDraft((previous) => ({ ...previous, date: event.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  F&amp;P Level
                  <select
                    value={normalizeFpLevel(readingAssessmentDraft.fAndPLevel) ?? ''}
                    onChange={(event) =>
                      setReadingAssessmentDraft((previous) => ({ ...previous, fAndPLevel: event.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    {FP_LEVEL_ORDER.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Notes
                  <input
                    value={readingAssessmentDraft.notes}
                    onChange={(event) =>
                      setReadingAssessmentDraft((previous) => ({ ...previous, notes: event.target.value }))
                    }
                    placeholder="Optional context for this assessment"
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveReadingAssessment}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => resetReadingAssessmentEditor(currentStudent.readingLevel)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {readingChartPoints.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No mapped reading assessments yet. Add an assessment to visualize growth across the Lexile conversion stages.
            </div>
          ) : (
            <div className="h-[430px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={readingChartPoints} margin={{ top: 16, right: 22, left: 6, bottom: 8 }}>
                  {stageRanges.map((band) => (
                    <ReferenceArea
                      key={`stage-${band.stage}`}
                      y1={band.minIndex}
                      y2={band.maxIndex}
                      fill={band.fill}
                      fillOpacity={0.55}
                      ifOverflow="extendDomain"
                    />
                  ))}
                  {gradeTargetRange ? (
                    <ReferenceArea
                      y1={gradeTargetRange.minIndex}
                      y2={gradeTargetRange.maxIndex}
                      fill="#6366f1"
                      fillOpacity={0.14}
                      ifOverflow="extendDomain"
                    />
                  ) : null}
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
                  <YAxis
                    type="number"
                    domain={[1, FP_LEVEL_ORDER.length]}
                    ticks={FP_LEVEL_ORDER.map((_, index) => index + 1)}
                    tickFormatter={(value) => FP_LEVEL_ORDER[value - 1] ?? ''}
                    tick={{ fontSize: 10 }}
                    width={34}
                    interval={0}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      const point = payload?.[0]?.payload as
                        | {
                            dateLabel: string;
                            fAndPLevel: string;
                            stage: ReadingStage;
                            lexileLabel: string;
                            atosLabel: string;
                            notes: string;
                          }
                        | undefined;
                      if (!active || !point) return null;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
                          <p className="font-bold text-slate-800">{point.dateLabel}</p>
                          <p className="mt-1 text-slate-700">Level {point.fAndPLevel}</p>
                          <p className="text-slate-700">{point.stage}</p>
                          <p className="text-indigo-700">Lexile {point.lexileLabel}</p>
                          <p className="text-slate-600">ATOS {point.atosLabel}</p>
                          {point.notes ? <p className="mt-1 max-w-[220px] text-slate-500">{point.notes}</p> : null}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="levelIndex"
                    stroke="#0f766e"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  {latestReadingChartPoint ? (
                    <ReferenceLine y={latestReadingChartPoint.levelIndex} stroke="#0f766e" strokeDasharray="4 4" />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            {stageRanges.map((band) => (
              <span key={`legend-${band.stage}`} className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 ${band.textClassName}`}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: band.fill }} />
                {band.stage} ({band.minLevel}-{band.maxLevel})
              </span>
            ))}
            {gradeTargetBand ? (
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-700">
                Grade target: {gradeTargetBand.min}-{gradeTargetBand.max}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800">Assessment Timeline</h3>
            <p className="mt-1 text-sm text-slate-500">Newest first. Edit or remove entries as needed.</p>
            <div className="mt-4 space-y-2">
              {sortedReadingAssessments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No assessments recorded yet.
                </div>
              ) : (
                [...sortedReadingAssessments].reverse().map((assessment) => {
                  const normalizedLevel = normalizeFpLevel(assessment.fAndPLevel) ?? assessment.fAndPLevel;
                  const summary = getLexileSummaryForFpLevel(normalizedLevel);
                  const stage = getStageForFpLevel(normalizedLevel) ?? 'Transitional';
                  return (
                    <article key={assessment.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatIsoDateLabel(assessment.date)} - Level {normalizedLevel}
                          </p>
                          <p className="text-xs text-slate-500">
                            {stage} | Lexile {summary?.lexileLabel ?? 'N/A'} | ATOS {summary?.atosLabel ?? 'N/A'}
                          </p>
                          {assessment.notes ? <p className="mt-1 text-sm text-slate-600">{assessment.notes}</p> : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartReadingAssessmentEdit(assessment)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReadingAssessment(assessment.id)}
                            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800">Lexile / F&amp;P Reference</h3>
            <p className="mt-1 text-sm text-slate-500">Full level and stage mapping from the chart source used by this graph.</p>
            <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wide text-slate-500">F&amp;P</th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wide text-slate-500">Stage</th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wide text-slate-500">Lexile</th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wide text-slate-500">ATOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {LEXILE_LEVEL_SUMMARIES.map((summary) => (
                    <tr key={`reference-${summary.fpLevel}`}>
                      <td className="px-3 py-2 font-semibold text-slate-800">{summary.fpLevel}</td>
                      <td className="px-3 py-2 text-slate-600">{summary.stage}</td>
                      <td className="px-3 py-2 text-slate-600">{summary.lexileLabel}</td>
                      <td className="px-3 py-2 text-slate-600">{summary.atosLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
      )}

      {activeTab === 'interventions' && (
      <section
        id="student-profile-panel-interventions"
        role="tabpanel"
        aria-labelledby="student-profile-tab-interventions"
        className="space-y-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Active Plans</p>
            <p className="mt-2 text-3xl font-bold text-indigo-700">{activeInterventions.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Completed Plans</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{completedInterventions.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Average Progress</p>
            <p className="mt-2 text-3xl font-bold text-slate-800">{averageInterventionProgress}%</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Intervention Plans</h3>
              <p className="text-sm text-slate-500">Track baseline-to-goal progression and plan status.</p>
            </div>
            <button
              onClick={() => setIsReferralModalOpen(true)}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Create Intervention
            </button>
          </div>
          <div className="space-y-3">
            {interventions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No interventions are attached to this profile yet.
              </div>
            ) : (
              interventions.map((intervention) => {
                const isSelected = selectedInterventionId === intervention.id;
                const editableIntervention =
                  isInterventionEditing && interventionDraft?.id === intervention.id ? interventionDraft : intervention;

                return (
                  <article
                    key={intervention.id}
                    className={`rounded-lg border p-4 transition-colors ${
                      isSelected ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectIntervention(intervention.id)}
                      className="w-full text-left"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-slate-900">{editableIntervention.name}</h4>
                          <p className="text-xs text-slate-500">Started {editableIntervention.date}</p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                            editableIntervention.status.toLowerCase() === 'active'
                              ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {editableIntervention.status}
                        </span>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                          <span>
                            Baseline {editableIntervention.baselineScore} - Goal {editableIntervention.goalScore}
                          </span>
                          <span className="font-bold text-indigo-700">{editableIntervention.progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${Math.max(0, Math.min(100, editableIntervention.progress))}%` }}
                          />
                        </div>
                      </div>
                    </button>

                    {isSelected && (
                      <div className="mt-4 space-y-4 border-t border-indigo-100 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Intervention details</p>
                          {isInterventionEditing && interventionDraft?.id === intervention.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSaveInterventionEdit}
                                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                              >
                                Save Plan
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelInterventionEdit}
                                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleStartInterventionEdit}
                              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit Plan
                            </button>
                          )}
                        </div>

                        {isInterventionEditing && interventionDraft?.id === intervention.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <label className="text-xs font-semibold text-slate-600">
                                Plan Name
                                <input
                                  value={interventionDraft.name}
                                  onChange={(event) => handleInterventionFieldChange('name', event.target.value)}
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                              </label>
                              <label className="text-xs font-semibold text-slate-600">
                                Start Date
                                <input
                                  value={interventionDraft.date}
                                  onChange={(event) => handleInterventionFieldChange('date', event.target.value)}
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                              </label>
                              <label className="text-xs font-semibold text-slate-600">
                                Status
                                <select
                                  value={interventionDraft.status}
                                  onChange={(event) => handleInterventionFieldChange('status', event.target.value)}
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                >
                                  <option value="Active">Active</option>
                                  <option value="Completed">Completed</option>
                                  <option value="Paused">Paused</option>
                                  <option value="Pending">Pending</option>
                                </select>
                              </label>
                              <label className="text-xs font-semibold text-slate-600">
                                Progress %
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={interventionDraft.progress}
                                  onChange={(event) => handleInterventionFieldChange('progress', event.target.value)}
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                              </label>
                              <label className="text-xs font-semibold text-slate-600">
                                Baseline Score
                                <input
                                  type="number"
                                  value={interventionDraft.baselineScore}
                                  onChange={(event) => handleInterventionFieldChange('baselineScore', event.target.value)}
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                              </label>
                              <label className="text-xs font-semibold text-slate-600">
                                Goal Score
                                <input
                                  type="number"
                                  value={interventionDraft.goalScore}
                                  onChange={(event) => handleInterventionFieldChange('goalScore', event.target.value)}
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                              </label>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Progress Data Points</p>
                                <button
                                  type="button"
                                  onClick={handleAddInterventionDataPoint}
                                  className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                                >
                                  Add Data Point
                                </button>
                              </div>
                              <div className="space-y-2">
                                {interventionDraft.dataPoints.length === 0 ? (
                                  <p className="text-xs text-slate-500">No data points yet.</p>
                                ) : (
                                  interventionDraft.dataPoints.map((point, index) => (
                                    <div key={`${point.date}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_auto]">
                                      <input
                                        value={point.date}
                                        onChange={(event) => handleInterventionDataPointChange(index, 'date', event.target.value)}
                                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        aria-label={`Data point ${index + 1} date`}
                                      />
                                      <input
                                        type="number"
                                        value={point.score}
                                        onChange={(event) => handleInterventionDataPointChange(index, 'score', event.target.value)}
                                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        aria-label={`Data point ${index + 1} score`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveInterventionDataPoint(index)}
                                        className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-3">
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Baseline</p>
                              <p className="mt-1 text-lg font-bold text-slate-900">{editableIntervention.baselineScore}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Goal</p>
                              <p className="mt-1 text-lg font-bold text-slate-900">{editableIntervention.goalScore}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Data Points</p>
                              <p className="mt-1 text-lg font-bold text-slate-900">{editableIntervention.dataPoints.length}</p>
                            </div>
                          </div>
                        )}

                        {canViewStudentNotes ? (
                          <StudentNotesPanel
                            notes={editableIntervention.notes ?? []}
                            canEdit={canViewStudentNotes}
                            currentUserName={staffDisplayName}
                            currentUserId={currentUserId}
                            onChange={(nextNotes) => handleInterventionNotesChange(intervention.id, nextNotes)}
                            emptyState="No intervention notes yet. Add progress checks, meeting outcomes, and follow-up actions."
                          />
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                            Notes are visible to teacher and support staff roles.
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
      )}

      {activeTab === 'academics' && (
      <section
        id="student-profile-panel-academics"
        role="tabpanel"
        aria-labelledby="student-profile-tab-academics"
        className="space-y-6"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800">Academic Progression</h3>
              <p className="text-sm text-slate-500">Math and Reading are charted separately. Select a point to filter notes by month.</p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1">
              {ACADEMIC_FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAcademicFilter(filter)}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                    academicFilter === filter ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${showMathSeries ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${showMathSeries ? 'bg-blue-500' : 'bg-slate-300'}`} />
              Math
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${showReadingSeries ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${showReadingSeries ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              Reading
            </span>
          </div>

          <div ref={chartContainerRef} className="min-h-[260px] w-full min-w-0">
            {chartWidth > 0 ? (
              <LineChart
                width={chartWidth}
                height={260}
                data={academicChartData}
                onClick={(event) => {
                  if (event?.activeLabel) {
                    setSelectedMonth((previous) => (previous === event.activeLabel ? null : String(event.activeLabel)));
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} width={34} />
                <Tooltip
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const point = payload[0]?.payload as AcademicChartPoint | undefined;
                    if (!point) return null;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
                        <p className="font-bold text-slate-700">{String(label ?? point.label)}</p>
                        {showMathSeries ? (
                          <p className="mt-1 font-semibold text-blue-700">Math: {point.mathScore}%</p>
                        ) : null}
                        {showReadingSeries ? (
                          <p className="font-semibold text-emerald-700">Reading: {point.readingScore}%</p>
                        ) : null}
                      </div>
                    );
                  }}
                />
                {showMathSeries ? (
                  <Line
                    type="monotone"
                    dataKey="mathScore"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#2563eb' }}
                    activeDot={{ r: 6 }}
                    name="Math"
                  />
                ) : null}
                {showReadingSeries ? (
                  <Line
                    type="monotone"
                    dataKey="readingScore"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#059669' }}
                    activeDot={{ r: 6 }}
                    name="Reading"
                  />
                ) : null}
              </LineChart>
            ) : (
              <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
                Chart is loading...
              </div>
            )}
          </div>

          <div className="mt-3 text-xs text-slate-500">
            {selectedMonth ? `Filtering notes for ${selectedMonth}.` : 'Showing notes across all months.'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800">Academic Notes</h3>
            <button
              onClick={() => {
                setAcademicFilter('All');
                setSelectedMonth(null);
              }}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>
          {academicNotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No academic notes match the current filters.
            </div>
          ) : (
            <div className="space-y-2">
              {academicNotes.map((note, index) => (
                <article key={`${note.date}-${index}`} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{note.type} Update</p>
                    <p className="text-xs font-medium text-slate-500">{note.date}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{note.note}</p>
                  {note.tags && note.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {note.tags.map((tag) => (
                        <span key={tag} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {activeTab === 'notes' && canViewStudentNotes && (
      <section
        id="student-profile-panel-notes"
        role="tabpanel"
        aria-labelledby="student-profile-tab-notes"
      >
        <StudentNotesPanel
          notes={currentStudent.notes ?? []}
          canEdit={canViewStudentNotes}
          currentUserName={staffDisplayName}
          currentUserId={currentUserId}
          onChange={handleNotesChange}
          emptyState="No staff notes yet. Add one to capture interventions, family outreach, and follow-ups."
        />
      </section>
      )}

      {activeTab === 'documents' && (
      <section
        id="student-profile-panel-documents"
        role="tabpanel"
        aria-labelledby="student-profile-tab-documents"
        className="space-y-6"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800">Documents</h3>
              <p className="text-sm text-slate-500">Keep support and history records in one place.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
              <UploadCloud size={14} />
              Upload Document
            </button>
          </div>
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Drop files here or use Upload Document. Accepted formats: PDF, PNG, JPG.
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 font-bold text-slate-800">Recent Files</h3>
          {profileDocuments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No documents available yet. Upload the first document to start the record.
            </div>
          ) : (
            <div className="space-y-2">
              {profileDocuments.map((document) => (
                <article key={document.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-slate-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{document.title}</p>
                        <p className="text-xs text-slate-500">{document.category}</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${getDocumentStatusColor(document.status)}`}>
                      {document.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays size={12} />
                    Updated {document.updated}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      )}
    </div>
  );
};
