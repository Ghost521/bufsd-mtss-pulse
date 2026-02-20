import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Filter,
  GraduationCap,
  LayoutGrid,
  List as ListIcon,
  Pencil,
  Search,
  ShieldAlert,
  Upload,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { Tier, UserRole, type StaffRosterItem, type StudentRosterItem } from "../types";
import { useStudentHierarchy } from "../hooks/useStudentHierarchy";
import { useStudents, type StudentFilters } from "../hooks/useStudents";
import { useTenantCollection } from "../hooks/useTenantCollection";
import {
  getAttendanceTone,
  getGpaTone,
  getTierTone,
  riskToneLabel,
  type RiskTone,
} from "../lib/student-risk";
import { evaluateReadingRisk, mergeReadingBenchmarks, normalizeGrade } from "../lib/reading-benchmarks";
import type { SettingsRecord } from "../lib/schemas/settings";
import type { WorkspacePageId } from "../lib/workspaceRoutes";
import { ReferralModal } from "./ReferralModal";
import { DraggableModal } from "./DraggableModal";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { Button } from "./ui/Button";
import { STAFF_ROSTER_DATA } from "../constants";

type StudentRosterViewProps = {
  onMenuClick: () => void;
  onStudentClick: (name: string) => void;
  currentUserRole: UserRole;
  viewType?: "classroom" | "master";
  embedded?: boolean;
  onNavigate?: (page: WorkspacePageId) => void;
};

type ViewMode = "grid" | "list";
type WorkflowMode = "none" | "bulk" | "attendance";
type AttendanceStatus = "Present" | "Late" | "Absent";
type SortBy = "name" | "tier" | "attendance" | "gpa" | "alerts" | "reading";
type StudentLifecycleStatus = "active" | "monitoring" | "completed" | "unknown";
type HierarchyLevel = "district" | "school" | "principal" | "grade" | "teacher";
type PrincipalRosterStage = "grades" | "staff" | "class";
type PrincipalStaffCardSource = "class-roster" | "staff-directory" | "merged";

type PrincipalStaffCard = {
  key: string;
  teacherName: string;
  teacherUserId?: string;
  source: PrincipalStaffCardSource;
  roleLabel: string;
  studentCount: number;
  canOpenRoster: boolean;
};

type LocalStudent = StudentRosterItem & {
  teacherName: string;
  status: StudentLifecycleStatus;
  isArchived: boolean;
};

type DraftStudent = {
  name: string;
  grade: string;
  tier: Tier;
  gpa: string;
  attendance: number;
  readingLevel: string;
  teacherName: string;
  status: StudentLifecycleStatus;
};

type HierarchySelection = {
  level: HierarchyLevel;
  schoolId?: string;
  schoolName?: string;
  principalUserId?: string;
  principalName?: string;
  grade?: string;
  teacherUserId?: string;
  teacherName?: string;
};

const DEFAULT_DRAFT: DraftStudent = {
  name: "",
  grade: "4th",
  tier: Tier.TIER_1,
  gpa: "3.0",
  attendance: 100,
  readingLevel: "M",
  teacherName: "",
  status: "monitoring",
};

const toLifecycleStatus = (student: StudentRosterItem): StudentLifecycleStatus => {
  if (student.status === "active" || student.status === "monitoring" || student.status === "completed" || student.status === "unknown") {
    return student.status;
  }
  return student.activeInterventions > 0 ? "active" : "monitoring";
};

const toTeacherName = (student: StudentRosterItem): string => {
  if (typeof student.teacherName === "string" && student.teacherName.trim().length > 0) return student.teacherName;
  if (typeof student.teacher === "string" && student.teacher.trim().length > 0) return student.teacher;
  return "Unassigned";
};

const normalizeStudent = (student: StudentRosterItem): LocalStudent => ({
  ...student,
  teacherName: toTeacherName(student),
  status: toLifecycleStatus(student),
  isArchived: Boolean(student.isArchived),
});

const statusLabel = (status: StudentLifecycleStatus): string => {
  if (status === "active") return "Active";
  if (status === "monitoring") return "Monitoring";
  if (status === "completed") return "Completed";
  return "Needs review";
};

const tierWeight = (tier: Tier): number => {
  if (tier === Tier.TIER_3) return 3;
  if (tier === Tier.TIER_2) return 2;
  return 1;
};

const sortStudents = (students: LocalStudent[], sortBy: SortBy, desc: boolean): LocalStudent[] => {
  const sorted = [...students];
  sorted.sort((a, b) => {
    let value = 0;
    if (sortBy === "name") value = a.name.localeCompare(b.name);
    if (sortBy === "tier") value = tierWeight(a.tier) - tierWeight(b.tier);
    if (sortBy === "attendance") value = a.attendance - b.attendance;
    if (sortBy === "gpa") value = Number.parseFloat(a.gpa) - Number.parseFloat(b.gpa);
    if (sortBy === "alerts") value = a.alerts - b.alerts;
    if (sortBy === "reading") value = a.readingLevel.localeCompare(b.readingLevel);
    return desc ? value * -1 : value;
  });
  return sorted;
};

const signalToneClass = (tone: RiskTone): string => {
  if (tone === "good") return "signal-good";
  if (tone === "warn") return "signal-warn";
  if (tone === "risk") return "signal-risk";
  return "signal-neutral";
};

