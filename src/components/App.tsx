
import React, { lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { 
  Activity, 
  Zap, 
  AlertCircle, 
  Users, 
  Bot,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  X,
  Send,
  Loader2,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { SidebarInlineToggleProvider, SidebarToggleButton } from './SidebarToggleButton';
import { MetricCard } from './MetricCard';
import { ActionItemsList } from './ActionItemsList';
import { TierDistribution } from './TierDistribution';
import { MonitoringPulse } from './MonitoringPulse';
import type {
  Conversation,
  DashboardData,
  MessagesLaunchContext,
  RAGDocument,
} from '../types';
import { UserRole, ApprovalStatus, DocumentScope } from '../types';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { generateDashboardBriefing } from '../services/geminiService';
import {
  buildWorkspacePath,
  DEFAULT_WORKSPACE_PAGE,
  normalizePageForRole,
  slugToPage,
  type WorkspacePageId,
} from '../lib/workspaceRoutes';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { useTenantBranding } from '../hooks/useTenantBranding';
import { useSidebarState } from '../hooks/useSidebarState';
import { useNotifications } from '../hooks/useNotifications';
import { ACTION_ICON_BY_ID, getRouteIcon, iconSize } from '../lib/ui/icons';
import { Button } from './ui/Button';
import { NotificationDetailModal } from './notifications/NotificationDetailModal';

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
  <div className="app-card flex min-h-[280px] items-center justify-center rounded-xl text-slate-500">
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

type HealthSessionResponse = {
  session: {
    user?: {
      id?: string;
      primaryRole?: string;
    };
    effectiveRoles?: string[];
  } | null;
};

type ReferralNotificationSource = {
  id: string;
  studentName: string;
  type: string;
  urgency: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  grade?: string;
};

type InterventionNotificationSource = {
  id: string;
  studentName: string;
  planName?: string;
  status?: string;
  progress?: number;
  startDate?: string;
  teacher?: string;
};

type SettingsAvatarResponse = {
  rows?: Array<{
    profile?: {
      displayName?: unknown;
      avatarUrl?: unknown;
    };
  }>;
};

const DEFAULT_SIDEBAR_GROUP_STATE = {
  work: true,
  planning: true,
  communication: true,
  administration: true,
};

const ALLOW_ROLE_SWITCHING =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_SIDEBAR_TEST_CONTROLS === "true";

const mapSessionRoleToUserRole = (role: string | null | undefined): UserRole | null => {
  if (role === 'principal' || role === 'school_admin') return UserRole.PRINCIPAL;
  if (role === 'teacher') return UserRole.TEACHER;
  if (role === 'district_admin' || role === 'org_admin') return UserRole.DISTRICT;
  if (role === 'parent') return UserRole.PARENT;
  return null;
};

const createEmptyDashboardData = (role: UserRole): DashboardData => ({
  role,
  userName: "",
  schoolName: "School Workspace",
  metrics: [],
  actionItems: [],
  tierDistribution: [],
  monitoringPulse: [],
  chartData: [],
  chartTitle: role === UserRole.TEACHER ? "Class Intervention Effectiveness" : "Intervention Effectiveness",
});

const App: React.FC = () => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const routePage = useMemo(() => {
    if (!pathname.startsWith("/app")) return null;
    if (pathname === "/app" || pathname === "/app/") return null;
    const slug = pathname.replace(/^\/app\//, "").split("/")[0];
    return slugToPage(slug);
  }, [pathname]);

  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.PRINCIPAL);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([UserRole.PRINCIPAL]);
  const [data, setData] = useState<DashboardData>(createEmptyDashboardData(UserRole.PRINCIPAL));
  const [settingsDisplayName, setSettingsDisplayName] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const hasInitializedRoleResetRef = useRef(false);
  const sidebarUserKey = `${data.userName || 'anonymous'}:${currentRole}`;
  const {
    state: sidebarState,
    actions: sidebarActions,
  } = useSidebarState({
    userKey: sidebarUserKey,
    defaultGroupState: DEFAULT_SIDEBAR_GROUP_STATE,
  });
  
  // UI State
  const [activePage, setActivePage] = useState<WorkspacePageId>(DEFAULT_WORKSPACE_PAGE);
  const [messageLaunchContext, setMessageLaunchContext] = useState<MessagesLaunchContext | null>(null);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const [mobileSections, setMobileSections] = useState<Record<DashboardSectionKey, boolean>>({
    quickTasks: true,
    metrics: true,
    aiBriefing: false,
    chart: false,
    tierDistribution: false,
    monitoring: true,
  });
  const [isTallViewport, setIsTallViewport] = useState(true);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null);

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
  const [referralQueueFocusId, setReferralQueueFocusId] = useState<string | null>(null);

  // RAG Document State
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>([]);
  const dashboardQuery = useDashboardData(currentRole);
  const messagesCollection = useTenantCollection<Conversation>("messages");
  const referralsCollection = useTenantCollection<ReferralNotificationSource>("referrals");
  const interventionsCollection = useTenantCollection<InterventionNotificationSource>("interventions");
  const documentsCollection = useTenantCollection<RAGDocument>("documents");
  const { branding } = useTenantBranding();
  const notifications = useNotifications({
    userId: sessionUserId,
    userName: data.userName || null,
    currentRole,
  });

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
  const currentViewPage = useMemo(
    () => normalizePageForRole(currentRole, routePage ?? activePage),
    [activePage, currentRole, routePage]
  );

  const openMobileMenu = useCallback(() => {
    menuTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sidebarActions.openMobile();
  }, [sidebarActions]);

  const closeMobileMenu = useCallback((restoreFocus = false) => {
    sidebarActions.closeMobile();
    const target = menuTriggerRef.current;
    if (restoreFocus && target) {
      window.setTimeout(() => target.focus(), 0);
    }
  }, [sidebarActions]);

  useEffect(() => {
    sidebarActions.closeMobile();
  }, [sidebarActions]);

  useEffect(() => {
    let isMounted = true;

    const loadSessionRoles = async () => {
      try {
        const response = await fetch('/api/health');
        if (!response.ok) return;
        const payload = (await response.json()) as HealthSessionResponse;
        const session = payload.session;
        if (!session) return;
        setSessionUserId(session.user?.id ?? null);

        const mappedRoles = (session.effectiveRoles ?? [])
          .map((role) => mapSessionRoleToUserRole(role))
          .filter((role): role is UserRole => role !== null);
        const primaryRole = mapSessionRoleToUserRole(session.user?.primaryRole);
        const nextRoles = Array.from(
          new Set<UserRole>([
            ...mappedRoles,
            ...(primaryRole ? [primaryRole] : []),
          ])
        );

        if (!isMounted || nextRoles.length === 0) return;

        const lockedRole = primaryRole ?? nextRoles[0];
        if (ALLOW_ROLE_SWITCHING) {
          setAvailableRoles(nextRoles);
          setCurrentRole((previous) => (nextRoles.includes(previous) ? previous : nextRoles[0]));
          return;
        }

        setAvailableRoles([lockedRole]);
        setCurrentRole(lockedRole);
      } catch {
        // Keep default local role state when health lookup fails.
      }
    };

    void loadSessionRoles();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const requestedPage = routePage ?? DEFAULT_WORKSPACE_PAGE;
    const normalizedPage = normalizePageForRole(currentRole, requestedPage);

    setActivePage(normalizedPage);
    closeMobileMenu();

    if (requestedPage !== normalizedPage) {
      void navigate({ to: buildWorkspacePath(normalizedPage), replace: true });
    }
  }, [closeMobileMenu, currentRole, navigate, routePage]);

  // Update data when role changes
  useEffect(() => {
    if (!hasInitializedRoleResetRef.current) {
      hasInitializedRoleResetRef.current = true;
      return;
    }

    setData((previous) => ({ ...createEmptyDashboardData(currentRole), userName: previous.userName, schoolName: previous.schoolName }));
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
    setProfileStudent(null);
    closeMobileMenu();
    setIsMoreMenuOpen(false);
    setMessageLaunchContext(null);
    setIsReferralModalOpen(false);
    setSelectedNotificationId(null);
  }, [closeMobileMenu, currentRole]);

  useEffect(() => {
    if (!dashboardQuery.data?.data) return;
    setData(dashboardQuery.data.data);
  }, [dashboardQuery.data]);

  useEffect(() => {
    let mounted = true;

    const loadUserAvatar = async () => {
      try {
        const response = await fetch("/api/data/settings");
        if (!response.ok) {
          if (mounted) setUserAvatarUrl(null);
          return;
        }
        const payload = (await response.json()) as SettingsAvatarResponse;
        const displayName = payload.rows?.[0]?.profile?.displayName;
        const candidate = payload.rows?.[0]?.profile?.avatarUrl;
        if (!mounted) return;
        setSettingsDisplayName(typeof displayName === "string" && displayName.trim().length > 0 ? displayName : null);
        setUserAvatarUrl(typeof candidate === "string" && candidate.trim().length > 0 ? candidate : null);
      } catch {
        if (mounted) {
          setSettingsDisplayName(null);
          setUserAvatarUrl(null);
        }
      }
    };

    void loadUserAvatar();
    return () => {
      mounted = false;
    };
  }, [currentRole, data.userName]);

  const sidebarDisplayName = data.userName.trim() || settingsDisplayName || "MTSS User";

  useEffect(() => {
    if (!documentsCollection.query.data?.rows) return;
    setRagDocuments(documentsCollection.query.data.rows);
  }, [documentsCollection.query.data]);

  useEffect(() => {
    notifications.syncDerivedNotifications({
      messages: messagesCollection.query.data?.rows ?? [],
      referrals: referralsCollection.query.data?.rows ?? [],
      interventions: interventionsCollection.query.data?.rows ?? [],
      documents: documentsCollection.query.data?.rows ?? [],
    });
  }, [
    documentsCollection.query.data?.rows,
    interventionsCollection.query.data?.rows,
    messagesCollection.query.data?.rows,
    notifications.syncDerivedNotifications,
    referralsCollection.query.data?.rows,
  ]);

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
    if (!sidebarState.isMobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarState.isMobileOpen]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeMobileMenu(true);
      setIsMoreMenuOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
    };
  }, [closeMobileMenu]);

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

  const selectedNotification = useMemo(
    () =>
      notifications.userNotifications.find((notification) => notification.id === selectedNotificationId) ?? null,
    [notifications.userNotifications, selectedNotificationId],
  );
  const notificationErrorMessage = useMemo(() => {
    if (!notifications.query.isError) return null;
    const maybeError = notifications.query.error;
    if (maybeError instanceof Error && maybeError.message.trim().length > 0) return maybeError.message;
    return 'Notifications are temporarily unavailable.';
  }, [notifications.query.error, notifications.query.isError]);

  useEffect(() => {
    if (!selectedNotificationId) return;
    if (selectedNotification) return;
    setSelectedNotificationId(null);
  }, [selectedNotification, selectedNotificationId]);

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

  const freshnessStatusLabel = useMemo(() => {
    if (computedFreshness.status === 'fresh') return 'Fresh';
    if (computedFreshness.status === 'stale') return 'Stale';
    return 'Unknown';
  }, [computedFreshness.status]);

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

  const roleScopeLabel = useMemo(() => {
    if (currentRole === UserRole.DISTRICT) return "District-wide";
    return data.schoolName || "School workspace";
  }, [currentRole, data.schoolName]);

  const toggleMobileSection = (section: DashboardSectionKey) => {
    setMobileSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

  const renderMobileSectionHeader = (
    section: DashboardSectionKey,
    label: string,
    subtitle: string,
    hint?: string
  ) => (
    <Button
      variant="secondary"
      onClick={() => toggleMobileSection(section)}
      fullWidth
      className="app-button-secondary justify-between px-4 py-3 text-left lg:hidden"
      aria-expanded={mobileSections[section]}
    >
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{subtitle}</span>
      </span>
      <span className="flex items-center gap-2">
        {hint ? (
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {hint}
          </span>
        ) : null}
        <ChevronDown size={16} className={`text-slate-500 transition-transform ${mobileSections[section] ? 'rotate-180' : ''}`} />
      </span>
    </Button>
  );

  const navigateToPage = (page: WorkspacePageId) => {
    const nextPage = normalizePageForRole(currentRole, page);
    if (nextPage !== 'interventions') {
      setReferralQueueFocusId(null);
    }
    if (nextPage === 'messages') {
      setMessageLaunchContext(null);
    }
    setActivePage(nextPage);
    closeMobileMenu();
    void navigate({ to: buildWorkspacePath(nextPage) });
  };

  const handleRoleChange = (nextRole: UserRole) => {
    if (!ALLOW_ROLE_SWITCHING) return;
    if (!availableRoles.includes(nextRole)) return;
    const targetPage = normalizePageForRole(nextRole, currentViewPage === 'profile' ? 'dashboard' : currentViewPage);
    setCurrentRole(nextRole);
    setActivePage(targetPage);
    setProfileStudent(null);
    closeMobileMenu();
    void navigate({ to: buildWorkspacePath(targetPage) });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleViewportChange = () => {
      closeMobileMenu();
    };
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, [closeMobileMenu]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const evaluateViewport = () => {
      setIsTallViewport(window.innerHeight >= 820);
      setIsMobileViewport(window.innerWidth < 1024);
    };
    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    return () => {
      window.removeEventListener("resize", evaluateViewport);
    };
  }, []);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsMoreMenuOpen(false);
    setIsRefreshing(true);
    setFlashMessage({ tone: 'info', text: 'Refreshing dashboard data...' });
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
    setFlashMessage({ tone: 'info', text: 'Generating AI summary...' });
    
    // Reset feedback UI for new generation
    setShowFeedbackInput(false);
    setFeedbackSubmitted(false);
    setFeedbackSentiment(null);
    setFeedbackText('');

    try {
      const nextBriefing = await generateDashboardBriefing(data, feedbackHistory);
      setBriefing(nextBriefing);
      setBriefingGeneratedAt(new Date().toISOString());
      setFlashMessage({ tone: 'success', text: 'AI summary generated.' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to generate AI summary.';
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
  const handleNavigateToMessages = (launch?: string | MessagesLaunchContext) => {
    setIsModalOpen(false);
    navigateToPage('messages');
    if (!launch) {
      setMessageLaunchContext(null);
      return;
    }
    if (typeof launch === 'string') {
      setMessageLaunchContext({ recipientName: launch });
      return;
    }
    setMessageLaunchContext(launch);
  };

  // RAG Document Handlers
  const handleUploadDocument = (doc: RAGDocument) => {
    setRagDocuments(prev => [doc, ...prev]);
    documentsCollection.createMutation.mutate(doc);
  };

  const handleApproveDocument = (id: string) => {
    setRagDocuments(prev => prev.map(d => d.id === id ? { ...d, status: ApprovalStatus.APPROVED } : d));
    documentsCollection.updateMutation.mutate({ id, patch: { status: ApprovalStatus.APPROVED } });
  };

  const handleRejectDocument = (id: string) => {
    setRagDocuments(prev => prev.map(d => d.id === id ? { ...d, status: ApprovalStatus.REJECTED } : d));
    documentsCollection.updateMutation.mutate({ id, patch: { status: ApprovalStatus.REJECTED } });
  };

  const handleDeleteDocument = (id: string) => {
      setRagDocuments(prev => prev.filter(d => d.id !== id));
      documentsCollection.deleteMutation.mutate({ id });
  };

  const handleStatusChange = (id: string, status: ApprovalStatus) => {
      setRagDocuments(prev => prev.map(d => d.id === id ? { ...d, status } : d));
      documentsCollection.updateMutation.mutate({ id, patch: { status } });
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
    const nextStatus =
      currentRole !== UserRole.DISTRICT && (newScope === DocumentScope.DISTRICT || newScope === DocumentScope.SCHOOL)
        ? ApprovalStatus.PENDING
        : ApprovalStatus.APPROVED;
    documentsCollection.updateMutation.mutate({
      id,
      patch: {
        scope: newScope,
        status: nextStatus,
      },
    });
  };

  const primaryAction: HeaderAction | null = (() => {
    if (currentRole === UserRole.PARENT) {
      return {
        id: 'message-teacher',
        label: 'Message Teacher',
        enabled: true,
        onClick: () => handleNavigateToMessages('Mr. Davis'),
        icon: getRouteIcon('messages'),
      };
    }
    if (currentRole === UserRole.DISTRICT) {
      return {
        id: 'open-reports',
        label: 'Open Reports',
        enabled: true,
        onClick: () => navigateToPage('reports'),
        icon: getRouteIcon('reports'),
      };
    }
    return {
      id: 'new-referral',
      label: 'Create Referral',
      enabled: true,
      onClick: () => setIsReferralModalOpen(true),
      icon: ACTION_ICON_BY_ID.createReferral,
    };
  })();

  const moreActions = (() => {
    const actions: HeaderAction[] = [
      {
        id: 'refresh-local',
        label: isRefreshing ? 'Refreshing...' : 'Refresh Data',
        enabled: !isRefreshing,
        onClick: handleRefresh,
        icon: ACTION_ICON_BY_ID.refreshData,
      },
      {
        id: 'ai-brief',
        label: isGenerating ? 'Generating...' : showBriefing ? 'Refresh Summary' : 'Generate Summary',
        enabled: !isGenerating,
        onClick: () => {
          void handleGenerateInsight();
        },
        icon: ACTION_ICON_BY_ID.aiSummary,
      },
    ];

    if (currentRole === UserRole.PRINCIPAL) {
      actions.push({
        id: 'schedule-mtss',
        label: 'Schedule MTSS',
        enabled: true,
        onClick: () => navigateToPage('calendar'),
        icon: getRouteIcon('calendar'),
      });
    }
    if (currentRole === UserRole.TEACHER) {
      actions.push({
        id: 'view-roster',
        label: 'View Roster',
        enabled: true,
        onClick: () => navigateToPage('class_roster'),
        icon: getRouteIcon('class_roster'),
      });
    }
    if (currentRole === UserRole.DISTRICT) {
      actions.push({
        id: 'district-map',
        label: 'Open Schools Map',
        enabled: true,
        onClick: () => navigateToPage('map'),
        icon: getRouteIcon('map'),
      });
    }
    return actions;
  })();

  const contextTasksBase: Array<{ id: string; label: string; onClick: () => void }> = ({
      [UserRole.PRINCIPAL]: [
        { id: 'task-interventions', label: 'Review Active Supports', onClick: () => navigateToPage('interventions') },
        { id: 'task-reports', label: 'Review School Reports', onClick: () => navigateToPage('reports') },
        { id: 'task-monitoring', label: 'Open Monitoring Queue', onClick: () => navigateToPage('rosters') },
      ],
      [UserRole.TEACHER]: [
        { id: 'task-roster', label: 'Open Student Roster', onClick: () => navigateToPage('class_roster') },
        { id: 'task-messages', label: 'Message Family', onClick: () => handleNavigateToMessages('Mrs. Martinez') },
        { id: 'task-gradebook', label: 'Update Gradebook', onClick: () => navigateToPage('gradebook') },
      ],
      [UserRole.DISTRICT]: [
        { id: 'task-fidelity', label: 'Review Fidelity Trends', onClick: () => navigateToPage('reports') },
        { id: 'task-school-rosters', label: 'Open School Rosters', onClick: () => navigateToPage('rosters') },
        { id: 'task-messages', label: 'Send District Message', onClick: () => navigateToPage('messages') },
      ],
      [UserRole.PARENT]: [
        { id: 'task-report', label: 'Review Progress Report', onClick: () => navigateToPage('reports') },
        { id: 'task-calendar', label: 'Check Calendar', onClick: () => navigateToPage('calendar') },
        { id: 'task-documents', label: 'Open Family Resources', onClick: () => navigateToPage('documents') },
      ],
    }[currentRole]);

  const headerActionLabels = useMemo(
    () => new Set([primaryAction?.label, ...moreActions.map((action) => action.label)].filter(Boolean)),
    [moreActions, primaryAction?.label]
  );

  const topTasks = useMemo(
    () => contextTasksBase.filter((task) => !headerActionLabels.has(task.label)),
    [contextTasksBase, headerActionLabels]
  );

  const structuredBriefing = useMemo(() => {
    const risksFromData = data.actionItems.slice(0, 3).map((item) => `${item.studentName}: ${item.insight}`);
    const actionsFromTasks =
      (topTasks.length > 0
        ? topTasks.slice(0, 3).map((task) => task.label)
        : moreActions.slice(0, 3).map((action) => action.label));

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
  }, [briefing, data.actionItems, moreActions, topTasks]);

  // --- Render Helpers ---

  const renderHeader = () => (
    <header className="app-card mb-8 rounded-xl p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <SidebarToggleButton
              onClick={openMobileMenu}
              className="-ml-2 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Workspace</p>
              <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{roleHeadline[currentRole]}</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">Signed in as {data.userName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Role: {currentRole}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Scope: {roleScopeLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Date: {currentDateLabel}
                </span>
                <span
                  className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{
                    borderColor: "var(--tenant-color-secondary)",
                    color: "var(--tenant-color-secondary)",
                    backgroundColor: "color-mix(in srgb, var(--tenant-color-surface) 88%, #ffffff 12%)",
                  }}
                >
                  Mascot: {branding.mascotName}
                </span>
              </div>
              <p
                className={`mt-2 text-xs font-semibold ${
                  computedFreshness.status === 'stale'
                    ? 'text-amber-700'
                    : computedFreshness.status === 'fresh'
                      ? 'text-emerald-700'
                      : 'text-slate-500'
                }`}
              >
                Data status: {freshnessStatusLabel} ({freshnessLabel})
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {primaryAction ? (
            <Button
              variant="primary"
              onClick={primaryAction.onClick}
              disabled={!primaryAction.enabled}
              title={primaryAction.tooltip}
              className="app-button-primary gap-2 shadow-sm"
            >
              <primaryAction.icon size={iconSize("md")} />
              {primaryAction.label}
            </Button>
          ) : null}

          <div className="relative" ref={moreMenuRef}>
            <Button
              variant="secondary"
              onClick={() => setIsMoreMenuOpen((previous) => !previous)}
              className="app-button-secondary gap-2"
              aria-expanded={isMoreMenuOpen}
              aria-haspopup="menu"
            >
              Actions
              <ChevronDown size={iconSize("md")} className={`transition-transform ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
            </Button>

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
                    <action.icon size={iconSize("sm")} />
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
            {currentRole === UserRole.PARENT ? 'AI Assistant' : 'AI Summary'}
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
            Building summary from current dashboard context...
          </div>
        ) : null}

        {briefingError ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p className="font-semibold">AI summary unavailable.</p>
            <p className="mt-1">{briefingError}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleGenerateInsight()}
              className="mt-2 border-rose-200 bg-white text-rose-700 hover:bg-rose-100"
            >
              Retry Summary
            </Button>
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
            <p><span className="font-semibold text-slate-700">Source:</span> AI + live tenant data</p>
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
                    placeholder="Improve this summary?..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="w-full rounded-lg border border-indigo-200 bg-white/80 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitFeedback()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="primary" onClick={handleSubmitFeedback} className="flex-1 gap-2 sm:flex-none">Submit <Send size={14} /></Button>
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
        {renderMobileSectionHeader('quickTasks', 'Context Actions', 'High-value jumps for this role', `${topTasks.length} actions`)}
        <div className={`${mobileSections.quickTasks ? 'block' : 'hidden'} lg:block`}>
          <div className="app-card rounded-xl p-4">
            {topTasks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topTasks.map((task) => (
                  <Button
                    key={task.id}
                    onClick={task.onClick}
                    variant="secondary"
                    size="sm"
                    className="app-chip-action rounded-full text-xs transition-colors"
                  >
                    {task.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No additional context actions for this view.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-2">
        {renderMobileSectionHeader('metrics', 'Performance Metrics', 'Intervention and student outcome indicators', `${data.metrics.length} KPIs`)}
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
          <div className="min-h-[360px] max-h-[70vh]">
            <ActionItemsList
              items={data.actionItems}
              onStudentClick={handleStudentClick}
              onViewAll={() => navigateToPage('reports')}
              totalCount={data.actionItems.length}
            />
          </div>

          {showBriefing ? (
            <div className="space-y-2">
              {renderMobileSectionHeader(
                'aiBriefing',
                currentRole === UserRole.PARENT ? 'Assistant Summary' : 'AI Summary',
                'Top risks and recommended next steps',
                briefing ? 'Ready' : 'Optional'
              )}
              <div className={`${mobileSections.aiBriefing ? 'block' : 'hidden'} lg:block`}>{renderAIBriefing()}</div>
            </div>
          ) : null}

          {/* Dynamic Chart Section */}
          <div className="space-y-2">
            {renderMobileSectionHeader('chart', 'Intervention Outcomes', 'Trend view by support tier', `${data.chartData.length} bars`)}
            <div className={`${mobileSections.chart ? 'block' : 'hidden'} lg:block`}>
              <div className="app-card rounded-xl p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">Intervention Outcomes</h3>
                    <p className="text-sm text-slate-500">{data.chartTitle}</p>
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
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => {
                          const total = Math.max(1, data.chartData.reduce((sum, entry) => sum + entry.value, 0));
                          const pct = Math.round((Number(value) / total) * 100);
                          return [`${value} students (${pct}%)`, "Count"];
                        }}
                      />
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
                <p className="mt-3 text-xs text-slate-500">Bars represent number of students by tier category.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Side Panels) */}
        <div className={`col-span-12 ${currentRole === UserRole.PARENT ? 'lg:col-span-5' : 'lg:col-span-4'} space-y-6 md:space-y-8`}>
          {currentRole !== UserRole.PARENT && data.tierDistribution ? (
            <div className="space-y-2">
              {renderMobileSectionHeader('tierDistribution', 'Tier Distribution', 'Students in Tier 1, Tier 2, and Tier 3 supports', `${data.tierDistribution.length} tiers`)}
              <div className={`${mobileSections.tierDistribution ? 'block' : 'hidden'} lg:block`}>
                <TierDistribution data={data.tierDistribution} />
              </div>
            </div>
          ) : null}

          <div className={`space-y-2 ${isTallViewport ? 'md:sticky md:top-8' : ''}`}>
            {renderMobileSectionHeader('monitoring', 'Monitoring Queue', 'Students flagged for progress follow-up', `${data.monitoringPulse.length} students`)}
            <div className={`${mobileSections.monitoring ? 'block' : 'hidden'} lg:block`}>
              <MonitoringPulse
                students={data.monitoringPulse}
                onStudentClick={handleStudentClick}
                onViewAll={() =>
                  navigateToPage(
                    currentRole === UserRole.PRINCIPAL
                      ? 'rosters'
                      : currentRole === UserRole.TEACHER
                        ? 'class_roster'
                        : 'reports'
                  )
                }
                subtitle="Students currently flagged for progress follow-up."
              />
            </div>
          </div>
          
          {currentRole === UserRole.PARENT && (
            <div className="app-card rounded-xl p-6">
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
    switch(currentViewPage) {
      case 'profile':
        return profileStudent ? (
          <StudentProfile 
            studentName={profileStudent} 
            onBack={handleBackToDashboard} 
            onMenuClick={openMobileMenu}
            onMessageClick={() => handleNavigateToMessages('Mrs. Martinez')}
          />
        ) : renderDashboard();
      case 'rosters':
        return (
          <RosterView 
            onMenuClick={openMobileMenu} 
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
             onMenuClick={openMobileMenu} 
             onStudentClick={(name) => { setSelectedStudent(name); setIsModalOpen(true); }}
             currentUserRole={currentRole}
             viewType={currentRole === UserRole.PRINCIPAL || currentRole === UserRole.DISTRICT ? 'master' : 'classroom'}
             onNavigate={navigateToPage}
          />
        );
      case 'gradebook':
        return (
          <GradebookView 
             onMenuClick={openMobileMenu}
             currentUserRole={currentRole}
          />
        );
      case 'lesson_plans':
        return (
          <LessonPlanLibrary 
             onMenuClick={openMobileMenu}
             currentUserRole={currentRole}
             currentUserName={data.userName}
             onComposeMessage={handleNavigateToMessages}
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
            onMenuClick={openMobileMenu}
          />
        );
      case 'messages':
        return (
          <MessagesView 
            currentUserRole={currentRole}
            currentUserName={data.userName}
            onMenuClick={openMobileMenu}
            launchContext={messageLaunchContext}
          />
        );
      case 'calendar':
        return (
          <CalendarView 
            currentUserRole={currentRole}
            currentUserName={data.userName}
            onMenuClick={openMobileMenu}
          />
        );
      case 'map':
        return (
          <SchoolsMapView 
            onMenuClick={openMobileMenu}
          />
        );
      case 'import':
        return (
          <DataImporter 
            onMenuClick={openMobileMenu}
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
            onMenuClick={openMobileMenu}
            onComposeMessage={handleNavigateToMessages}
            highlightedReferralId={referralQueueFocusId}
            onReferralHighlightConsumed={() => setReferralQueueFocusId(null)}
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
    <SidebarInlineToggleProvider value={false}>
      <div className="app-shell flex min-h-screen w-full min-w-0 overflow-x-hidden font-sans text-slate-900">
      
      {/* Global Chatbot */}
      <Suspense fallback={null}>
        <Chatbot 
          currentUserRole={currentRole}
          currentUserName={data.userName}
          documents={ragDocuments}
          currentSchoolName={data.schoolName}
          currentClassName={currentRole === UserRole.TEACHER ? 'Class 4-B' : undefined}
          activePage={currentViewPage}
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
          onViewQueue={(referralId) => {
            const routeToInterventions = currentRole === UserRole.PRINCIPAL || currentRole === UserRole.TEACHER;
            setReferralQueueFocusId(routeToInterventions ? (referralId ?? null) : null);
            navigateToPage(routeToInterventions ? 'interventions' : 'reports');
          }}
        />
      </Suspense>

      <NotificationDetailModal
        notification={selectedNotification}
        isOpen={Boolean(selectedNotification)}
        onClose={() => setSelectedNotificationId(null)}
        onDismiss={(id) => {
          notifications.dismiss(id);
          setSelectedNotificationId(null);
        }}
        onArchive={(id) => {
          notifications.archive(id);
          setSelectedNotificationId(null);
        }}
        onDelete={(id) => {
          notifications.deleteNotification(id);
          setSelectedNotificationId(null);
        }}
        onOpenSource={(notification) => {
          if (notification.sourceRoute) {
            navigateToPage(notification.sourceRoute as WorkspacePageId);
          }
          setSelectedNotificationId(null);
        }}
      />

      <Sidebar 
        currentRole={currentRole} 
        availableRoles={availableRoles}
        onRoleChange={handleRoleChange}
        userName={sidebarDisplayName}
        userAvatarUrl={userAvatarUrl}
        schoolName={data.schoolName}
        brandLogoUrl={branding.logoUrl}
        mascotName={branding.mascotName}
        isMobileOpen={sidebarState.isMobileOpen}
        onMobileClose={() => closeMobileMenu(true)}
        activePage={currentViewPage}
        isDesktopCollapsed={sidebarState.isDesktopCollapsed}
        onDesktopCollapseToggle={sidebarActions.toggleDesktopCollapsed}
        groupState={sidebarState.groupState}
        onGroupToggle={sidebarActions.toggleGroupExpanded}
        searchQuery={sidebarState.searchQuery}
        onSearchQueryChange={sidebarActions.setSearchQuery}
        notificationUnseenCount={notifications.unreadCount}
        activeNotifications={notifications.activeNotifications}
        archivedNotifications={notifications.archivedNotifications}
        notificationLoading={notifications.query.isLoading}
        notificationError={notificationErrorMessage}
        onNotificationOpen={(id) => {
          setSelectedNotificationId(id);
          notifications.markRead(id);
        }}
        onNotificationDismiss={(id) => notifications.dismiss(id)}
        onNotificationArchive={(id) => notifications.archive(id)}
        onNotificationDelete={(id) => notifications.deleteNotification(id)}
        onNotificationRestore={(id) => notifications.restore(id)}
        onNotificationMarkSeen={(ids) => notifications.markSeen(ids)}
        onNotificationMarkAllRead={() => notifications.markAllRead()}
        onNotificationArchiveRead={() => notifications.archiveRead()}
      />

      {!sidebarState.isMobileOpen && isMobileViewport === true ? (
        <SidebarToggleButton
          onClick={openMobileMenu}
          className="fixed bottom-4 left-4 z-40 rounded-full border border-slate-200 bg-white/95 shadow-lg backdrop-blur"
          ariaLabel="Open workspace menu"
          iconSize={20}
          forceRender
        />
      ) : null}
      
      <main
        className={`app-main relative mx-auto w-full min-w-0 flex-1 overflow-x-hidden p-4 transition-all duration-300 md:p-8 ${
          sidebarState.isDesktopCollapsed
            ? "lg:ml-20 lg:max-w-[calc(100vw-5rem)]"
            : "lg:ml-64 lg:max-w-[calc(100vw-16rem)]"
        }`}
      >
        <Suspense fallback={<LazyViewFallback />}>
          {renderActivePage()}
        </Suspense>
      </main>
      </div>
    </SidebarInlineToggleProvider>
  );
};

export default App;


