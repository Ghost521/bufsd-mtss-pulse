
import React, { lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { SidebarInlineToggleProvider, SidebarToggleButton } from './SidebarToggleButton';
import type {
  Conversation,
  DashboardData,
  MessagesLaunchContext,
  RAGDocument,
} from '../types';
import { UserRole, ApprovalStatus, DocumentScope } from '../types';
import { generateDashboardBriefing } from '../services/geminiService';
import {
  buildWorkspacePath,
  DEFAULT_WORKSPACE_PAGE,
  normalizePageForRole,
  slugToPage,
  type WorkspacePageId,
} from '../lib/workspaceRoutes';
import {
  clearDevRoleOverrideInStorage,
  getAvailableUserRoles,
  getDevRoleOverrideFromStorage,
  getRouteAuthStatus,
  resolveRouteUserRole,
  setDevRoleOverrideInStorage,
} from '../lib/route-auth';
import type { WorkspaceRouteAuth } from '../lib/workspace-route-auth';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { useTenantBranding } from '../hooks/useTenantBranding';
import { useSidebarState } from '../hooks/useSidebarState';
import { useNotifications } from '../hooks/useNotifications';
import { ACTION_ICON_BY_ID, getRouteIcon } from '../lib/ui/icons';
import { getPendingInterventionReviewCount, getPendingReferralQueue } from '../lib/queue-selectors';
import { WorkspacePageContent } from './WorkspacePageContent';

const StudentDetailModal = lazy(() => import('./StudentDetailModal').then((m) => ({ default: m.StudentDetailModal })));
const DashboardView = lazy(() => import('./DashboardView').then((m) => ({ default: m.DashboardView })));
const Chatbot = lazy(() => import('./Chatbot').then((m) => ({ default: m.Chatbot })));
const ReferralModal = lazy(() => import('./ReferralModal').then((m) => ({ default: m.ReferralModal })));
const NotificationDetailModal = lazy(() =>
  import('./notifications/NotificationDetailModal').then((m) => ({ default: m.NotificationDetailModal })),
);

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
  referralId?: string;
  workflowStatus?: string;
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

type InitialRoleState = {
  availableRoles: UserRole[];
  currentRole: UserRole;
  sessionUserId: string | null;
};

const deriveInitialRoleState = (initialRouteAuth?: WorkspaceRouteAuth | null): InitialRoleState => {
  if (!initialRouteAuth) {
    return {
      availableRoles: [UserRole.PRINCIPAL],
      currentRole: UserRole.PRINCIPAL,
      sessionUserId: null,
    };
  }

  const nextRoles = getAvailableUserRoles(initialRouteAuth.auth);
  if (ALLOW_ROLE_SWITCHING) {
    const devRoleOverride = getDevRoleOverrideFromStorage();
    return {
      availableRoles: nextRoles.length > 0 ? nextRoles : [initialRouteAuth.activeRole],
      currentRole:
        devRoleOverride && nextRoles.includes(devRoleOverride)
          ? devRoleOverride
          : initialRouteAuth.activeRole,
      sessionUserId: initialRouteAuth.auth.userId,
    };
  }

  return {
    availableRoles: [initialRouteAuth.activeRole],
    currentRole: initialRouteAuth.activeRole,
    sessionUserId: initialRouteAuth.auth.userId,
  };
};

type AppProps = {
  initialRouteAuth?: WorkspaceRouteAuth | null;
};

const App: React.FC<AppProps> = ({ initialRouteAuth = null }) => {
  const initialRoleState = deriveInitialRoleState(initialRouteAuth);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const routePage = useMemo(() => {
    if (!pathname.startsWith("/app")) return null;
    if (pathname === "/app" || pathname === "/app/") return null;
    const slug = pathname.replace(/^\/app\//, "").split("/")[0];
    return slugToPage(slug);
  }, [pathname]);

  const [currentRole, setCurrentRole] = useState<UserRole>(initialRoleState.currentRole);
  const [sessionUserId, setSessionUserId] = useState<string | null>(initialRoleState.sessionUserId);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>(initialRoleState.availableRoles);
  const [data, setData] = useState<DashboardData>(createEmptyDashboardData(initialRoleState.currentRole));
  const [settingsDisplayName, setSettingsDisplayName] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
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
  const syncDerivedNotifications = notifications.syncDerivedNotifications;

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

    const applyAuthState = (routeAuth: WorkspaceRouteAuth) => {
      setSessionUserId(routeAuth.auth.userId);
      const nextRoles = getAvailableUserRoles(routeAuth.auth);

      if (nextRoles.length === 0) return;

      const devRoleOverride = getDevRoleOverrideFromStorage();
      if (ALLOW_ROLE_SWITCHING) {
        setAvailableRoles(nextRoles);
        if (devRoleOverride && !nextRoles.includes(devRoleOverride)) {
          clearDevRoleOverrideInStorage();
        }
        setCurrentRole((previous) => {
          if (devRoleOverride && nextRoles.includes(devRoleOverride)) return devRoleOverride;
          if (nextRoles.includes(previous)) return previous;
          return routeAuth.activeRole;
        });
        return;
      }

      clearDevRoleOverrideInStorage();
      setAvailableRoles([routeAuth.activeRole]);
      setCurrentRole(routeAuth.activeRole);
    };

    const loadSessionRoles = async () => {
      try {
        let routeAuth: WorkspaceRouteAuth | null = initialRouteAuth;

        if (!routeAuth) {
          const auth = await getRouteAuthStatus();
          if (!auth.signedIn) return;
          const activeRole = resolveRouteUserRole(auth);
          if (!activeRole) return;
          routeAuth = {
            auth,
            activeRole,
          };
        }

        if (!routeAuth) return;
        if (!isMounted) return;
        applyAuthState(routeAuth);
      } catch {
        // Keep default local role state when health lookup fails.
      }
    };

    void loadSessionRoles();
    return () => {
      isMounted = false;
    };
  }, [initialRouteAuth]);

  useEffect(() => {
    const requestedPage = routePage ?? DEFAULT_WORKSPACE_PAGE;
    const normalizedPage = normalizePageForRole(currentRole, requestedPage);

    setActivePage(normalizedPage);
    closeMobileMenu();

    if (requestedPage !== normalizedPage) {
      void navigate({ href: buildWorkspacePath(normalizedPage), replace: true });
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
    syncDerivedNotifications({
      messages: messagesCollection.query.data?.rows ?? [],
      referrals: referralsCollection.query.data?.rows ?? [],
      interventions: interventionsCollection.query.data?.rows ?? [],
      documents: documentsCollection.query.data?.rows ?? [],
    });
  }, [
    documentsCollection.query.data?.rows,
    interventionsCollection.query.data?.rows,
    messagesCollection.query.data?.rows,
    syncDerivedNotifications,
    referralsCollection.query.data?.rows,
  ]);

  useEffect(() => {
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
    const status: FreshnessState['status'] = ageMs > 15 * 60 * 1000 ? 'stale' : 'fresh';
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
    void navigate({ href: buildWorkspacePath(nextPage) });
  };

  const handleRoleChange = (nextRole: UserRole) => {
    if (!ALLOW_ROLE_SWITCHING) return;
    if (!availableRoles.includes(nextRole)) return;
    setDevRoleOverrideInStorage(nextRole);
    const targetPage = normalizePageForRole(nextRole, currentViewPage === 'profile' ? 'dashboard' : currentViewPage);
    setCurrentRole(nextRole);
    setActivePage(targetPage);
    setProfileStudent(null);
    closeMobileMenu();
    void navigate({ href: buildWorkspacePath(targetPage) });
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
        { id: 'task-interventions', label: 'Open Intervention Queue', onClick: () => navigateToPage('interventions') },
        { id: 'task-referrals', label: 'Open Referral Queue', onClick: () => navigateToPage('interventions') },
        { id: 'task-mtss', label: 'Schedule MTSS', onClick: () => navigateToPage('calendar') },
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

  const pendingReferralCount = useMemo(() => {
    const rows = referralsCollection.query.data?.rows ?? [];
    return getPendingReferralQueue(rows).length;
  }, [referralsCollection.query.data?.rows]);

  const pendingInterventionReviewCount = useMemo(() => {
    const interventionRows = interventionsCollection.query.data?.rows ?? [];
    const referralRows = referralsCollection.query.data?.rows ?? [];
    return getPendingInterventionReviewCount(interventionRows, referralRows);
  }, [interventionsCollection.query.data?.rows, referralsCollection.query.data?.rows]);

  const principalPriorities =
    currentRole !== UserRole.PRINCIPAL
      ? []
      : [
          {
            id: 'principal-priority-interventions',
            label: 'Intervention Review Queue',
            detail: 'Approve, deny, or schedule meetings for active intervention requests.',
            stat: `${pendingInterventionReviewCount} pending`,
            onClick: () => navigateToPage('interventions'),
          },
          {
            id: 'principal-priority-referrals',
            label: 'Referral Queue',
            detail: 'Triage referrals and launch supports for newly flagged students.',
            stat: `${pendingReferralCount} awaiting review`,
            onClick: () => navigateToPage('interventions'),
          },
          {
            id: 'principal-priority-mtss',
            label: 'MTSS Meeting Planner',
            detail: 'Coordinate intervention ownership, follow-up windows, and family outreach.',
            stat: `${data.monitoringPulse.length} students flagged`,
            onClick: () => navigateToPage('calendar'),
          },
        ];

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

  const renderDashboard = () => (
    <DashboardView
      currentRole={currentRole}
      data={data}
      mascotName={branding.mascotName}
      roleHeadline={roleHeadline[currentRole]}
      roleScopeLabel={roleScopeLabel}
      currentDateLabel={currentDateLabel}
      freshnessStatus={computedFreshness.status}
      freshnessStatusLabel={freshnessStatusLabel}
      freshnessLabel={freshnessLabel}
      flashMessage={flashMessage}
      primaryAction={primaryAction}
      moreActions={moreActions}
      isMoreMenuOpen={isMoreMenuOpen}
      moreMenuRef={moreMenuRef}
      topTasks={topTasks}
      principalPriorities={principalPriorities}
      mobileSections={mobileSections}
      showBriefing={showBriefing}
      isGenerating={isGenerating}
      briefing={briefing}
      briefingError={briefingError}
      briefingGeneratedAt={briefingGeneratedAt}
      structuredBriefing={structuredBriefing}
      briefingReviewDeadline={briefingReviewDeadline}
      feedbackSubmitted={feedbackSubmitted}
      showFeedbackInput={showFeedbackInput}
      feedbackText={feedbackText}
      onOpenMobileMenu={openMobileMenu}
      onToggleMoreMenu={() => setIsMoreMenuOpen((previous) => !previous)}
      onCloseMoreMenu={() => setIsMoreMenuOpen(false)}
      onToggleMobileSection={toggleMobileSection}
      onGenerateInsight={handleGenerateInsight}
      onFeedbackClick={handleFeedbackClick}
      onFeedbackTextChange={setFeedbackText}
      onSubmitFeedback={handleSubmitFeedback}
      onCloseFeedbackInput={() => setShowFeedbackInput(false)}
      onStudentClick={handleStudentClick}
      onViewAllActionItems={() => navigateToPage('reports')}
      onViewAllMonitoring={() =>
        navigateToPage(
          currentRole === UserRole.PRINCIPAL
            ? 'rosters'
            : currentRole === UserRole.TEACHER
              ? 'class_roster'
              : 'reports',
        )
      }
    />
  );

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
          currentUserRole={currentRole}
          currentUserName={data.userName}
          currentUserId={sessionUserId}
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

      {selectedNotification ? (
        <Suspense fallback={null}>
          <NotificationDetailModal
            notification={selectedNotification}
            isOpen
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
        </Suspense>
      ) : null}

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
          <WorkspacePageContent
            currentViewPage={currentViewPage}
            profileStudent={profileStudent}
            currentRole={currentRole}
            currentUserName={data.userName}
            currentSchoolName={data.schoolName}
            currentUserId={sessionUserId}
            ragDocuments={ragDocuments}
            messageLaunchContext={messageLaunchContext}
            referralQueueFocusId={referralQueueFocusId}
            notificationErrorMessage={notificationErrorMessage}
            notifications={{
              activeNotifications: notifications.activeNotifications,
              archivedNotifications: notifications.archivedNotifications,
              trashNotifications: notifications.trashNotifications,
              unreadCount: notifications.unreadCount,
              loading: notifications.query.isLoading,
              errorMessage: notificationErrorMessage,
              onOpenNotification: (id) => {
                setSelectedNotificationId(id);
                notifications.markRead(id);
              },
              onDismissNotification: (id) => notifications.dismiss(id),
              onArchiveNotification: (id) => notifications.archive(id),
              onDeleteNotification: (id) => notifications.deleteNotification(id),
              onRestoreNotification: (id) => notifications.restore(id),
              onMarkAllRead: () => notifications.markAllRead(),
              onArchiveRead: () => notifications.archiveRead(),
            }}
            renderDashboard={renderDashboard}
            onOpenMobileMenu={openMobileMenu}
            onNavigateToPage={navigateToPage}
            onNavigateToMessages={handleNavigateToMessages}
            onStudentClick={handleStudentClick}
            onBackToDashboard={handleBackToDashboard}
            onUploadDocument={handleUploadDocument}
            onApproveDocument={handleApproveDocument}
            onRejectDocument={handleRejectDocument}
            onDeleteDocument={handleDeleteDocument}
            onStatusChange={handleStatusChange}
            onScopeChange={handleScopeChange}
            onReferralHighlightConsumed={() => setReferralQueueFocusId(null)}
          />
        </Suspense>
      </main>
      </div>
    </SidebarInlineToggleProvider>
  );
};

export default App;