const activateWithKeyboard = (event: React.KeyboardEvent, callback: () => void) => {
  if (event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  callback();
};

const normalizeNameKey = (value: string): string => value.trim().toLowerCase();

const toGradeToken = (gradeLabel?: string): string | null => {
  if (!gradeLabel) return null;
  return normalizeGrade(gradeLabel);
};

const isMatchingGrade = (left?: string, right?: string): boolean => {
  const leftToken = toGradeToken(left);
  const rightToken = toGradeToken(right);
  if (!leftToken || !rightToken) return false;
  return leftToken === rightToken;
};

const displayGrade = (gradeLabel: string): string => {
  const token = toGradeToken(gradeLabel);
  if (!token) return `Grade ${gradeLabel}`;
  return token === "K" ? "Kindergarten" : `Grade ${token}`;
};

const csvName = (scope: "master" | "class") => {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${scope}-roster-${stamp}.csv`;
};

const isDistrictUser = (role: UserRole): boolean => role === UserRole.DISTRICT;

export const StudentRosterView: React.FC<StudentRosterViewProps> = ({
  onMenuClick,
  onStudentClick,
  currentUserRole,
  viewType = "classroom",
  embedded = false,
  onNavigate,
}) => {
  const scope = viewType === "master" ? "master" : "class";
  const isMasterScope = scope === "master";
  const showHierarchyPanel = isMasterScope && currentUserRole !== UserRole.TEACHER && currentUserRole !== UserRole.PARENT;
  const isPrincipalDrilldown = embedded && isMasterScope && currentUserRole === UserRole.PRINCIPAL;
  const canTakeAttendance = currentUserRole !== UserRole.PRINCIPAL;
  const showHierarchyTreePanel = showHierarchyPanel && !isPrincipalDrilldown;
  const hierarchyQuery = useStudentHierarchy(showHierarchyPanel);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [hierarchySelection, setHierarchySelection] = useState<HierarchySelection | null>(null);
  const [hasHydratedHierarchySelection, setHasHydratedHierarchySelection] = useState(false);
  const [principalStage, setPrincipalStage] = useState<PrincipalRosterStage>("grades");
  const [principalSchoolId, setPrincipalSchoolId] = useState<string | null>(null);
  const [principalGrade, setPrincipalGrade] = useState<string | null>(null);
  const [principalStaff, setPrincipalStaff] = useState<{ teacherName: string; teacherUserId?: string } | null>(null);

  const studentFilters = useMemo<StudentFilters | undefined>(() => {
    if (!showHierarchyPanel || !hierarchySelection) return undefined;
    return {
      schoolId: hierarchySelection.schoolId,
      principalUserId:
        hierarchySelection.level === "principal" || hierarchySelection.level === "grade" || hierarchySelection.level === "teacher"
          ? hierarchySelection.principalUserId
          : undefined,
      grade: hierarchySelection.level === "grade" || hierarchySelection.level === "teacher" ? hierarchySelection.grade : undefined,
      teacherUserId: hierarchySelection.level === "teacher" ? hierarchySelection.teacherUserId : undefined,
      teacherName: hierarchySelection.level === "teacher" ? hierarchySelection.teacherName : undefined,
    };
  }, [hierarchySelection, showHierarchyPanel]);

  const studentsApi = useStudents(scope, { filters: studentFilters });
  const staffCollection = useTenantCollection<StaffRosterItem>("staff");
  const settingsCollection = useTenantCollection<SettingsRecord>("settings");

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [tierFilter, setTierFilter] = useState<"All" | Tier>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StudentLifecycleStatus>("All");
  const [teacherFilter, setTeacherFilter] = useState("All");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralStudentId, setReferralStudentId] = useState("");
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const [editingStudent, setEditingStudent] = useState<LocalStudent | null>(null);
  const [editDraft, setEditDraft] = useState<DraftStudent | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentDraft, setNewStudentDraft] = useState<DraftStudent>(DEFAULT_DRAFT);
  const hierarchySchools = useMemo(() => hierarchyQuery.data?.schools ?? [], [hierarchyQuery.data?.schools]);
  const isDistrictHierarchy = isDistrictUser(currentUserRole);
  const hierarchyError = hierarchyQuery.error instanceof Error ? hierarchyQuery.error.message : null;

  useEffect(() => {
    if (showHierarchyPanel) return;
    setHierarchySelection(null);
    setExpandedNodes(new Set());
    setHasHydratedHierarchySelection(false);
    setWorkflowMode("none");
    setAttendanceMap({});
    setSelectedIds(new Set());
    setPrincipalStage("grades");
    setPrincipalSchoolId(null);
    setPrincipalGrade(null);
    setPrincipalStaff(null);
  }, [showHierarchyPanel]);

  useEffect(() => {
    setHasHydratedHierarchySelection(false);
    if (!showHierarchyPanel) return;
    setHierarchySelection(null);
    setExpandedNodes(new Set());
    setWorkflowMode("none");
    setAttendanceMap({});
    setSelectedIds(new Set());
    setPrincipalStage("grades");
    setPrincipalSchoolId(null);
    setPrincipalGrade(null);
    setPrincipalStaff(null);
  }, [currentUserRole, showHierarchyPanel, viewType]);

  useEffect(() => {
    if (!showHierarchyPanel) return;
    if (!hierarchyQuery.isSuccess) return;
    if (hierarchySchools.length === 0) return;
    if (hasHydratedHierarchySelection) return;

    const firstSchool = hierarchySchools[0];
    if (!firstSchool) return;

    if (isPrincipalDrilldown) {
      setPrincipalSchoolId(firstSchool.schoolId);
      setHierarchySelection({
        level: "school",
        schoolId: firstSchool.schoolId,
        schoolName: firstSchool.schoolName,
      });
      setExpandedNodes(new Set([`school:${firstSchool.schoolId}`]));
      setHasHydratedHierarchySelection(true);
      return;
    }

    if (isDistrictHierarchy) {
      const firstPrincipal = firstSchool.principals[0];
      const firstGrade = firstPrincipal?.grades[0];
      const firstTeacher = firstGrade?.teachers[0];
      setExpandedNodes(
        new Set(
          [
            `school:${firstSchool.schoolId}`,
            firstPrincipal ? `principal:${firstSchool.schoolId}:${firstPrincipal.principalUserId}` : null,
            firstGrade ? `grade:${firstSchool.schoolId}:${firstGrade.grade}` : null,
          ].filter((value): value is string => Boolean(value))
        )
      );
      setHierarchySelection({
        level: firstTeacher ? "teacher" : firstGrade ? "grade" : firstPrincipal ? "principal" : "school",
        schoolId: firstSchool.schoolId,
        schoolName: firstSchool.schoolName,
        principalUserId: firstPrincipal?.principalUserId,
        principalName: firstPrincipal?.principalName,
        grade: firstGrade?.grade,
        teacherUserId: firstTeacher?.teacherUserId ?? undefined,
        teacherName: firstTeacher?.teacherName,
      });
    } else {
      const firstGrade = firstSchool.grades[0];
      setExpandedNodes(new Set(firstGrade ? [`grade:${firstSchool.schoolId}:${firstGrade.grade}`] : []));
      setHierarchySelection({
        level: firstGrade ? "grade" : "school",
        schoolId: firstSchool.schoolId,
        schoolName: firstSchool.schoolName,
        grade: firstGrade?.grade,
      });
    }

    setHasHydratedHierarchySelection(true);
  }, [
    hasHydratedHierarchySelection,
    hierarchyQuery.isSuccess,
    hierarchySchools,
    isDistrictHierarchy,
    isPrincipalDrilldown,
    showHierarchyPanel,
  ]);

  const loadError = studentsApi.studentsQuery.error instanceof Error ? studentsApi.studentsQuery.error.message : null;
  const mutationError = studentsApi.mutationError instanceof Error ? studentsApi.mutationError.message : null;

  const students = useMemo(() => {
    const rows = studentsApi.studentsQuery.data?.rows ?? [];
    return rows.map(normalizeStudent);
  }, [studentsApi.studentsQuery.data?.rows]);

  const readingBenchmarks = useMemo(
    () => mergeReadingBenchmarks(settingsCollection.query.data?.rows?.[0]?.system?.readingBenchmarks),
    [settingsCollection.query.data?.rows],
  );

  const filteredStudents = useMemo(() => {
    let rows = [...students];
    const query = searchQuery.trim().toLowerCase();

    if (query.length > 0) {
      rows = rows.filter((student) =>
        student.name.toLowerCase().includes(query) ||
        student.id.toLowerCase().includes(query) ||
        student.teacherName.toLowerCase().includes(query)
      );
    }

    if (tierFilter !== "All") rows = rows.filter((student) => student.tier === tierFilter);
    if (statusFilter !== "All") rows = rows.filter((student) => student.status === statusFilter);
    if (teacherFilter !== "All") rows = rows.filter((student) => student.teacherName === teacherFilter);

    return sortStudents(rows, sortBy, sortDesc);
  }, [students, searchQuery, tierFilter, statusFilter, teacherFilter, sortBy, sortDesc]);

  const isBulkMode = workflowMode === "bulk";
  const isAttendanceMode = workflowMode === "attendance";
  const selectedCount = selectedIds.size;

  const teacherOptions = useMemo(() => {
    const names = students
      .map((student) => student.teacherName)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    return Array.from(new Set<string>(names)).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const classStats = useMemo(() => {
    const total = students.length;
    const atRisk = students.filter((student) => student.tier !== Tier.TIER_1).length;
    const avgAttendance = total > 0 ? Math.round(students.reduce((sum, student) => sum + student.attendance, 0) / total) : 0;
    const avgGpa = total > 0 ? (students.reduce((sum, student) => sum + Number.parseFloat(student.gpa), 0) / total).toFixed(1) : "0.0";
    return { total, atRisk, avgAttendance, avgGpa };
  }, [students]);

  const attendanceSummary = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;

    for (const student of filteredStudents) {
      const status = attendanceMap[student.id] ?? "Present";
      if (status === "Present") present += 1;
      if (status === "Late") late += 1;
      if (status === "Absent") absent += 1;
    }

    return { present, late, absent, total: filteredStudents.length };
  }, [attendanceMap, filteredStudents]);

  const directoryStaff = useMemo(() => {
    const rows = staffCollection.query.data?.rows;
    if (rows && rows.length > 0) return rows;
    return STAFF_ROSTER_DATA;
  }, [staffCollection.query.data?.rows]);

  const principalActiveSchool = useMemo(() => {
    if (!isPrincipalDrilldown) return null;
    if (hierarchySchools.length === 0) return null;
    if (!principalSchoolId) return hierarchySchools[0];
    return hierarchySchools.find((school) => school.schoolId === principalSchoolId) ?? hierarchySchools[0];
  }, [hierarchySchools, isPrincipalDrilldown, principalSchoolId]);

  const principalGradeCards = useMemo(() => {
    if (!principalActiveSchool) return [];
    return principalActiveSchool.grades.map((gradeNode) => ({
      grade: gradeNode.grade,
      teacherCount: gradeNode.teachers.length,
      studentCount: gradeNode.teachers.reduce((sum, teacher) => sum + teacher.studentCount, 0),
    }));
  }, [principalActiveSchool]);

  const gradeScopedTeacherCounts = useMemo(() => {
    const next = new Map<string, number>();
    if (!principalGrade) return next;
    for (const student of students) {
      if (!isMatchingGrade(student.grade, principalGrade)) continue;
      const key = normalizeNameKey(student.teacherName);
      if (!key) continue;
      next.set(key, (next.get(key) ?? 0) + 1);
    }
    return next;
  }, [principalGrade, students]);

  const principalStaffCards = useMemo<PrincipalStaffCard[]>(() => {
    if (!principalActiveSchool || !principalGrade) return [];
    const gradeNode = principalActiveSchool.grades.find((item) => item.grade === principalGrade);
    if (!gradeNode) return [];

    const byKey = new Map<string, PrincipalStaffCard>();
    const byName = new Map<string, string>();

    for (const teacher of gradeNode.teachers) {
      const normalizedName = normalizeNameKey(teacher.teacherName);
      const key = teacher.teacherUserId ? `teacher:${teacher.teacherUserId}` : `teacher-name:${normalizedName}`;
      byKey.set(key, {
        key,
        teacherName: teacher.teacherName,
        teacherUserId: teacher.teacherUserId ?? undefined,
        source: "class-roster",
        roleLabel: "Teacher",
        studentCount: teacher.studentCount,
        canOpenRoster: teacher.studentCount > 0,
      });
      byName.set(normalizedName, key);
    }

    const matchingStaff = directoryStaff.filter((staff) => isMatchingGrade(staff.grade, principalGrade));
    for (const staff of matchingStaff) {
      const normalizedName = normalizeNameKey(staff.name);
      const existingKey = byName.get(normalizedName);
      const rosterCount = gradeScopedTeacherCounts.get(normalizedName) ?? 0;
      if (existingKey) {
        const existing = byKey.get(existingKey);
        if (!existing) continue;
        byKey.set(existingKey, {
          ...existing,
          source: "merged",
          roleLabel: staff.role,
          studentCount: Math.max(existing.studentCount, rosterCount),
          canOpenRoster: Math.max(existing.studentCount, rosterCount) > 0,
        });
        continue;
      }

      const key = `staff:${staff.id}`;
      byKey.set(key, {
        key,
        teacherName: staff.name,
        source: "staff-directory",
        roleLabel: staff.role,
        studentCount: rosterCount,
        canOpenRoster: rosterCount > 0,
      });
      byName.set(normalizedName, key);
    }

    return [...byKey.values()].sort((left, right) => {
      if (left.canOpenRoster !== right.canOpenRoster) return left.canOpenRoster ? -1 : 1;
      if (left.studentCount !== right.studentCount) return right.studentCount - left.studentCount;
      return left.teacherName.localeCompare(right.teacherName);
    });
  }, [directoryStaff, gradeScopedTeacherCounts, principalActiveSchool, principalGrade]);

  const principalRosterContext = useMemo(() => {
    if (!principalActiveSchool) return null;
    if (!principalGrade) return { label: principalActiveSchool.schoolName };
    if (!principalStaff) return { label: `${principalActiveSchool.schoolName} -> ${displayGrade(principalGrade)}` };
    return {
      label: `${principalActiveSchool.schoolName} -> ${displayGrade(principalGrade)} -> ${principalStaff.teacherName}`,
    };
  }, [principalActiveSchool, principalGrade, principalStaff]);

  const hierarchyContextLabel = useMemo(() => {
    if (!showHierarchyPanel || !hierarchySelection) {
      return viewType === "master" ? "Schoolwide student roster" : "Class roster";
    }

    const segments: string[] = [];
    if (hierarchySelection.schoolName) segments.push(hierarchySelection.schoolName);
    if (hierarchySelection.principalName && hierarchySelection.level !== "school") segments.push(hierarchySelection.principalName);
    if (hierarchySelection.grade && (hierarchySelection.level === "grade" || hierarchySelection.level === "teacher")) {
      segments.push(`Grade ${hierarchySelection.grade}`);
    }
    if (hierarchySelection.teacherName && hierarchySelection.level === "teacher") segments.push(hierarchySelection.teacherName);
    if (segments.length === 0) return viewType === "master" ? "Schoolwide student roster" : "Class roster";
    return `${segments.join(" -> ")} • ${students.length} students`;
  }, [hierarchySelection, showHierarchyPanel, students.length, viewType]);

  const toggleHierarchyNode = (nodeId: string) => {
    setExpandedNodes((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const renderHierarchyPanel = () => {
    if (!showHierarchyPanel) return null;

    return (
      <aside className="app-card rounded-xl border border-slate-200 p-3 md:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roster hierarchy</p>
        {hierarchyQuery.isLoading ? <p className="mt-2 text-sm text-slate-500">Loading hierarchy...</p> : null}
        {hierarchyError ? <p className="mt-2 text-sm text-rose-600">{hierarchyError}</p> : null}
        {!hierarchyQuery.isLoading && !hierarchyError && hierarchySchools.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No hierarchy data for this context.</p>
        ) : null}

        {!hierarchyQuery.isLoading && !hierarchyError && hierarchySchools.length > 0 ? (
          <div className="mt-3 space-y-2">
            {hierarchySchools.map((school) => {
              const schoolNodeId = `school:${school.schoolId}`;
              const schoolOpen = expandedNodes.has(schoolNodeId);
              const schoolSelected = hierarchySelection?.level === "school" && hierarchySelection.schoolId === school.schoolId;

              if (!isDistrictHierarchy) {
                return (
                  <section key={school.schoolId} className="rounded-lg border border-slate-200/80 bg-white p-2">
                    <p className="mb-2 text-xs font-semibold text-slate-600">{school.schoolName}</p>
                    <div className="space-y-1">
                      {school.grades.map((grade) => {
                        const gradeNodeId = `grade:${school.schoolId}:${grade.grade}`;
                        const gradeOpen = expandedNodes.has(gradeNodeId);
                        const gradeSelected =
                          hierarchySelection?.level === "grade" &&
                          hierarchySelection.schoolId === school.schoolId &&
                          hierarchySelection.grade === grade.grade;
                        return (
                          <div key={gradeNodeId} className="rounded-md border border-slate-100">
                            <div className="flex items-center justify-between gap-1 p-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setHierarchySelection({
                                    level: "grade",
                                    schoolId: school.schoolId,
                                    schoolName: school.schoolName,
                                    grade: grade.grade,
                                  });
                                }}
                                className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-medium ${
                                  gradeSelected ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <GraduationCap size={13} />
                                <span className="truncate">Grade {grade.grade}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleHierarchyNode(gradeNodeId)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                aria-label={`Toggle grade ${grade.grade}`}
                              >
                                {gradeOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                            </div>
                            {gradeOpen ? (
                              <div className="space-y-1 border-t border-slate-100 px-1 pb-1 pt-1">
                                {grade.teachers.map((teacher) => {
                                  const teacherKey = `${gradeNodeId}:${teacher.teacherUserId ?? teacher.teacherName}`;
                                  const teacherSelected =
                                    hierarchySelection?.level === "teacher" &&
                                    hierarchySelection.schoolId === school.schoolId &&
                                    hierarchySelection.grade === grade.grade &&
                                    hierarchySelection.teacherName === teacher.teacherName;
                                  return (
                                    <button
                                      key={teacherKey}
                                      type="button"
                                      onClick={() =>
                                        setHierarchySelection({
                                          level: "teacher",
                                          schoolId: school.schoolId,
                                          schoolName: school.schoolName,
                                          grade: grade.grade,
                                          teacherUserId: teacher.teacherUserId ?? undefined,
                                          teacherName: teacher.teacherName,
                                        })
                                      }
                                      className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-xs ${
                                        teacherSelected ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                                      }`}
                                    >
                                      <span className="truncate">{teacher.teacherName}</span>
                                      <span className="ml-2 shrink-0 text-[10px] text-slate-500">{teacher.studentCount}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              }

              return (
                <section key={school.schoolId} className="rounded-lg border border-slate-200/80 bg-white p-2">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setHierarchySelection({
                          level: "school",
                          schoolId: school.schoolId,
                          schoolName: school.schoolName,
                        })
                      }
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-semibold ${
                        schoolSelected ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Building2 size={13} />
                      <span className="truncate">{school.schoolName}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHierarchyNode(schoolNodeId)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label={`Toggle ${school.schoolName}`}
                    >
                      {schoolOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  </div>

                  {schoolOpen ? (
                    <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                      {school.principals.map((principal) => {
                        const principalNodeId = `principal:${school.schoolId}:${principal.principalUserId}`;
                        const principalOpen = expandedNodes.has(principalNodeId);
                        const principalSelected =
                          hierarchySelection?.level === "principal" &&
                          hierarchySelection.schoolId === school.schoolId &&
                          hierarchySelection.principalUserId === principal.principalUserId;
                        return (
                          <div key={principalNodeId} className="rounded-md border border-slate-100">
                            <div className="flex items-center justify-between gap-1 p-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setHierarchySelection({
                                    level: "principal",
                                    schoolId: school.schoolId,
                                    schoolName: school.schoolName,
                                    principalUserId: principal.principalUserId,
                                    principalName: principal.principalName,
                                  })
                                }
                                className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs ${
                                  principalSelected ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <Users size={13} />
                                <span className="truncate">{principal.principalName}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleHierarchyNode(principalNodeId)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                aria-label={`Toggle ${principal.principalName}`}
                              >
                                {principalOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                            </div>
                            {principalOpen ? (
                              <div className="space-y-1 border-t border-slate-100 px-1 pb-1 pt-1">
                                {principal.grades.map((grade) => {
                                  const gradeNodeId = `grade:${school.schoolId}:${grade.grade}`;
                                  const gradeOpen = expandedNodes.has(gradeNodeId);
                                  const gradeSelected =
                                    hierarchySelection?.level === "grade" &&
                                    hierarchySelection.schoolId === school.schoolId &&
                                    hierarchySelection.principalUserId === principal.principalUserId &&
                                    hierarchySelection.grade === grade.grade;
                                  return (
                                    <div key={`${principalNodeId}:${gradeNodeId}`} className="rounded-md border border-slate-100">
                                      <div className="flex items-center justify-between gap-1 p-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setHierarchySelection({
                                              level: "grade",
                                              schoolId: school.schoolId,
                                              schoolName: school.schoolName,
                                              principalUserId: principal.principalUserId,
                                              principalName: principal.principalName,
                                              grade: grade.grade,
                                            })
                                          }
                                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs ${
                                            gradeSelected ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                                          }`}
                                        >
                                          <GraduationCap size={13} />
                                          <span className="truncate">Grade {grade.grade}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleHierarchyNode(gradeNodeId)}
                                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                          aria-label={`Toggle grade ${grade.grade}`}
                                        >
                                          {gradeOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                        </button>
                                      </div>
                                      {gradeOpen ? (
                                        <div className="space-y-1 border-t border-slate-100 px-1 pb-1 pt-1">
                                          {grade.teachers.map((teacher) => {
                                            const teacherSelected =
                                              hierarchySelection?.level === "teacher" &&
                                              hierarchySelection.schoolId === school.schoolId &&
                                              hierarchySelection.principalUserId === principal.principalUserId &&
                                              hierarchySelection.grade === grade.grade &&
                                              hierarchySelection.teacherName === teacher.teacherName;
                                            return (
                                              <button
                                                key={`${principalNodeId}:${gradeNodeId}:${teacher.teacherUserId ?? teacher.teacherName}`}
                                                type="button"
                                                onClick={() =>
                                                  setHierarchySelection({
                                                    level: "teacher",
                                                    schoolId: school.schoolId,
                                                    schoolName: school.schoolName,
                                                    principalUserId: principal.principalUserId,
                                                    principalName: principal.principalName,
                                                    grade: grade.grade,
                                                    teacherUserId: teacher.teacherUserId ?? undefined,
                                                    teacherName: teacher.teacherName,
                                                  })
                                                }
                                                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-xs ${
                                                  teacherSelected ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                                                }`}
                                              >
                                                <span className="truncate">{teacher.teacherName}</span>
                                                <span className="ml-2 shrink-0 text-[10px] text-slate-500">{teacher.studentCount}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : null}
      </aside>
    );
  };

  const openPrincipalGrade = (grade: string) => {
    if (!principalActiveSchool) return;
    setPrincipalGrade(grade);
    setPrincipalStaff(null);
    setPrincipalStage("staff");
    setSearchQuery("");
    setTierFilter("All");
    setStatusFilter("All");
    setTeacherFilter("All");
    setHierarchySelection({
      level: "grade",
      schoolId: principalActiveSchool.schoolId,
      schoolName: principalActiveSchool.schoolName,
      grade,
    });
  };

  const openPrincipalStaffRoster = (staff: PrincipalStaffCard) => {
    if (!principalActiveSchool || !principalGrade) return;
    if (!staff.canOpenRoster) return;
    setPrincipalStaff({
      teacherName: staff.teacherName,
      teacherUserId: staff.teacherUserId,
    });
    setPrincipalStage("class");
    setSearchQuery("");
    setTierFilter("All");
    setStatusFilter("All");
    setTeacherFilter("All");
    setWorkflowMode("none");
    setAttendanceMap({});
    setHierarchySelection({
      level: "teacher",
      schoolId: principalActiveSchool.schoolId,
      schoolName: principalActiveSchool.schoolName,
      grade: principalGrade,
      teacherName: staff.teacherName,
      teacherUserId: staff.teacherUserId,
    });
  };

  const backToPrincipalGrades = () => {
    if (!principalActiveSchool) return;
    setPrincipalStage("grades");
    setPrincipalGrade(null);
    setPrincipalStaff(null);
    setSearchQuery("");
    setTierFilter("All");
    setStatusFilter("All");
    setTeacherFilter("All");
    setWorkflowMode("none");
    setAttendanceMap({});
    setHierarchySelection({
      level: "school",
      schoolId: principalActiveSchool.schoolId,
      schoolName: principalActiveSchool.schoolName,
    });
  };

  const backToPrincipalStaff = () => {
    if (!principalActiveSchool || !principalGrade) return;
    setPrincipalStage("staff");
    setPrincipalStaff(null);
    setSearchQuery("");
    setTierFilter("All");
    setStatusFilter("All");
    setTeacherFilter("All");
    setWorkflowMode("none");
    setAttendanceMap({});
    setHierarchySelection({
      level: "grade",
      schoolId: principalActiveSchool.schoolId,
      schoolName: principalActiveSchool.schoolName,
      grade: principalGrade,
    });
  };

  const sourceLabel = (source: PrincipalStaffCardSource): string => {
    if (source === "class-roster") return "Class roster";
    if (source === "staff-directory") return "Staff directory";
    return "Merged";
  };

  const renderPrincipalDrilldown = () => {
    if (!isPrincipalDrilldown) return null;

    return (
      <section className="app-card rounded-xl border border-brand-200/70 bg-gradient-to-br from-white via-brand-50/40 to-emerald-50/50 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">Principal Roster Drilldown</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              {principalStage === "grades" ? "Select a grade" : principalStage === "staff" ? "Select teacher or staff" : "Class roster"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {principalRosterContext?.label ?? "Use grade cards to reach teacher-level class rosters."}
            </p>
          </div>

          {hierarchySchools.length > 1 ? (
            <label className="text-xs font-semibold text-slate-600">
              School
              <select
                value={principalActiveSchool?.schoolId ?? ""}
                onChange={(event) => {
                  const nextSchool = hierarchySchools.find((school) => school.schoolId === event.target.value);
                  if (!nextSchool) return;
                  setPrincipalSchoolId(nextSchool.schoolId);
                  setPrincipalStage("grades");
                  setPrincipalGrade(null);
                  setPrincipalStaff(null);
                  setSearchQuery("");
                  setTierFilter("All");
                  setStatusFilter("All");
                  setTeacherFilter("All");
                  setWorkflowMode("none");
                  setAttendanceMap({});
                  setHierarchySelection({
                    level: "school",
                    schoolId: nextSchool.schoolId,
                    schoolName: nextSchool.schoolName,
                  });
                }}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              >
                {hierarchySchools.map((school) => (
                  <option key={school.schoolId} value={school.schoolId}>
                    {school.schoolName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {principalStage !== "grades" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={backToPrincipalGrades}>
              Back to grades
            </Button>
            {principalStage === "class" ? (
              <Button variant="secondary" size="sm" onClick={backToPrincipalStaff}>
                Back to teacher/staff
              </Button>
            ) : null}
          </div>
        ) : null}

        {hierarchyQuery.isLoading ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">Loading grade cards...</p>
        ) : null}
        {hierarchyError && !hierarchyQuery.isLoading ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{hierarchyError}</p>
        ) : null}

        {principalStage === "grades" && !hierarchyQuery.isLoading && !hierarchyError ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {principalGradeCards.length === 0 ? (
              <p className="col-span-full rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                No grade data is available for this school yet.
              </p>
            ) : (
              principalGradeCards.map((card) => (
                <button
                  key={card.grade}
                  type="button"
                  onClick={() => openPrincipalGrade(card.grade)}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{displayGrade(card.grade)}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{card.studentCount}</p>
                  <p className="text-xs text-slate-500">
                    {card.teacherCount} teacher/staff {card.teacherCount === 1 ? "card" : "cards"}
                  </p>
                </button>
              ))
            )}
          </div>
        ) : null}

        {principalStage === "staff" && !hierarchyQuery.isLoading && !hierarchyError ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {principalStaffCards.length === 0 ? (
              <p className="col-span-full rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                No teacher or staff cards were found for this grade.
              </p>
            ) : (
              principalStaffCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => openPrincipalStaffRoster(card)}
                  disabled={!card.canOpenRoster}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    card.canOpenRoster
                      ? "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40"
                      : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{card.teacherName}</p>
                      <p className="text-xs">{card.roleLabel}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {sourceLabel(card.source)}
                    </span>
                  </div>
                  <p className="mt-3 text-xl font-bold">{card.studentCount}</p>
                  <p className="text-xs">
                    {card.canOpenRoster ? "Open class roster" : "No class roster"}
                  </p>
                </button>
              ))
            )}
          </div>
        ) : null}

        {principalStage === "class" ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Class Context</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {principalStaff?.teacherName ?? "Selected teacher/staff"} - {principalGrade ? displayGrade(principalGrade) : "Grade"}
            </p>
            <p className="mt-1 text-xs text-slate-600">{filteredStudents.length} students currently visible in this roster.</p>
          </div>
        ) : null}
      </section>
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setTierFilter("All");
    setStatusFilter("All");
    setTeacherFilter("All");
  };

  const toggleBulkMode = () => {
    if (isBulkMode) {
      setWorkflowMode("none");
      setSelectedIds(new Set());
      return;
    }

    setWorkflowMode("bulk");
    setAttendanceMap({});
  };

  const toggleAttendanceMode = () => {
    if (!canTakeAttendance) return;
    if (isAttendanceMode) {
      setWorkflowMode("none");
      setAttendanceMap({});
      return;
    }

    const next: Record<string, AttendanceStatus> = {};
    for (const student of filteredStudents) {
      next[student.id] = "Present";
    }

    setSelectedIds(new Set());
    setAttendanceMap(next);
    setWorkflowMode("attendance");
    setViewMode("list");
  };

  const selectStudent = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredStudents.map((student) => student.id)));
  };

  const markAttendance = (id: string, status: AttendanceStatus) => {
    setAttendanceMap((current) => ({ ...current, [id]: status }));
  };

  const markAllAttendance = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    for (const student of filteredStudents) {
      next[student.id] = status;
    }
    setAttendanceMap(next);
  };

  const submitAttendance = () => {
    setIsSubmittingAttendance(true);
    window.setTimeout(() => {
      setIsSubmittingAttendance(false);
      setWorkflowMode("none");
      setAttendanceMap({});
    }, 900);
  };

  const runArchive = () => {
    if (!isMasterScope || selectedIds.size === 0) return;
    studentsApi.archiveMutation.mutate({ ids: Array.from(selectedIds), isArchived: true });
    setShowArchiveConfirm(false);
    setSelectedIds(new Set());
    setWorkflowMode("none");
  };

  const runExport = async () => {
    const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : filteredStudents.map((student) => student.id);
    if (targetIds.length === 0) return;

    setIsExporting(true);
    try {
      const params = new URLSearchParams({ scope, format: "csv", ids: targetIds.join(",") });
      const response = await fetch(`/api/students?${params.toString()}`);
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = csvName(scope);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // handled by UX state
    } finally {
      setIsExporting(false);
    }
  };

  const startEditStudent = (student: LocalStudent) => {
    if (!isMasterScope) return;
    setEditingStudent(student);
    setEditDraft({
      name: student.name,
      grade: student.grade,
      tier: student.tier,
      gpa: student.gpa,
      attendance: student.attendance,
      readingLevel: student.readingLevel,
      teacherName: student.teacherName,
      status: student.status,
    });
  };

  const saveEditedStudent = () => {
    if (!editingStudent || !editDraft) return;
    studentsApi.updateMutation.mutate({
      id: editingStudent.id,
      patch: {
        name: editDraft.name.trim(),
        grade: editDraft.grade,
        tier: editDraft.tier,
        gpa: editDraft.gpa,
        attendance: editDraft.attendance,
        readingLevel: editDraft.readingLevel,
        teacherName: editDraft.teacherName.trim() || undefined,
        status: editDraft.status,
      },
    });
    setEditingStudent(null);
    setEditDraft(null);
  };

  const saveNewStudent = () => {
    if (!isMasterScope || newStudentDraft.name.trim().length === 0) return;
    studentsApi.createMutation.mutate({
      name: newStudentDraft.name.trim(),
      grade: newStudentDraft.grade,
      tier: newStudentDraft.tier,
      gpa: newStudentDraft.gpa,
      attendance: newStudentDraft.attendance,
      readingLevel: newStudentDraft.readingLevel,
      teacherName: newStudentDraft.teacherName.trim() || undefined,
      status: newStudentDraft.status,
    });
    setIsAddStudentOpen(false);
    setNewStudentDraft(DEFAULT_DRAFT);
  };

  const openReferral = (studentId = "") => {
    setReferralStudentId(studentId);
    setIsReferralModalOpen(true);
  };

  const hasActiveFilters = searchQuery.trim().length > 0 || tierFilter !== "All" || statusFilter !== "All" || teacherFilter !== "All";
  const showRosterSections = !isPrincipalDrilldown || principalStage === "class";

  const sortIcon = (column: SortBy) => {
    if (sortBy !== column) return <ArrowUpDown size={14} className="text-slate-400" />;
    return sortDesc ? <ArrowDown size={14} className="text-brand-600" /> : <ArrowUp size={14} className="text-brand-600" />;
  };

  return (
    <div className={`space-y-5 ${embedded ? "" : "pb-16"}`}>
      <ReferralModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
        defaultStudentId={referralStudentId}
        onViewQueue={() => {
          setIsReferralModalOpen(false);
          onNavigate?.("interventions");
        }}
      />

      <DraggableModal
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        title="Archive selected students"
        initialWidth={430}
        initialHeight={210}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowArchiveConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={runArchive}>Archive {selectedCount}</Button>
          </div>
        }
      >
        <div className="p-4 text-sm text-slate-600">Archived students are removed from active roster results.</div>
      </DraggableModal>

      <DraggableModal
        isOpen={Boolean(editDraft)}
        onClose={() => {
          setEditingStudent(null);
          setEditDraft(null);
        }}
        title="Edit student"
        initialWidth={560}
        initialHeight={500}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveEditedStudent} loading={studentsApi.updateMutation.isPending}>Save</Button>
          </div>
        }
      >
        {editDraft ? (
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">Name
              <input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-500">Teacher
              <input value={editDraft.teacherName} onChange={(e) => setEditDraft({ ...editDraft, teacherName: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-500">GPA
              <input value={editDraft.gpa} onChange={(e) => setEditDraft({ ...editDraft, gpa: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-500">Attendance
              <input type="number" min={0} max={100} value={editDraft.attendance} onChange={(e) => setEditDraft({ ...editDraft, attendance: Number.parseInt(e.target.value || "0", 10) || 0 })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-500">Tier
              <select value={editDraft.tier} onChange={(e) => setEditDraft({ ...editDraft, tier: e.target.value as Tier })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value={Tier.TIER_1}>{Tier.TIER_1}</option>
                <option value={Tier.TIER_2}>{Tier.TIER_2}</option>
                <option value={Tier.TIER_3}>{Tier.TIER_3}</option>
              </select>
            </label>
          <label className="text-xs font-semibold text-slate-500">Status
            <select value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value as StudentLifecycleStatus })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="monitoring">Monitoring</option>
              <option value="completed">Completed</option>
              <option value="unknown">Needs review</option>
            </select>
          </label>
          </div>
        ) : null}
      </DraggableModal>

      <DraggableModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        title="Add student"
        initialWidth={560}
        initialHeight={500}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAddStudentOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveNewStudent} loading={studentsApi.createMutation.isPending}>Create</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">Name
            <input value={newStudentDraft.name} onChange={(e) => setNewStudentDraft({ ...newStudentDraft, name: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-500">Teacher
            <input value={newStudentDraft.teacherName} onChange={(e) => setNewStudentDraft({ ...newStudentDraft, teacherName: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-500">Tier
            <select value={newStudentDraft.tier} onChange={(e) => setNewStudentDraft({ ...newStudentDraft, tier: e.target.value as Tier })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value={Tier.TIER_1}>{Tier.TIER_1}</option>
              <option value={Tier.TIER_2}>{Tier.TIER_2}</option>
              <option value={Tier.TIER_3}>{Tier.TIER_3}</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Status
            <select value={newStudentDraft.status} onChange={(e) => setNewStudentDraft({ ...newStudentDraft, status: e.target.value as StudentLifecycleStatus })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="monitoring">Monitoring</option>
              <option value="completed">Completed</option>
              <option value="unknown">Needs review</option>
            </select>
          </label>
        </div>
      </DraggableModal>

      {!embedded ? (
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-3">
            <SidebarToggleButton onClick={onMenuClick} className="app-icon-button mt-1 -ml-1 lg:hidden" ariaLabel="Open workspace menu" />
            <div>
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Student Roster</h2>
              <p className="text-sm text-slate-500">{hierarchyContextLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => onNavigate?.("import")} className="gap-2"><Upload size={16} /> Import</Button>
            <Button variant="primary" onClick={() => openReferral()} className="gap-2"><ShieldAlert size={16} /> Create referral</Button>
          </div>
        </header>
      ) : null}

      {loadError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">Unable to load roster.</p>
          <p className="mt-1">{loadError}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void studentsApi.studentsQuery.refetch()}>Retry</Button>
        </section>
      ) : null}

      {mutationError ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Some roster actions failed.</p>
          <p className="mt-1">{mutationError}</p>
        </section>
      ) : null}

      {isPrincipalDrilldown ? renderPrincipalDrilldown() : null}

      <div className={showHierarchyTreePanel ? "grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]" : ""}>
        {showHierarchyTreePanel ? renderHierarchyPanel() : null}
        <div className={showHierarchyTreePanel ? "space-y-5" : ""}>
      {showRosterSections ? (
        <>

      {!embedded && !isAttendanceMode && !isBulkMode ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="app-card rounded-xl p-3"><p className="text-xs text-slate-500">Total students</p><p className="text-2xl font-bold text-slate-900">{classStats.total}</p></div>
          <div className="app-card rounded-xl p-3"><p className="text-xs text-slate-500">Tier 2-3</p><p className="text-2xl font-bold text-rose-600">{classStats.atRisk}</p></div>
          <div className="app-card rounded-xl p-3"><p className="text-xs text-slate-500">Avg attendance</p><p className="text-2xl font-bold text-emerald-600">{classStats.avgAttendance}%</p></div>
          <div className="app-card rounded-xl p-3"><p className="text-xs text-slate-500">Avg GPA</p><p className="text-2xl font-bold text-blue-600">{classStats.avgGpa}</p></div>
        </section>
      ) : null}

      <section className="app-card rounded-xl p-3 md:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            {isBulkMode ? <Button variant="secondary" size="sm" onClick={toggleSelectAll}><Check size={14} /></Button> : null}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, ID, or teacher" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm" />
            </div>
            <Button variant={showFilters ? "primary" : "secondary"} size="sm" onClick={() => setShowFilters((v) => !v)} className="gap-1">
              <Filter size={14} /> Filters <ChevronDown size={14} className={showFilters ? "rotate-180" : ""} />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === "grid" ? (
              <>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="rounded-md border border-slate-200 px-2 py-2 text-sm">
                  <option value="name">Name</option>
                  <option value="tier">Tier</option>
                  <option value="attendance">Attendance</option>
                  <option value="gpa">GPA</option>
                  <option value="alerts">Alerts</option>
                  <option value="reading">Reading</option>
                </select>
                <Button variant="secondary" size="sm" onClick={() => setSortDesc((v) => !v)}>{sortDesc ? <ArrowDown size={14} /> : <ArrowUp size={14} />}</Button>
              </>
            ) : null}
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setViewMode("grid")} className={viewMode === "grid" ? "bg-white" : ""}><LayoutGrid size={15} /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setViewMode("list")} className={viewMode === "list" ? "bg-white" : ""}><ListIcon size={15} /></Button>
            </div>
            <Button variant={isBulkMode ? "primary" : "secondary"} size="sm" onClick={toggleBulkMode}>{isBulkMode ? "Done" : "Select"}</Button>
            {canTakeAttendance ? (
              <Button variant={isAttendanceMode ? "primary" : "secondary"} size="sm" onClick={toggleAttendanceMode}>
                Take attendance
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => void runExport()} loading={isExporting} className="gap-1"><Download size={14} /> Export</Button>
            {isMasterScope ? <Button variant="secondary" size="sm" onClick={() => setIsAddStudentOpen(true)} className="gap-1"><UserPlus size={14} /> Add student</Button> : null}
          </div>
        </div>

        {showFilters ? (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 md:grid-cols-4">
            <label className="text-xs font-semibold text-slate-500">Tier
              <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as "All" | Tier)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm">
                <option value="All">All tiers</option>
                <option value={Tier.TIER_1}>{Tier.TIER_1}</option>
                <option value={Tier.TIER_2}>{Tier.TIER_2}</option>
                <option value={Tier.TIER_3}>{Tier.TIER_3}</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "All" | StudentLifecycleStatus)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm">
                <option value="All">All status</option>
                <option value="active">Active</option>
                <option value="monitoring">Monitoring</option>
                <option value="completed">Completed</option>
                <option value="unknown">Needs review</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">Teacher
              <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm">
                <option value="All">All teachers</option>
                {teacherOptions.map((teacher) => <option key={teacher} value={teacher}>{teacher}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowFilters(false)}>Apply</Button>
              <Button variant="ghost" size="sm" onClick={clearFilters}>Reset</Button>
            </div>
          </div>
        ) : null}

        {hasActiveFilters ? (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span>{filteredStudents.length} students</span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>
          </div>
        ) : null}
      </section>

      {isBulkMode ? (
        <section className="app-card sticky top-3 z-20 rounded-xl border-slate-800 bg-slate-900 px-4 py-3 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{selectedCount} selected</p>
            <div className="ml-auto flex items-center gap-2">
              {isMasterScope ? <Button variant="danger" size="sm" disabled={selectedCount === 0} onClick={() => setShowArchiveConfirm(true)}>Archive</Button> : null}
              <Button variant="secondary" size="sm" disabled={selectedCount === 0} onClick={() => void runExport()}>Export</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
            </div>
          </div>
        </section>
      ) : null}

      {isAttendanceMode && canTakeAttendance ? (
        <section className="app-card rounded-xl border-emerald-200 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-emerald-700">Present {attendanceSummary.present}</span>
            <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-amber-700">Late {attendanceSummary.late}</span>
            <span className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-rose-700">Absent {attendanceSummary.absent}</span>
            <span className="ml-1 text-slate-600">{attendanceSummary.total} visible students</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => markAllAttendance("Present")}>All present</Button>
              <Button variant="secondary" size="sm" onClick={() => markAllAttendance("Late")}>All late</Button>
              <Button variant="secondary" size="sm" onClick={() => markAllAttendance("Absent")}>All absent</Button>
              <Button variant="ghost" size="sm" onClick={toggleAttendanceMode}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={submitAttendance} loading={isSubmittingAttendance}>Save attendance</Button>
            </div>
          </div>
        </section>
      ) : null}

      {studentsApi.studentsQuery.isLoading ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="app-card animate-pulse rounded-xl p-4">
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-1/3 rounded bg-slate-200" />
              <div className="mt-4 h-20 rounded bg-slate-100" />
            </div>
          ))}
        </section>
      ) : null}

      {!studentsApi.studentsQuery.isLoading && filteredStudents.length === 0 ? (
        <section className="app-card flex flex-col items-center rounded-xl border-dashed p-10 text-center">
          <Search size={36} className="text-slate-400" />
          <p className="mt-3 font-semibold text-slate-700">No students found for these filters.</p>
          {hasActiveFilters ? <Button variant="secondary" size="sm" onClick={clearFilters} className="mt-3">Clear filters</Button> : null}
        </section>
      ) : null}

      {!studentsApi.studentsQuery.isLoading && filteredStudents.length > 0 && viewMode === "grid" ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredStudents.map((student) => {
            const selected = selectedIds.has(student.id);
            const attendanceStatus = attendanceMap[student.id] ?? "Present";
            const tierTone = getTierTone(student.tier);
            const attendanceTone = getAttendanceTone(student.attendance);
            const gpaTone = getGpaTone(student.gpa);
            const readingRisk = evaluateReadingRisk({
              grade: student.grade,
              readingLevel: student.readingLevel,
              role: currentUserRole,
              benchmarks: readingBenchmarks,
            });
            const readingTone = readingRisk.tone;
            const canOpenDetails = !isBulkMode && !isAttendanceMode;
            const isCardInteractive = !isAttendanceMode;
            const handleCardActivate = () => {
              if (isBulkMode) {
                selectStudent(student.id);
                return;
              }
              onStudentClick(student.name);
            };
            return (
              <article
                key={student.id}
                className={`app-card rounded-xl p-4 ${selected ? "ring-2 ring-brand-500" : ""} ${isCardInteractive ? "student-card-clickable" : ""}`}
                role={isCardInteractive ? "button" : undefined}
                tabIndex={isCardInteractive ? 0 : undefined}
                onClick={isCardInteractive ? handleCardActivate : undefined}
                onKeyDown={isCardInteractive ? (event) => activateWithKeyboard(event, handleCardActivate) : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {isBulkMode ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectStudent(student.id);
                        }}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${selected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-400"}`}
                        aria-label={`Select ${student.name}`}
                      >
                        <Check size={16} />
                      </button>
                    ) : (
                      <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${student.avatarSeed}&backgroundColor=e0e7ff`} alt={student.name} className="h-10 w-10 rounded-full border border-slate-200" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-800">{student.name}</p>
                      <p className="text-xs text-slate-500">{student.id}</p>
                      {viewType === "master" ? <p className="text-xs text-slate-500">{student.teacherName}</p> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {student.alerts > 0 ? (
                      <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        <AlertCircle size={12} className="mr-1 inline" />
                        {student.alerts}
                      </span>
                    ) : null}
                    {canOpenDetails ? (
                      <span className="student-open-cue">
                        View details
                        <ChevronRight size={14} />
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span className={`signal-pill ${signalToneClass(tierTone)}`}>{student.tier}</span>
                  <span className="signal-pill signal-neutral">{statusLabel(student.status)}</span>
                  {isAttendanceMode ? <span className="signal-pill signal-neutral">{attendanceStatus}</span> : null}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <div className={`signal-tile ${signalToneClass(gpaTone)}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">GPA</p>
                    <p className="mt-1 text-base font-semibold leading-tight">{student.gpa}</p>
                    <p className="text-[11px] opacity-90">{riskToneLabel(gpaTone)}</p>
                  </div>
                  <div className={`signal-tile ${signalToneClass(attendanceTone)}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Attendance</p>
                    <p className="mt-1 text-base font-semibold leading-tight">{student.attendance}%</p>
                    <p className="text-[11px] opacity-90">{riskToneLabel(attendanceTone)}</p>
                  </div>
                  <div className={`signal-tile ${signalToneClass(readingTone)}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Reading</p>
                    <p className="mt-1 text-base font-semibold leading-tight">{student.readingLevel}</p>
                    <p className="text-[11px] opacity-90">{readingRisk.label}</p>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  {isAttendanceMode ? (
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); markAttendance(student.id, "Present"); }}>Present</Button>
                      <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); markAttendance(student.id, "Late"); }}>Late</Button>
                      <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); markAttendance(student.id, "Absent"); }}>Absent</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                      {isMasterScope ? <Button size="sm" variant="secondary" onClick={() => startEditStudent(student)} className="flex-1 gap-1"><Pencil size={12} /> Edit</Button> : null}
                      <Button size="sm" variant="secondary" onClick={() => openReferral(student.id)} className="flex-1 gap-1"><ShieldAlert size={12} /> Create referral</Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {!studentsApi.studentsQuery.isLoading && filteredStudents.length > 0 && viewMode === "list" ? (
        <section className="app-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="min-w-[840px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {isBulkMode ? <th className="px-3 py-3">Sel</th> : null}
                  <th className="px-4 py-3"><button type="button" onClick={() => setSortBy("name")} className="flex items-center gap-1">Student {sortIcon("name")}</button></th>
                  <th className="px-3 py-3">Teacher</th>
                  <th className="px-3 py-3"><button type="button" onClick={() => setSortBy("tier")} className="flex items-center gap-1">Tier {sortIcon("tier")}</button></th>
                  <th className="px-3 py-3 text-center"><button type="button" onClick={() => setSortBy("gpa")} className="mx-auto flex items-center gap-1">GPA {sortIcon("gpa")}</button></th>
                  <th className="px-3 py-3"><button type="button" onClick={() => setSortBy("attendance")} className="flex items-center gap-1">Attendance {sortIcon("attendance")}</button></th>
                  <th className="px-3 py-3 text-center"><button type="button" onClick={() => setSortBy("reading")} className="mx-auto flex items-center gap-1">Reading {sortIcon("reading")}</button></th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const selected = selectedIds.has(student.id);
                  const tierTone = getTierTone(student.tier);
                  const attendanceTone = getAttendanceTone(student.attendance);
                  const gpaTone = getGpaTone(student.gpa);
                  const readingRisk = evaluateReadingRisk({
                    grade: student.grade,
                    readingLevel: student.readingLevel,
                    role: currentUserRole,
                    benchmarks: readingBenchmarks,
                  });
                  const readingTone = readingRisk.tone;
                  const canOpenDetails = !isBulkMode && !isAttendanceMode;
                  const isRowInteractive = !isAttendanceMode;
                  const handleRowActivate = () => {
                    if (isBulkMode) {
                      selectStudent(student.id);
                      return;
                    }
                    onStudentClick(student.name);
                  };
                  return (
                    <tr
                      key={student.id}
                      className={`${selected ? "bg-brand-50/50" : ""} ${isRowInteractive ? "student-row-clickable" : ""}`}
                      role={isRowInteractive ? "button" : undefined}
                      tabIndex={isRowInteractive ? 0 : undefined}
                      onClick={isRowInteractive ? handleRowActivate : undefined}
                      onKeyDown={isRowInteractive ? (event) => activateWithKeyboard(event, handleRowActivate) : undefined}
                    >
                      {isBulkMode ? (
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => selectStudent(student.id)}
                            aria-label={`Select ${student.name}`}
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-500">{student.id}</p>
                        {canOpenDetails ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700">
                            View details
                            <ChevronRight size={12} />
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{student.teacherName}</td>
                      <td className="px-3 py-3"><span className={`signal-pill ${signalToneClass(tierTone)}`}>{student.tier}</span></td>
                      <td className="px-3 py-3 text-center"><span className={`signal-inline ${signalToneClass(gpaTone)}`}>{student.gpa}</span></td>
                      <td className="px-3 py-3"><span className={`signal-inline ${signalToneClass(attendanceTone)}`}>{student.attendance}%</span></td>
                      <td className="px-3 py-3 text-center">
                        <span className={`signal-inline ${signalToneClass(readingTone)}`} title={readingRisk.label}>
                          {student.readingLevel}
                        </span>
                      </td>
                      <td className="px-3 py-3"><span className="signal-pill signal-neutral">{statusLabel(student.status)}</span></td>
                      <td className="px-3 py-3 text-right">
                        {isAttendanceMode ? (
                          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                            <Button size="icon-sm" variant="secondary" onClick={() => markAttendance(student.id, "Present")} aria-label={`Mark ${student.name} present`}><CheckCircle2 size={14} /></Button>
                            <Button size="icon-sm" variant="secondary" onClick={() => markAttendance(student.id, "Late")} aria-label={`Mark ${student.name} late`}><Clock size={14} /></Button>
                            <Button size="icon-sm" variant="secondary" onClick={() => markAttendance(student.id, "Absent")} aria-label={`Mark ${student.name} absent`}><XCircle size={14} /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                            {canOpenDetails ? <span className="student-open-cue hidden sm:inline-flex">View details <ChevronRight size={13} /></span> : null}
                            {isMasterScope ? <Button size="icon-sm" variant="ghost" onClick={() => startEditStudent(student)}><Pencil size={14} /></Button> : null}
                            <Button size="icon-sm" variant="ghost" onClick={() => openReferral(student.id)}><ShieldAlert size={14} /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
        </>
      ) : null}
        </div>
      </div>
    </div>
  );
};
