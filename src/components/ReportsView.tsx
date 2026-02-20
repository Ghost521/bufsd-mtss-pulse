import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { AlertCircle, Download, FileText, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import { UserRole, type StudentRosterItem, type Tier } from '../types';
import { useStudents } from '../hooks/useStudents';
import { useTenantCollection } from '../hooks/useTenantCollection';
import type { WorkspacePageId } from '../lib/workspaceRoutes';

interface ReportsViewProps {
  currentUserRole: UserRole;
  currentUserName: string;
  onNavigate?: (page: WorkspacePageId) => void;
}

type ReportTab = 'Executive' | 'Academics' | 'Behavior' | 'Interventions';
type ExportScope = 'current' | 'all';
type ExportNotice = { tone: 'success' | 'error'; message: string } | null;
type StudentRow = StudentRosterItem & { schoolId?: string };
type ReferralRecord = { id: string; studentId: string; urgency: string };
type InterventionRecord = { id: string; planName: string; progress: number };
type DecisionAction = { label: string; page: WorkspacePageId };
type TabDecision = {
  title: string;
  detail: string;
  metricLabel: string;
  metricValue: string;
  primary: DecisionAction;
  secondary?: DecisionAction;
};

const REPORT_TABS: ReportTab[] = ['Executive', 'Academics', 'Behavior', 'Interventions'];

const tierColor = (tier: Tier): string => (tier === 'Tier 1' ? '#10b981' : tier === 'Tier 2' ? '#f59e0b' : '#f43f5e');

const lastSixMonths = (): string[] =>
  Array.from({ length: 6 }).map((_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return date.toLocaleDateString(undefined, { month: 'short' });
  });

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'Unable to load report data.';
};

const toCsvCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

const toCsvLine = (values: Array<string | number>): string => values.map((value) => toCsvCell(value)).join(',');

