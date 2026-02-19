import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Pencil,
  Search,
  ShieldAlert,
  Upload,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Tier, type StudentRosterItem } from "../types";
import { useStudents } from "../hooks/useStudents";
import type { WorkspacePageId } from "../lib/workspaceRoutes";
import { ReferralModal } from "./ReferralModal";
import { DraggableModal } from "./DraggableModal";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { Button } from "./ui/Button";

type StudentRosterViewProps = {
  onMenuClick: () => void;
  onStudentClick: (name: string) => void;
  viewType?: "classroom" | "master";
  embedded?: boolean;
  onNavigate?: (page: WorkspacePageId) => void;
};

type ViewMode = "grid" | "list";
type WorkflowMode = "none" | "bulk" | "attendance";
type AttendanceStatus = "Present" | "Late" | "Absent";
type SortBy = "name" | "tier" | "attendance" | "gpa" | "alerts" | "reading";
type StudentLifecycleStatus = "active" | "monitoring" | "completed" | "unknown";

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
  return "Unknown";
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

const csvName = (scope: "master" | "class") => {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${scope}-roster-${stamp}.csv`;
};

export const StudentRosterView: React.FC<StudentRosterViewProps> = ({ onMenuClick, onStudentClick, viewType = "classroom", embedded = false, onNavigate }) => {
  const scope = viewType === "master" ? "master" : "class";
  const isMasterScope = scope === "master";
  const studentsApi = useStudents(scope);

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

  const loadError = studentsApi.studentsQuery.error instanceof Error ? studentsApi.studentsQuery.error.message : null;
  const mutationError = studentsApi.mutationError instanceof Error ? studentsApi.mutationError.message : null;

  const students = useMemo(() => {
    const rows = studentsApi.studentsQuery.data?.rows ?? [];
    return rows.map(normalizeStudent);
  }, [studentsApi.studentsQuery.data?.rows]);

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
                <option value="unknown">Unknown</option>
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
              <option value="unknown">Unknown</option>
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
              <p className="text-sm text-slate-500">{viewType === "master" ? "School-wide monitored roster" : "Classroom roster"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => onNavigate?.("import")} className="gap-2"><Upload size={16} /> Import roster</Button>
            <Button variant="primary" onClick={() => openReferral()} className="gap-2"><ShieldAlert size={16} /> New referral</Button>
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

      {!embedded && !isAttendanceMode && !isBulkMode ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="app-card rounded-xl p-3"><p className="text-xs text-slate-500">Students</p><p className="text-2xl font-bold text-slate-900">{classStats.total}</p></div>
          <div className="app-card rounded-xl p-3"><p className="text-xs text-slate-500">Tier 2 and 3</p><p className="text-2xl font-bold text-rose-600">{classStats.atRisk}</p></div>
          <div className="app-card rounded-xl p-3"><p className="text-xs text-slate-500">Attendance avg</p><p className="text-2xl font-bold text-emerald-600">{classStats.avgAttendance}%</p></div>
          <div className="app-card rounded-xl p-3"><p className="text-xs text-slate-500">Average GPA</p><p className="text-2xl font-bold text-blue-600">{classStats.avgGpa}</p></div>
        </section>
      ) : null}

      <section className="app-card rounded-xl p-3 md:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            {isBulkMode ? <Button variant="secondary" size="sm" onClick={toggleSelectAll}><Check size={14} /></Button> : null}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search student, ID, or teacher" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm" />
            </div>
            <Button variant={showFilters ? "primary" : "secondary"} size="sm" onClick={() => setShowFilters((v) => !v)} className="gap-1">
              <Filter size={14} /> Filters <ChevronDown size={14} className={showFilters ? "rotate-180" : ""} />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === "grid" ? (
              <>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="rounded-md border border-slate-200 px-2 py-2 text-sm">
                  <option value="name">Sort: Name</option>
                  <option value="tier">Sort: Tier</option>
                  <option value="attendance">Sort: Attendance</option>
                  <option value="gpa">Sort: GPA</option>
                  <option value="alerts">Sort: Alerts</option>
                  <option value="reading">Sort: Reading</option>
                </select>
                <Button variant="secondary" size="sm" onClick={() => setSortDesc((v) => !v)}>{sortDesc ? <ArrowDown size={14} /> : <ArrowUp size={14} />}</Button>
              </>
            ) : null}
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setViewMode("grid")} className={viewMode === "grid" ? "bg-white" : ""}><LayoutGrid size={15} /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setViewMode("list")} className={viewMode === "list" ? "bg-white" : ""}><ListIcon size={15} /></Button>
            </div>
            <Button variant={isBulkMode ? "primary" : "secondary"} size="sm" onClick={toggleBulkMode}>{isBulkMode ? "Exit bulk" : "Bulk select"}</Button>
            <Button variant={isAttendanceMode ? "primary" : "secondary"} size="sm" onClick={toggleAttendanceMode}>Attendance</Button>
            <Button variant="secondary" size="sm" onClick={() => void runExport()} loading={isExporting} className="gap-1"><Download size={14} /> Export</Button>
            {isMasterScope ? <Button variant="secondary" size="sm" onClick={() => setIsAddStudentOpen(true)} className="gap-1"><UserPlus size={14} /> New</Button> : null}
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
                <option value="All">All statuses</option>
                <option value="active">Active</option>
                <option value="monitoring">Monitoring</option>
                <option value="completed">Completed</option>
                <option value="unknown">Unknown</option>
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
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
            </div>
          </div>
        ) : null}

        {hasActiveFilters ? (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span>{filteredStudents.length} results</span>
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
              <Button variant="secondary" size="sm" disabled={selectedCount === 0} onClick={() => void runExport()}>Export selected</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          </div>
        </section>
      ) : null}

      {isAttendanceMode ? (
        <section className="app-card rounded-xl border-emerald-200 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-emerald-700">Present {attendanceSummary.present}</span>
            <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-amber-700">Late {attendanceSummary.late}</span>
            <span className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-rose-700">Absent {attendanceSummary.absent}</span>
            <span className="ml-1 text-slate-600">{attendanceSummary.total} visible students</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => markAllAttendance("Present")}>Mark all present</Button>
              <Button variant="secondary" size="sm" onClick={() => markAllAttendance("Late")}>Mark all late</Button>
              <Button variant="secondary" size="sm" onClick={() => markAllAttendance("Absent")}>Mark all absent</Button>
              <Button variant="ghost" size="sm" onClick={toggleAttendanceMode}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={submitAttendance} loading={isSubmittingAttendance}>Submit</Button>
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
          <p className="mt-3 font-semibold text-slate-700">No students match current filters.</p>
          {hasActiveFilters ? <Button variant="secondary" size="sm" onClick={clearFilters} className="mt-3">Clear filters</Button> : null}
        </section>
      ) : null}

      {!studentsApi.studentsQuery.isLoading && filteredStudents.length > 0 && viewMode === "grid" ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredStudents.map((student) => {
            const selected = selectedIds.has(student.id);
            const attendanceStatus = attendanceMap[student.id] ?? "Present";
            return (
              <article key={student.id} className={`app-card rounded-xl p-4 ${selected ? "ring-2 ring-brand-500" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {isBulkMode ? (
                      <button type="button" onClick={() => selectStudent(student.id)} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${selected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-400"}`}><Check size={16} /></button>
                    ) : (
                      <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${student.avatarSeed}&backgroundColor=e0e7ff`} alt={student.name} className="h-10 w-10 rounded-full border border-slate-200" />
                    )}
                    <div>
                      <button type="button" className="text-left font-semibold text-slate-800 hover:text-brand-700" onClick={() => (isBulkMode ? selectStudent(student.id) : onStudentClick(student.name))}>{student.name}</button>
                      <p className="text-xs text-slate-500">{student.id}</p>
                      {viewType === "master" ? <p className="text-xs text-slate-500">{student.teacherName}</p> : null}
                    </div>
                  </div>
                  {student.alerts > 0 ? <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"><AlertCircle size={12} className="mr-1 inline" />{student.alerts}</span> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">{student.tier}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">{statusLabel(student.status)}</span>
                  {isAttendanceMode ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">{attendanceStatus}</span> : null}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-2"><p className="text-slate-500">GPA</p><p className="font-semibold text-slate-800">{student.gpa}</p></div>
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-2"><p className="text-slate-500">Attend</p><p className="font-semibold text-slate-800">{student.attendance}%</p></div>
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-2"><p className="text-slate-500">Reading</p><p className="font-semibold text-slate-800">{student.readingLevel}</p></div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  {isAttendanceMode ? (
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant="secondary" onClick={() => markAttendance(student.id, "Present")}>Present</Button>
                      <Button size="sm" variant="secondary" onClick={() => markAttendance(student.id, "Late")}>Late</Button>
                      <Button size="sm" variant="secondary" onClick={() => markAttendance(student.id, "Absent")}>Absent</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {isMasterScope ? <Button size="sm" variant="secondary" onClick={() => startEditStudent(student)} className="flex-1 gap-1"><Pencil size={12} /> Edit</Button> : null}
                      <Button size="sm" variant="secondary" onClick={() => openReferral(student.id)} className="flex-1 gap-1"><ShieldAlert size={12} /> Refer</Button>
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
                  return (
                    <tr key={student.id} className={selected ? "bg-brand-50/50" : "hover:bg-slate-50"}>
                      {isBulkMode ? <td className="px-3 py-3"><input type="checkbox" checked={selected} onChange={() => selectStudent(student.id)} /></td> : null}
                      <td className="px-4 py-3"><button type="button" className="font-semibold text-slate-800 hover:text-brand-700" onClick={() => onStudentClick(student.name)}>{student.name}</button><p className="text-xs text-slate-500">{student.id}</p></td>
                      <td className="px-3 py-3 text-slate-600">{student.teacherName}</td>
                      <td className="px-3 py-3">{student.tier}</td>
                      <td className="px-3 py-3 text-center">{student.gpa}</td>
                      <td className="px-3 py-3">{student.attendance}%</td>
                      <td className="px-3 py-3 text-center">{student.readingLevel}</td>
                      <td className="px-3 py-3">{statusLabel(student.status)}</td>
                      <td className="px-3 py-3 text-right">
                        {isAttendanceMode ? (
                          <div className="flex justify-end gap-1">
                            <Button size="icon-sm" variant="secondary" onClick={() => markAttendance(student.id, "Present")} aria-label={`Mark ${student.name} present`}><CheckCircle2 size={14} /></Button>
                            <Button size="icon-sm" variant="secondary" onClick={() => markAttendance(student.id, "Late")} aria-label={`Mark ${student.name} late`}><Clock size={14} /></Button>
                            <Button size="icon-sm" variant="secondary" onClick={() => markAttendance(student.id, "Absent")} aria-label={`Mark ${student.name} absent`}><XCircle size={14} /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
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
    </div>
  );
};
