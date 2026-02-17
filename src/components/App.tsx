
import React, { lazy, Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { 
  Activity, 
  Zap, 
  AlertCircle, 
  Users, 
  RefreshCw,
  Plus,
  Bot,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  X,
  Send,
  Menu,
  CalendarPlus,
  BarChart2,
  Loader2,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MetricCard } from './MetricCard';
import { ActionItemsList } from './ActionItemsList';
import { TierDistribution } from './TierDistribution';
import { MonitoringPulse } from './MonitoringPulse';
import { PRINCIPAL_DATA, TEACHER_DATA, DISTRICT_DATA, PARENT_DATA, MOCK_RAG_DOCUMENTS } from '../constants';
import type { DashboardData, RAGDocument} from '../types';
import { UserRole, ApprovalStatus, DocumentScope } from '../types';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { generateDashboardBriefing } from '../services/geminiService';
import {
  buildWorkspacePath,
  normalizePageForRole,
  slugToPage,
  slugToRole,
  type WorkspacePageId,
} from '../lib/workspaceRoutes';

const StudentDetailModal = lazy(() => import('./StudentDetailModal').then((m) => ({ default: m.StudentDetailModal })));
const StudentProfile = lazy(() => import('./StudentProfile').then((m) => ({ default: m.StudentProfile })));
const RosterView = lazy(() => import('./RosterView').then((m) => ({ default: m.RosterView })));
const StudentRosterView = lazy(() => import('./StudentRosterView').then((m) => ({ default: m.StudentRosterView })));
const GradebookView = lazy(() => import('./GradebookView').then((m) => ({ default: m.GradebookView })));
const LessonPlanLibrary = lazy(() => import('./LessonPlanLibrary').then((m) => ({ default: m.LessonPlanLibrary })));
const DocumentManager = lazy(() => import('./DocumentManager').then((m) => ({ default: m.DocumentManager })));
const MessagesView = lazy(() => import('./MessagesView').then((m) => ({ default: m.MessagesView })));
const CalendarView = lazy(() => import('./CalendarView').then((m) => ({ default: m.CalendarView })));
const SchoolsMapView = lazy(() => import('./SchoolsMapView').then((m) => ({ default: m.SchoolsMapView })));
const DataImporter = lazy(() => import('./DataImporter').then((m) => ({ default: m.DataImporter })));
const ReportsView = lazy(() => import('./ReportsView').then((m) => ({ default: m.ReportsView })));
const InterventionManager = lazy(() => import('./InterventionManager').then((m) => ({ default: m.InterventionManager })));
const SettingsView = lazy(() => import('./SettingsView').then((m) => ({ default: m.SettingsView })));
const Chatbot = lazy(() => import('./Chatbot').then((m) => ({ default: m.Chatbot })));
const ReferralModal = lazy(() => import('./ReferralModal').then((m) => ({ default: m.ReferralModal })));

const LazyViewFallback: React.FC = () => (
  <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm">
    <Loader2 size={20} className="animate-spin" />
    <span className="ml-2 text-sm font-medium">Loading view...</span>
  </div>
);

type HeaderAction = {
  id: string;
  label: string;
  enabled: boolean;
  tooltip?: string;
  onClick: () => void;
  icon: React.ElementType;
};

type FreshnessState = {
  source: 'local' | 'server';
  lastUpdatedAt: string | null;
  status: 'fresh' | 'stale' | 'unknown';
};

type DashboardSectionKey = 'quickTasks' | 'metrics' | 'aiBriefing' | 'chart' | 'tierDistribution' | 'monitoring';

type FlashMessage = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const routeParams = useParams({ strict: false });
  const routeRole = slugToRole((routeParams as { role?: string }).role) ?? UserRole.PRINCIPAL;
  const routePage = normalizePageForRole(routeRole, slugToPage((routeParams as { page?: string }).page));

  const [currentRole, setCurrentRole] = useState<UserRole>(routeRole);
  const [data, setData] = useState<DashboardData>(PRINCIPAL_DATA);
  const [hasHydrated, setHasHydrated] = useState(false);
  
  // UI State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState<WorkspacePageId>(routePage);
  const [messageRecipient, setMessageRecipient] = useState<string | undefined>(undefined);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const [mobileSections, setMobileSections] = useState<Record<DashboardSectionKey, boolean>>({
    quickTasks: true,
    metrics: false,
    aiBriefing: true,
    chart: false,
    tierDistribution: false,
    monitoring: true,
  });

  // Freshness State
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [freshness, setFreshness] = useState<FreshnessState>({
    source: 'local',
    lastUpdatedAt: null,
    status: 'unknown',
  });
  const [timeTick, setTimeTick] = useState(() => Date.now());

  // AI & Feedback State
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingGeneratedAt, setBriefingGeneratedAt] = useState<string | null>(null);
  
  // Feedback Loop State
  const [feedbackHistory, setFeedbackHistory] = useState<string[]>([]);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSentiment, setFeedbackSentiment] = useState<'positive' | 'negative' | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });

  // Navigation State (Student Profile)
  const [profileStudent, setProfileStudent] = useState<string | null>(null);

  // Modal State
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Referral Modal
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  // RAG Document State
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>(MOCK_RAG_DOCUMENTS);

  const roleHeadline = useMemo(
    () =>
      ({
        [UserRole.PRINCIPAL]: 'Leadership Dashboard',
        [UserRole.TEACHER]: 'Classroom Dashboard',
        [UserRole.DISTRICT]: 'District Dashboard',
        [UserRole.PARENT]: 'Family Progress Dashboard',
      }) as Record<UserRole, string>,
    []
  );

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    setCurrentRole(routeRole);
    setActivePage(routePage);
  }, [routePage, routeRole]);

  // Update data when role changes
  useEffect(() => {
    switch (currentRole) {
      case UserRole.PRINCIPAL: setData(PRINCIPAL_DATA); break;
      case UserRole.TEACHER: setData(TEACHER_DATA); break;
      case UserRole.DISTRICT: setData(DISTRICT_DATA); break;
      case UserRole.PARENT: setData(PARENT_DATA); break;
    }
    // Reset state on role change
    setBriefing(null);
    setShowBriefing(false);
    setShowFeedbackInput(false);
    setFeedbackSubmitted(false);
    setFeedbackSentiment(null);
    setFeedbackText('');
    setBriefingError(null);
    setBriefingGeneratedAt(null);
    setIsModalOpen(false);
    setSelectedStudent(null);
    setActivePage((current) => normalizePageForRole(currentRole, current));
    setProfileStudent(null);
    setIsMobileMenuOpen(false);
    setIsMoreMenuOpen(false);
    setMessageRecipient(undefined);
    setIsReferralModalOpen(false);
  }, [currentRole]);

  useEffect(() => {
    setHasHydrated(true);
    setFreshness({
      source: 'local',
      lastUpdatedAt: new Date().toISOString(),
      status: 'fresh',
    });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeTick(Date.now());
    }, 60000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated || !chartContainerRef.current) return;

    const chartContainer = chartContainerRef.current;
    const updateChartDimensions = () => {
      const { width, height } = chartContainer.getBoundingClientRect();
      setChartDimensions({
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height)),
      });
    };

    updateChartDimensions();
    const observer = new ResizeObserver(updateChartDimensions);
    observer.observe(chartContainer);

    return () => observer.disconnect();
  }, [hasHydrated]);

  useEffect(() => {
    if (!flashMessage) return;
    const timer = window.setTimeout(() => setFlashMessage(null), 3200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [flashMessage]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsMobileMenuOpen(false);
      setIsMoreMenuOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
    };
  }, []);

  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [isMoreMenuOpen]);

  const iconMap: Record<string, React.ElementType> = {
    Activity,
    Zap,
    AlertCircle,
    Users,
    Calendar
  };

  const computedFreshness = useMemo(() => {
    if (!freshness.lastUpdatedAt) {
      return { ...freshness, status: 'unknown' as const };
    }
    const lastUpdatedTime = new Date(freshness.lastUpdatedAt).getTime();
    const ageMs = Math.max(0, timeTick - lastUpdatedTime);
    const status = ageMs > 15 * 60 * 1000 ? 'stale' : 'fresh';
    return {
      ...freshness,
      status,
    };
  }, [freshness, timeTick]);

  const freshnessLabel = useMemo(() => {
    if (!computedFreshness.lastUpdatedAt) return 'Data refresh status unavailable';
    const lastUpdatedTime = new Date(computedFreshness.lastUpdatedAt).getTime();
    const ageMinutes = Math.floor(Math.max(0, timeTick - lastUpdatedTime) / 60000);
    if (ageMinutes <= 0) return 'Updated just now';
    if (ageMinutes === 1) return 'Updated 1 minute ago';
    return `Updated ${ageMinutes} minutes ago`;
  }, [computedFreshness.lastUpdatedAt, timeTick]);

  const currentDateLabel = useMemo(
    () =>
      new Date(timeTick).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [timeTick]
  );

  const briefingReviewDeadline = useMemo(
    () =>
      new Date(timeTick + 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    [timeTick]
  );

  const toggleMobileSection = (section: DashboardSectionKey) => {
    setMobileSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

  const renderMobileSectionHeader = (section: DashboardSectionKey, label: string, subtitle: string) => (
    <button
      type="button"
      onClick={() => toggleMobileSection(section)}
      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left lg:hidden"
      aria-expanded={mobileSections[section]}
    >
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{subtitle}</span>
      </span>
      <ChevronDown size={16} className={`text-slate-500 transition-transform ${mobileSections[section] ? 'rotate-180' : ''}`} />
    </button>
  );

  const navigateToPage = (page: WorkspacePageId) => {
    const nextPage = normalizePageForRole(currentRole, page);
    setActivePage(nextPage);
    void navigate({ to: buildWorkspacePath(currentRole, nextPage) });
  };

  const handleRoleChange = (nextRole: UserRole) => {
    const targetPage = normalizePageForRole(nextRole, activePage === 'profile' ? 'dashboard' : activePage);
    setCurrentRole(nextRole);
    setActivePage(targetPage);
    setProfileStudent(null);
    void navigate({ to: buildWorkspacePath(nextRole, targetPage) });
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsMoreMenuOpen(false);
    setIsRefreshing(true);
    setFlashMessage({ tone: 'info', text: 'Refreshing dashboard data…' });
    window.setTimeout(() => {
      setFreshness({
        source: 'local',
        lastUpdatedAt: new Date().toISOString(),
        status: 'fresh',
      });
      setIsRefreshing(false);
      setFlashMessage({ tone: 'success', text: 'Dashboard data is up to date.' });
    }, 450);
  };

  const handleGenerateInsight = async () => {
    setIsGenerating(true);
    setIsMoreMenuOpen(false);
    setShowBriefing(true);
    setBriefing(''); // Clear previous briefing
    setBriefingError(null);
    setFlashMessage({ tone: 'info', text: 'Generating AI briefing…' });
    
    // Reset feedback UI for new generation
    setShowFeedbackInput(false);
    setFeedbackSubmitted(false);
    setFeedbackSentiment(null);
    setFeedbackText('');

    try {
      const nextBriefing = await generateDashboardBriefing(data, feedbackHistory);
      setBriefing(nextBriefing);
      setBriefingGeneratedAt(new Date().toISOString());
      setFlashMessage({ tone: 'success', text: 'AI briefing generated.' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to generate AI briefing.';
      setBriefing(null);
      setBriefingError(errorMessage);
      setFlashMessage({ tone: 'error', text: errorMessage });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFeedbackClick = (sentiment: 'positive' | 'negative') => {
    setFeedbackSentiment(sentiment);
    setShowFeedbackInput(true);
  };

  const handleSubmitFeedback = () => {
    if (!feedbackSentiment) return;

    const sentimentText = feedbackSentiment === 'positive' ? 'Positive' : 'Negative';
    const feedbackEntry = `User rating: ${sentimentText}.${feedbackText ? ` Comment: "${feedbackText}"` : ''}`;
    
    setFeedbackHistory(prev => [...prev, feedbackEntry]);
    setFeedbackSubmitted(true);
    
    setTimeout(() => {
      setShowFeedbackInput(false);
    }, 2000);
  };

  const handleStudentClick = (studentName: string) => {
    setSelectedStudent(studentName);
    setIsModalOpen(true);
  };

  const handleNavigateToProfile = (studentName: string) => {
    setProfileStudent(studentName);
    navigateToPage('profile');
    setIsModalOpen(false);
    window.scrollTo(0,0);
  };

  const handleBackToDashboard = () => {
    navigateToPage('dashboard');
    setProfileStudent(null);
  };

  // Messaging Handlers
  const handleNavigateToMessages = (recipient?: string) => {
    setIsModalOpen(false);
    navigateToPage('messages');
    setMessageRecipient(recipient);
  };

  // RAG Document Handlers
  const handleUploadDocument = (doc: RAGDocument) => {
    setRagDocuments(prev => [doc, ...prev]);
  };

  const handleApproveDocument = (id: string) => {
    setRagDocuments(prev => prev.map(d => d.id === id ? { ...d, status: ApprovalStatus.APPROVED } : d));
  };

  const handleRejectDocument = (id: string) => {
    setRagDocuments(prev => prev.map(d => d.id === id ? { ...d, status: ApprovalStatus.REJECTED } : d));
  };

  const handleDeleteDocument = (id: string) => {
      setRagDocuments(prev => prev.filter(d => d.id !== id));
  };

  const handleStatusChange = (id: string, status: ApprovalStatus) => {
      setRagDocuments(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  };

  const handleScopeChange = (id: string, newScope: DocumentScope) => {
    setRagDocuments(prev => prev.map(d => {
        if (d.id === id) {
            let newStatus = d.status;
            // For brevity, defaulting to pending if scope increases significantly for non-admins
            if (currentRole !== UserRole.DISTRICT && (newScope === DocumentScope.DISTRICT || newScope === DocumentScope.SCHOOL)) {
                 newStatus = ApprovalStatus.PENDING;
            } else {
                 newStatus = ApprovalStatus.APPROVED;
            }
            return { ...d, scope: newScope, status: newStatus };
        }
        return d;
    }));
  };

  const primaryAction: HeaderAction | null = (() => {
    if (currentRole === UserRole.PARENT) {
      return {
        id: 'message-teacher',
        label: 'Message Teacher',
        enabled: true,
        onClick: () => handleNavigateToMessages('Mr. Davis'),
        icon: MessageSquare,
      };
    }
    if (currentRole === UserRole.DISTRICT) {
      return {
        id: 'open-reports',
        label: 'Open Reports',
        enabled: true,
        onClick: () => navigateToPage('reports'),
        icon: BarChart2,
      };
    }
    return {
      id: 'new-referral',
      label: 'Create Referral',
      enabled: true,
      onClick: () => setIsReferralModalOpen(true),
      icon: Plus,
    };
  })();

  const moreActions = (() => {
    const actions: HeaderAction[] = [
      {
        id: 'refresh-local',
        label: isRefreshing ? 'Refreshing…' : 'Refresh Data',
        enabled: !isRefreshing,
        onClick: handleRefresh,
        icon: RefreshCw,
      },
      {
        id: 'ai-brief',
        label: isGenerating ? 'Generating…' : showBriefing ? 'Refresh AI Brief' : 'Generate AI Brief',
        enabled: !isGenerating,
        onClick: () => {
          void handleGenerateInsight();
        },
        icon: Bot,
      },
    ];

    if (currentRole === UserRole.PRINCIPAL) {
      actions.push({
        id: 'schedule-mtss',
        label: 'Schedule MTSS',
        enabled: true,
        onClick: () => navigateToPage('calendar'),
        icon: CalendarPlus,
      });
    }
    if (currentRole === UserRole.TEACHER) {
      actions.push({
        id: 'view-roster',
        label: 'View Roster',
        enabled: true,
        onClick: () => navigateToPage('class_roster'),
        icon: Users,
      });
    }
    if (currentRole === UserRole.DISTRICT) {
      actions.push({
        id: 'district-map',
        label: 'Open Schools Map',
        enabled: true,
        onClick: () => navigateToPage('map'),
        icon: Users,
      });
    }
    return actions;
  })();

  const topTasks: Array<{ id: string; label: string; onClick: () => void }> = ({
      [UserRole.PRINCIPAL]: [
        { id: 'task-referral', label: 'Create Support Referral', onClick: () => setIsReferralModalOpen(true) },
        { id: 'task-interventions', label: 'Review Active Supports', onClick: () => navigateToPage('interventions') },
        { id: 'task-calendar', label: 'Open MTSS Calendar', onClick: () => navigateToPage('calendar') },
      ],
      [UserRole.TEACHER]: [
        { id: 'task-roster', label: 'Open Student Roster', onClick: () => navigateToPage('class_roster') },
        { id: 'task-messages', label: 'Message Family', onClick: () => handleNavigateToMessages('Mrs. Martinez') },
        { id: 'task-gradebook', label: 'Update Gradebook', onClick: () => navigateToPage('gradebook') },
      ],
      [UserRole.DISTRICT]: [
        { id: 'task-map', label: 'View Schools Map', onClick: () => navigateToPage('map') },
        { id: 'task-reports', label: 'Review System Reports', onClick: () => navigateToPage('reports') },
        { id: 'task-messages', label: 'Send District Message', onClick: () => navigateToPage('messages') },
      ],
      [UserRole.PARENT]: [
        { id: 'task-report', label: 'Review Progress Report', onClick: () => navigateToPage('reports') },
        { id: 'task-message', label: 'Message Teacher', onClick: () => handleNavigateToMessages('Mr. Davis') },
        { id: 'task-calendar', label: 'Check Calendar', onClick: () => navigateToPage('calendar') },
      ],
    }[currentRole]);

  const structuredBriefing = useMemo(() => {
    const risksFromData = data.actionItems.slice(0, 3).map((item) => `${item.studentName}: ${item.insight}`);
    const actionsFromTasks = topTasks.slice(0, 3).map((task) => task.label);

    if (!briefing) {
      return {
        keyRisks: risksFromData,
        recommendedActions: actionsFromTasks,
      };
    }

    const cleanSentences = briefing
      .replace(/\r/g, ' ')
      .split(/\n+/)
      .map((line) => line.replace(/^[\s>*-]+/, '').trim())
      .filter(Boolean);

    const explicitRecommendations = cleanSentences
      .filter((line) => /recommend|prioritize|schedule|review|follow/i.test(line))
      .slice(0, 3);

    const explicitRisks = cleanSentences
      .filter((line) => /risk|critical|urgent|flagged|drop|absence|referral|threshold/i.test(line))
      .slice(0, 3);

    return {
      keyRisks: explicitRisks.length > 0 ? explicitRisks : risksFromData,
      recommendedActions: explicitRecommendations.length > 0 ? explicitRecommendations : actionsFromTasks,
    };
  }, [briefing, data.actionItems, topTasks]);

  // --- Render Helpers ---

  const renderHeader = () => (
    <header className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="-ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open workspace menu"
              type="button"
            >
              <Menu size={24} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Dashboard</p>
              <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{roleHeadline[currentRole]}</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                {data.userName} • {currentRole === UserRole.DISTRICT ? 'District-wide' : data.schoolName} • {currentDateLabel}
              </p>
              <p
                className={`mt-1 text-xs font-semibold ${
                  computedFreshness.status === 'stale'
                    ? 'text-amber-700'
                    : computedFreshness.status === 'fresh'
                      ? 'text-emerald-700'
                      : 'text-slate-500'
                }`}
              >
                {freshnessLabel} • Local demo dataset
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={!primaryAction.enabled}
              title={primaryAction.tooltip}
              className="flex items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <primaryAction.icon size={16} />
              {primaryAction.label}
            </button>
          ) : null}

          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((previous) => !previous)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              aria-expanded={isMoreMenuOpen}
              aria-haspopup="menu"
            >
              Actions
              <ChevronDown size={16} className={`transition-transform ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMoreMenuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-xl" role="menu">
                {moreActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      action.onClick();
                      setIsMoreMenuOpen(false);
                    }}
                    disabled={!action.enabled}
                    title={action.tooltip}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <action.icon size={14} />
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );

  const renderAIBriefing = () => (
    showBriefing && (
      <div className="mb-8 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-indigo-900">
            <Bot size={20} className="text-indigo-600" />
            AI {currentRole === UserRole.PARENT ? 'Assistant' : 'Executive Summary'}
          </h3>
          {!isGenerating && briefing && !feedbackSubmitted && !showFeedbackInput ? (
            <div className="flex items-center gap-2 text-sm text-indigo-400">
              <span className="hidden text-xs sm:inline">Helpful?</span>
              <button type="button" aria-label="Mark AI summary as helpful" onClick={() => handleFeedbackClick('positive')} className="rounded-full p-1 transition-colors hover:bg-indigo-100 hover:text-indigo-600"><ThumbsUp size={16} /></button>
              <button type="button" aria-label="Mark AI summary as not helpful" onClick={() => handleFeedbackClick('negative')} className="rounded-full p-1 transition-colors hover:bg-indigo-100 hover:text-indigo-600"><ThumbsDown size={16} /></button>
            </div>
          ) : null}
        </div>

        {isGenerating ? (
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <Loader2 size={16} className="animate-spin" />
            Building executive summary from current dashboard context…
          </div>
        ) : null}

        {briefingError ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p className="font-semibold">AI summary unavailable.</p>
            <p className="mt-1">{briefingError}</p>
            <button
              type="button"
              onClick={() => void handleGenerateInsight()}
              className="mt-2 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              Retry AI Brief
            </button>
          </div>
        ) : null}

        {!isGenerating && !briefingError ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-indigo-100 bg-white/80 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-indigo-700">Key Risks</h4>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {structuredBriefing.keyRisks.map((risk, index) => (
                  <li key={`risk-${index}`} className="flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-indigo-100 bg-white/80 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-indigo-700">Recommended Actions</h4>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {structuredBriefing.recommendedActions.map((action, index) => (
                  <li key={`action-${index}`} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {!isGenerating && !briefingError ? (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-white/80 p-4 text-xs text-slate-600">
            <p><span className="font-semibold text-slate-700">Owner:</span> {data.userName}</p>
            <p><span className="font-semibold text-slate-700">Due Date:</span> {briefingReviewDeadline}</p>
            <p>
              <span className="font-semibold text-slate-700">Generated:</span>{' '}
              {briefingGeneratedAt
                ? new Date(briefingGeneratedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                : 'Not generated yet'}
            </p>
            <p><span className="font-semibold text-slate-700">Source Confidence:</span> AI + local workspace data</p>
          </div>
        ) : null}

        {!isGenerating && (showFeedbackInput || feedbackSubmitted) ? (
          <div className="mt-4 border-t border-indigo-100/70 pt-4">
            {feedbackSubmitted ? (
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600"><ThumbsUp size={16} /> Thank you for your feedback!</div>
            ) : (
              <div className="flex max-w-2xl flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <MessageSquare size={16} className="absolute left-3 top-3 text-indigo-400" />
                  <input
                    type="text"
                    placeholder="Improve this briefing?..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="w-full rounded-lg border border-indigo-200 bg-white/80 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitFeedback()}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleSubmitFeedback} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 sm:flex-none">Submit <Send size={14} /></button>
                  <button type="button" aria-label="Close feedback input" onClick={() => setShowFeedbackInput(false)} className="rounded-lg border border-indigo-100 bg-white p-2 text-indigo-400 hover:text-indigo-600 sm:border-none sm:bg-transparent"><X size={18} /></button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    )
  );

  const renderDashboard = () => (
    <>
      {renderHeader()}

      {flashMessage ? (
        <div
          className={`mb-4 rounded-lg border px-4 py-2.5 text-sm font-medium ${
            flashMessage.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : flashMessage.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700'
          }`}
          role="status"
          aria-live="polite"
        >
          {flashMessage.text}
        </div>
      ) : null}

      <div className="mb-6 space-y-2">
        {renderMobileSectionHeader('quickTasks', 'Top Tasks', 'Quick actions for this role')}
        <div className={`${mobileSections.quickTasks ? 'block' : 'hidden'} lg:block`}>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {topTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={task.onClick}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {task.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-2">
        {renderMobileSectionHeader('metrics', 'Performance Metrics', 'Intervention delivery and student outcome indicators')}
        <div className={`${mobileSections.metrics ? 'block' : 'hidden'} lg:block`}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {data.metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} icon={iconMap[metric.icon] || Activity} />
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6 md:gap-8">
        {/* Left Column (Main) */}
        <div className={`col-span-12 ${currentRole === UserRole.PARENT ? 'lg:col-span-7' : 'lg:col-span-8'} space-y-6 md:space-y-8 min-w-0`}>
          {/* Action Items */}
          <div className="h-[400px] md:h-[420px]">
            <ActionItemsList
              items={data.actionItems}
              onStudentClick={handleStudentClick}
              onViewAll={() => navigateToPage('reports')}
              totalCount={data.actionItems.length}
            />
          </div>

          {showBriefing ? (
            <div className="space-y-2">
              {renderMobileSectionHeader('aiBriefing', 'Leadership Briefing', 'Top risks and recommended next steps')}
              <div className={`${mobileSections.aiBriefing ? 'block' : 'hidden'} lg:block`}>{renderAIBriefing()}</div>
            </div>
          ) : null}

          {/* Dynamic Chart Section */}
          <div className="space-y-2">
            {renderMobileSectionHeader('chart', data.chartTitle, 'Outcome trend view')}
            <div className={`${mobileSections.chart ? 'block' : 'hidden'} lg:block`}>
              <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">{data.chartTitle}</h3>
                    <p className="text-sm text-slate-500">Outcome Trend View</p>
                  </div>
                </div>

                <div ref={chartContainerRef} className="h-56 w-full min-w-0 md:h-64">
                  {hasHydrated && chartDimensions.width > 0 && chartDimensions.height > 0 ? (
                    <ReBarChart data={data.chartData} barSize={60} width={chartDimensions.width} height={chartDimensions.height}>
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        dy={10}
                        interval={0}
                      />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                        {data.chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </ReBarChart>
                  ) : (
                    <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Side Panels) */}
        <div className={`col-span-12 ${currentRole === UserRole.PARENT ? 'lg:col-span-5' : 'lg:col-span-4'} space-y-6 md:space-y-8`}>
          {currentRole !== UserRole.PARENT && data.tierDistribution ? (
            <div className="space-y-2">
              {renderMobileSectionHeader('tierDistribution', 'Tiered Support Distribution', 'Students receiving Tier 1, Tier 2, and Tier 3 supports')}
              <div className={`${mobileSections.tierDistribution ? 'block' : 'hidden'} lg:block`}>
                <TierDistribution data={data.tierDistribution} />
              </div>
            </div>
          ) : null}

          <div className="space-y-2 md:sticky md:top-8">
            {renderMobileSectionHeader('monitoring', 'Student Monitoring Queue', freshnessLabel)}
            <div className={`${mobileSections.monitoring ? 'block' : 'hidden'} lg:block`}>
              <MonitoringPulse
                students={data.monitoringPulse}
                onStudentClick={handleStudentClick}
                onViewAll={() => navigateToPage(currentRole === UserRole.PRINCIPAL || currentRole === UserRole.TEACHER ? 'class_roster' : 'reports')}
                freshnessLabel={freshnessLabel}
              />
            </div>
          </div>
          
          {currentRole === UserRole.PARENT && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
               <h3 className="font-bold text-slate-800 mb-4">Teacher Feedback</h3>
               <div className="space-y-4">
                 <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">"Leo is showing great improvement in reading comprehension." - Mr. Davis</div>
                 <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">"Please remember to sign the permission slip for the museum trip." - Admin</div>
               </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const renderActivePage = () => {
    switch(activePage) {
      case 'profile':
        return profileStudent ? (
          <StudentProfile 
            studentName={profileStudent} 
            onBack={handleBackToDashboard} 
            onMenuClick={() => setIsMobileMenuOpen(true)}
            onMessageClick={() => handleNavigateToMessages('Mrs. Martinez')}
          />
        ) : renderDashboard();
      case 'rosters':
        return (
          <RosterView 
            onMenuClick={() => setIsMobileMenuOpen(true)} 
            onEmailClick={(name) => handleNavigateToMessages(name)}
            onStudentClick={(name) => { setSelectedStudent(name); setIsModalOpen(true); }}
            onNavigate={navigateToPage}
            currentUserRole={currentRole}
          />
        );
      case 'class_roster':
        return (
          <StudentRosterView 
             key={currentRole} // Force re-mount when role changes to update viewType
             onMenuClick={() => setIsMobileMenuOpen(true)} 
             onStudentClick={(name) => { setSelectedStudent(name); setIsModalOpen(true); }}
             viewType={currentRole === UserRole.PRINCIPAL || currentRole === UserRole.DISTRICT ? 'master' : 'classroom'}
             onNavigate={navigateToPage}
          />
        );
      case 'gradebook':
        return (
          <GradebookView 
             onMenuClick={() => setIsMobileMenuOpen(true)}
             currentUserRole={currentRole}
          />
        );
      case 'lesson_plans':
        return (
          <LessonPlanLibrary 
             onMenuClick={() => setIsMobileMenuOpen(true)}
             currentUserRole={currentRole}
          />
        );
      case 'documents':
        return (
          <DocumentManager 
            currentUserRole={currentRole}
            currentSchoolName={data.schoolName}
            currentUserName={data.userName}
            documents={ragDocuments}
            onUpload={handleUploadDocument}
            onApprove={handleApproveDocument}
            onReject={handleRejectDocument}
            onDelete={handleDeleteDocument}
            onStatusChange={handleStatusChange}
            onScopeChange={handleScopeChange}
            onMenuClick={() => setIsMobileMenuOpen(true)}
          />
        );
      case 'messages':
        return (
          <MessagesView 
            currentUserRole={currentRole}
            currentUserName={data.userName}
            onMenuClick={() => setIsMobileMenuOpen(true)}
            targetRecipient={messageRecipient}
          />
        );
      case 'calendar':
        return (
          <CalendarView 
            currentUserRole={currentRole}
            currentUserName={data.userName}
            onMenuClick={() => setIsMobileMenuOpen(true)}
          />
        );
      case 'map':
        return (
          <SchoolsMapView 
            onMenuClick={() => setIsMobileMenuOpen(true)}
          />
        );
      case 'import':
        return (
          <DataImporter 
            onMenuClick={() => setIsMobileMenuOpen(true)}
            onImportComplete={() => navigateToPage('dashboard')}
            currentUserRole={currentRole}
          />
        );
      case 'reports':
        return (
          <ReportsView 
            currentUserRole={currentRole}
            currentUserName={data.userName}
          />
        );
      case 'interventions':
        return (
          <InterventionManager
            onStudentClick={(name) => { setSelectedStudent(name); setIsModalOpen(true); }}
            onMenuClick={() => setIsMobileMenuOpen(true)}
          />
        );
      case 'settings':
        return (
          <SettingsView 
            currentUserRole={currentRole}
            currentUserName={data.userName}
            currentSchoolName={data.schoolName}
          />
        );
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50/80 font-sans text-slate-900">
      
      {/* Global Chatbot */}
      <Suspense fallback={null}>
        <Chatbot 
          currentUserRole={currentRole}
          currentUserName={data.userName}
          documents={ragDocuments}
          currentSchoolName={data.schoolName}
          currentClassName={currentRole === UserRole.TEACHER ? 'Class 4-B' : undefined}
        />
      </Suspense>

      <Suspense fallback={null}>
        <StudentDetailModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          studentName={selectedStudent} 
          onViewFullProfile={handleNavigateToProfile}
          onMessageParents={() => handleNavigateToMessages('Mrs. Martinez')} // Mock parent name
        />
      </Suspense>

      <Suspense fallback={null}>
        <ReferralModal 
          isOpen={isReferralModalOpen} 
          onClose={() => setIsReferralModalOpen(false)}
          onViewQueue={() => {
            navigateToPage(currentRole === UserRole.PRINCIPAL || currentRole === UserRole.TEACHER ? 'interventions' : 'reports');
          }}
        />
      </Suspense>

      <Sidebar 
        currentRole={currentRole} 
        onRoleChange={handleRoleChange}
        userName={data.userName}
        schoolName={data.schoolName}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activePage={activePage}
      />
      
      <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 transition-all duration-300 md:p-8 lg:ml-64">
        <Suspense fallback={<LazyViewFallback />}>
          {renderActivePage()}
        </Suspense>
      </main>
    </div>
  );
};

export default App;