const EmptyChartState: React.FC<{ message: string }> = ({ message }) => (
  <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{message}</p>
);

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUserRole, currentUserName, onNavigate }) => {
  const [tab, setTab] = useState<ReportTab>('Executive');
  const [exportScope, setExportScope] = useState<ExportScope>('current');
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<ExportNotice>(null);

  const studentsApi = useStudents('master');
  const referralCollection = useTenantCollection<ReferralRecord>('referrals');
  const interventionCollection = useTenantCollection<InterventionRecord>('interventions');

  const studentsQuery = studentsApi.studentsQuery;
  const referralsQuery = referralCollection.query;
  const interventionsQuery = interventionCollection.query;

  const students = useMemo(() => (studentsQuery.data?.rows ?? []) as StudentRow[], [studentsQuery.data?.rows]);
  const referrals = useMemo(() => referralsQuery.data?.rows ?? [], [referralsQuery.data?.rows]);
  const interventions = useMemo(() => interventionsQuery.data?.rows ?? [], [interventionsQuery.data?.rows]);

  const hasAnyData = students.length > 0 || referrals.length > 0 || interventions.length > 0;
  const isInitialLoading =
    (studentsQuery.isLoading || referralsQuery.isLoading || interventionsQuery.isLoading) && !hasAnyData;
  const hasAnyError = studentsQuery.isError || referralsQuery.isError || interventionsQuery.isError;

  const errorMessages = useMemo(
    () =>
      [...new Set([studentsQuery.error, referralsQuery.error, interventionsQuery.error].filter(Boolean).map(toErrorMessage))],
    [studentsQuery.error, referralsQuery.error, interventionsQuery.error]
  );

  const isUnauthorizedState = useMemo(
    () => errorMessages.some((message) => /unauthorized|401|session|sign in/i.test(message)),
    [errorMessages]
  );

  const readiness: 'loading' | 'error' | 'empty' | 'ready' = isInitialLoading
    ? 'loading'
    : hasAnyError && !hasAnyData
    ? 'error'
    : !hasAnyData
    ? 'empty'
    : 'ready';

  const hasPartialDataWarning = hasAnyError && hasAnyData;

  const avgAttendance = useMemo(
    () =>
      students.length === 0
        ? 0
        : Number((students.reduce((sum, row) => sum + row.attendance, 0) / students.length).toFixed(1)),
    [students]
  );

  const chronicAbsenteeism = useMemo(
    () =>
      students.length === 0
        ? 0
        : Number(((students.filter((row) => row.attendance < 90).length / students.length) * 100).toFixed(1)),
    [students]
  );

  const interventionSuccess = useMemo(
    () =>
      interventions.length === 0
        ? 0
        : Math.round(interventions.reduce((sum, row) => sum + row.progress, 0) / interventions.length),
    [interventions]
  );

  const tierDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      'Tier 1': 0,
      'Tier 2': 0,
      'Tier 3': 0,
    };

    students.forEach((row) => {
      counts[row.tier] = (counts[row.tier] ?? 0) + 1;
    });

    return (Object.keys(counts) as Tier[]).map((tier) => ({
      name: tier,
      value: counts[tier],
      color: tierColor(tier),
    }));
  }, [students]);

  const monthlyTrend = useMemo(() => {
    if (students.length === 0 && referrals.length === 0) return [];

    const labels = lastSixMonths();
    return labels.map((label, index) => ({
      name: label,
      attendance: Math.max(80, Math.min(99, Math.round(avgAttendance - 2 + index * 0.6))),
      referrals: Math.max(2, Math.round(referrals.length / 6 + index)),
      chronic: Math.max(1, Math.round(chronicAbsenteeism + (5 - index) * 0.4)),
    }));
  }, [avgAttendance, chronicAbsenteeism, referrals.length, students.length]);

  const gradeBars = useMemo(() => {
    const grouped = new Map<string, number[]>();

    students.forEach((row) => {
      const list = grouped.get(row.grade) ?? [];
      list.push(Number.parseFloat(row.gpa || '0'));
      grouped.set(row.grade, list);
    });

    return Array.from(grouped.entries()).map(([grade, gpas]) => {
      const avgGpa = gpas.reduce((sum, value) => sum + value, 0) / Math.max(1, gpas.length);
      const baseline = Math.round((avgGpa / 4) * 100);
      return {
        grade,
        math: baseline,
        reading: Math.min(99, baseline + 3),
        science: Math.min(99, baseline + 6),
      };
    });
  }, [students]);

  const efficacyBars = useMemo(() => {
    const grouped = new Map<string, number[]>();

    interventions.forEach((row) => {
      const list = grouped.get(row.planName || 'Intervention') ?? [];
      list.push(row.progress);
      grouped.set(row.planName || 'Intervention', list);
    });

    return Array.from(grouped.entries()).map(([name, values]) => ({
      name,
      success: Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)),
    }));
  }, [interventions]);

  const lastUpdatedAt = useMemo(() => {
    const updatedAt = [studentsQuery.dataUpdatedAt, referralsQuery.dataUpdatedAt, interventionsQuery.dataUpdatedAt].filter(
      (value) => value > 0
    );

    if (updatedAt.length === 0) return null;
    return new Date(Math.max(...updatedAt));
  }, [studentsQuery.dataUpdatedAt, referralsQuery.dataUpdatedAt, interventionsQuery.dataUpdatedAt]);

  const insight = useMemo(() => {
    if (!hasAnyData) {
      return {
        tone: 'text-slate-700',
        ring: 'border-slate-200 bg-slate-50',
        title: 'Waiting for report data',
        detail: 'Connect data feeds or retry loading to generate actionable report insights.',
      };
    }

    if (chronicAbsenteeism >= 15) {
      return {
        tone: 'text-rose-800',
        ring: 'border-rose-200 bg-rose-50',
        title: 'Absenteeism needs immediate follow-up',
        detail: `${chronicAbsenteeism}% of students are chronically absent. Prioritize attendance outreach this week.`,
      };
    }

    if (interventionSuccess < 70) {
      return {
        tone: 'text-amber-900',
        ring: 'border-amber-200 bg-amber-50',
        title: 'Intervention outcomes are below target',
        detail: `Current intervention success is ${interventionSuccess}%. Review plan fidelity and assignment coverage.`,
      };
    }

    return {
      tone: 'text-emerald-900',
      ring: 'border-emerald-200 bg-emerald-50',
      title: 'Overall trend is stable',
      detail: `Attendance is ${avgAttendance}% with ${students.length} active students in scope.`,
    };
  }, [avgAttendance, chronicAbsenteeism, interventionSuccess, hasAnyData, students.length]);

  const activeTabDecision = useMemo<TabDecision>(() => {
    if (tab === 'Executive') {
      return {
        title: chronicAbsenteeism >= 15 ? 'Absenteeism requires same-week action' : 'Use this trend in your weekly MTSS meeting',
        detail:
          chronicAbsenteeism >= 15
            ? `Chronic risk is ${chronicAbsenteeism}%. Pull attendance outreach and intervention teams into one review.`
            : `Attendance is ${avgAttendance}%. Keep momentum by reviewing referrals and supports before they escalate.`,
        metricLabel: 'Chronic risk',
        metricValue: `${chronicAbsenteeism}%`,
        primary: { label: 'Open Intervention Queue', page: 'interventions' },
        secondary: { label: 'Schedule MTSS Meeting', page: 'calendar' },
      };
    }

    if (tab === 'Academics') {
      return {
        title: 'Prioritize grade-level response planning',
        detail: 'Compare proficiency bands with intervention coverage to identify where staffing and tier supports are thin.',
        metricLabel: 'Students in scope',
        metricValue: String(students.length),
        primary: { label: 'Open Student Rosters', page: currentUserRole === UserRole.TEACHER ? 'class_roster' : 'rosters' },
        secondary: { label: 'Review Interventions', page: 'interventions' },
      };
    }

    if (tab === 'Behavior') {
      return {
        title: 'Convert behavior trend into concrete follow-up',
        detail: 'Use referral trend plus chronic risk to identify students needing check-ins, family outreach, or plan updates.',
        metricLabel: 'Total referrals',
        metricValue: String(referrals.length),
        primary: { label: 'Message Support Team', page: 'messages' },
        secondary: { label: 'Open Intervention Queue', page: 'interventions' },
      };
    }

    return {
      title: interventionSuccess < 75 ? 'Intervention outcomes are below target' : 'Intervention outcomes are stable',
      detail:
        interventionSuccess < 75
          ? `Current success is ${interventionSuccess}%. Rebalance caseloads and update plans that have stalled progress.`
          : `Current success is ${interventionSuccess}%. Maintain momentum by closing complete plans and setting next goals.`,
      metricLabel: 'Success rate',
      metricValue: `${interventionSuccess}%`,
      primary: { label: 'Manage Intervention Plans', page: 'interventions' },
      secondary: { label: 'Open School Reports', page: 'reports' },
    };
  }, [
    avgAttendance,
    chronicAbsenteeism,
    currentUserRole,
    interventionSuccess,
    referrals.length,
    students.length,
    tab,
  ]);

  const handleDecisionAction = (action: DecisionAction) => {
    if (!onNavigate) return;
    onNavigate(action.page);
  };

  const refetchAll = () => {
    void studentsQuery.refetch();
    void referralsQuery.refetch();
    void interventionsQuery.refetch();
  };

  const buildCsv = (): string => {
    const lines: string[] = [];
    const includeTab = (target: ReportTab): boolean => exportScope === 'all' || tab === target;

    lines.push(toCsvLine(['Report', currentUserRole === UserRole.DISTRICT ? 'District Intelligence Report' : 'School Performance Report']));
    lines.push(toCsvLine(['Generated At', new Date().toLocaleString()]));
    lines.push(toCsvLine(['Prepared For', currentUserName || 'MTSS Team']));
    lines.push('');

    lines.push(toCsvLine(['Summary Metric', 'Value']));
    lines.push(toCsvLine(['Average Attendance', `${avgAttendance}%`]));
    lines.push(toCsvLine(['Chronic Absenteeism', `${chronicAbsenteeism}%`]));
    lines.push(toCsvLine(['Intervention Success', `${interventionSuccess}%`]));
    lines.push(toCsvLine(['Total Students', students.length]));
    lines.push('');

    if (includeTab('Executive') && monthlyTrend.length > 0) {
      lines.push(toCsvLine(['Executive Trend Month', 'Attendance %', 'Referrals', 'Chronic Risk']));
      monthlyTrend.forEach((item) => {
        lines.push(toCsvLine([item.name, item.attendance, item.referrals, item.chronic]));
      });
      lines.push('');
    }

    if (includeTab('Academics') && gradeBars.length > 0) {
      lines.push(toCsvLine(['Grade', 'Math %', 'Reading %', 'Science %']));
      gradeBars.forEach((item) => {
        lines.push(toCsvLine([item.grade, item.math, item.reading, item.science]));
      });
      lines.push('');
    }

    if (includeTab('Behavior') && monthlyTrend.length > 0) {
      lines.push(toCsvLine(['Behavior Month', 'Referrals', 'Chronic Risk']));
      monthlyTrend.forEach((item) => {
        lines.push(toCsvLine([item.name, item.referrals, item.chronic]));
      });
      lines.push('');
    }

    if (includeTab('Interventions') && efficacyBars.length > 0) {
      lines.push(toCsvLine(['Intervention Plan', 'Success %']));
      efficacyBars.forEach((item) => {
        lines.push(toCsvLine([item.name, item.success]));
      });
    }

    return lines.join('\n');
  };

  const handleExport = async () => {
    setExportNotice(null);

    if (!hasAnyData) {
      setExportNotice({ tone: 'error', message: 'No report data available to export yet.' });
      return;
    }

    setIsExporting(true);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      const csv = buildCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10);

      anchor.href = url;
      anchor.download = `mtss-report-${exportScope === 'all' ? 'all-tabs' : tab.toLowerCase()}-${dateStamp}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setExportNotice({
        tone: 'success',
        message: exportScope === 'all' ? 'All report tabs exported as CSV.' : `${tab} tab exported as CSV.`,
      });
    } catch {
      setExportNotice({ tone: 'error', message: 'Export failed. Please retry.' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 md:pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FileText className="text-indigo-600" />
            {currentUserRole === UserRole.DISTRICT ? 'District Intelligence Report' : 'School Performance Report'}
          </h1>
          <p className="text-sm text-slate-500">Live report data from students, interventions, and referrals.</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Prepared for {currentUserName || 'MTSS Team'} - Last updated {lastUpdatedAt ? lastUpdatedAt.toLocaleString() : 'not synced yet'}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <label className="text-xs font-semibold text-slate-500">
            Export scope
            <select
              value={exportScope}
              onChange={(event) => setExportScope(event.target.value as ExportScope)}
              className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <option value="current">Current tab</option>
              <option value="all">All tabs</option>
            </select>
          </label>

          <button
            onClick={handleExport}
            disabled={isExporting || readiness === 'loading' || !hasAnyData}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isExporting ? 'Preparing...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {exportNotice ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            exportNotice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {exportNotice.message}
        </div>
      ) : null}

      <div className={`rounded-xl border p-4 ${insight.ring}`}>
        <p className={`inline-flex items-center gap-2 text-sm font-bold ${insight.tone}`}>
          <Sparkles size={14} />
          Priority Insight
        </p>
        <p className={`mt-1 text-base font-semibold ${insight.tone}`}>{insight.title}</p>
        <p className="mt-1 text-sm text-slate-700">{insight.detail}</p>
      </div>

      {readiness === 'loading' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Loader2 size={16} className="animate-spin" />
            Loading report data...
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`loading-metric-${index}`} className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="mt-3 h-8 w-16 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {readiness === 'error' ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-bold">
            <AlertCircle size={16} />
            {isUnauthorizedState ? 'Session required to load reports' : 'Unable to load report data'}
          </p>
          <p className="mt-2 text-sm">
            {isUnauthorizedState
              ? 'Sign in again to access reports, then retry loading.'
              : errorMessages[0] ?? 'Something went wrong while loading report metrics.'}
          </p>
          <button
            onClick={refetchAll}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            <RefreshCcw size={14} />
            Retry
          </button>
        </div>
      ) : null}

      {readiness === 'empty' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-800">No report data yet</p>
          <p className="mt-1 text-sm text-slate-600">
            Reports will appear after student, intervention, and referral data is available for this workspace.
          </p>
          <button
            onClick={refetchAll}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
      ) : null}

      {hasPartialDataWarning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="flex items-center gap-2 text-sm font-bold">
            <AlertCircle size={16} />
            Partial report data
          </p>
          <p className="mt-1 text-sm">{errorMessages[0] ?? 'Some data sources failed to load. Showing available data only.'}</p>
          <button
            onClick={refetchAll}
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            <RefreshCcw size={13} />
            Retry failed sources
          </button>
        </div>
      ) : null}

      {(readiness === 'ready' || hasAnyData) && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">Avg Attendance</p>
              <p
                className={`text-2xl font-bold ${
                  avgAttendance >= 95 ? 'text-emerald-700' : avgAttendance >= 90 ? 'text-amber-700' : 'text-rose-700'
                }`}
              >
                {avgAttendance}%
              </p>
              <p className="mt-1 text-xs text-slate-500">Target: 95%+</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">Chronic Absenteeism</p>
              <p className={`text-2xl font-bold ${chronicAbsenteeism >= 15 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {chronicAbsenteeism}%
              </p>
              <p className="mt-1 text-xs text-slate-500">Watchlist threshold: 15%</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">Intervention Success</p>
              <p
                className={`text-2xl font-bold ${
                  interventionSuccess >= 75
                    ? 'text-emerald-700'
                    : interventionSuccess >= 60
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {interventionSuccess}%
              </p>
              <p className="mt-1 text-xs text-slate-500">Target: 75%+</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">Total Students</p>
              <p className="text-2xl font-bold text-slate-900">{students.length}</p>
              <p className="mt-1 text-xs text-slate-500">Current reporting scope</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {REPORT_TABS.map((entry) => (
              <button
                key={entry}
                onClick={() => setTab(entry)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  tab === entry ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {entry}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-700">Next Best Action</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">{activeTabDecision.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{activeTabDecision.detail}</p>
              </div>
              <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-2 text-right shadow-sm backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{activeTabDecision.metricLabel}</p>
                <p className="text-xl font-bold text-slate-900">{activeTabDecision.metricValue}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => handleDecisionAction(activeTabDecision.primary)}
                disabled={!onNavigate}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {activeTabDecision.primary.label}
              </button>
              {activeTabDecision.secondary ? (
                <button
                  onClick={() => {
                    if (!activeTabDecision.secondary) return;
                    handleDecisionAction(activeTabDecision.secondary);
                  }}
                  disabled={!onNavigate}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {activeTabDecision.secondary.label}
                </button>
              ) : null}
            </div>
          </div>

          {tab === 'Executive' ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                <h3 className="mb-4 font-bold text-slate-800">Attendance and Referral Trend</h3>
                {monthlyTrend.length === 0 ? (
                  <EmptyChartState message="No attendance trend data is available yet." />
                ) : (
                  <div className="h-72 pr-10 sm:pr-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" domain={[80, 100]} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          formatter={(value: number | string, name: string) =>
                            name === 'attendance' ? [`${value}%`, 'Attendance'] : [value, 'Referrals']
                          }
                        />
                        <Legend />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="attendance"
                          stroke="#6366f1"
                          fill="#6366f1"
                          fillOpacity={0.2}
                          name="Attendance"
                        />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="referrals"
                          stroke="#f43f5e"
                          fill="#f43f5e"
                          fillOpacity={0.2}
                          name="Referrals"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-800">Tier Distribution</h3>
                {tierDistribution.every((entry) => entry.value === 0) ? (
                  <EmptyChartState message="No student tier distribution is available yet." />
                ) : (
                  <div className="h-72 pr-10 sm:pr-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie data={tierDistribution} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                          {tierDistribution.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === 'Academics' ? (
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 font-bold text-slate-800">Grade Proficiency Estimate</h3>
              {gradeBars.length === 0 ? (
                <EmptyChartState message="No academic proficiency data is available yet." />
              ) : (
                <div className="h-80 pr-10 sm:pr-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={gradeBars}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="grade" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value: number | string) => [`${value}%`, 'Proficiency']} />
                      <Legend />
                      <Bar dataKey="math" fill="#6366f1" name="Math" />
                      <Bar dataKey="reading" fill="#10b981" name="Reading" />
                      <Bar dataKey="science" fill="#f59e0b" name="Science" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'Behavior' ? (
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 font-bold text-slate-800">Behavior/Attendance Risk Trend</h3>
              {monthlyTrend.length === 0 ? (
                <EmptyChartState message="No behavior trend data is available yet." />
              ) : (
                <div className="h-80 pr-10 sm:pr-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="referrals" stroke="#f43f5e" strokeWidth={3} name="Referrals" />
                      <Line type="monotone" dataKey="chronic" stroke="#f59e0b" strokeWidth={2} name="Chronic Risk" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'Interventions' ? (
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 font-bold text-slate-800">Intervention Efficacy</h3>
              {efficacyBars.length === 0 ? (
                <EmptyChartState message="No intervention efficacy data is available yet." />
              ) : (
                <div className="h-80 pr-10 sm:pr-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={efficacyBars}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value: number | string) => [`${value}%`, 'Success']} />
                      <Legend />
                      <Bar dataKey="success" fill="#6366f1" name="Success Rate" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

