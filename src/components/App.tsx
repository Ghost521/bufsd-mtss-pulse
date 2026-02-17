
import React, { lazy, Suspense, useState, useEffect, useRef, useMemo } from 'react';
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
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MetricCard } from './MetricCard';
import { ActionItemsList } from './ActionItemsList';
import { TierDistribution } from './TierDistribution';
import { MonitoringPulse } from './MonitoringPulse';
import { RichTextRenderer } from './RichTextRenderer';
import { PRINCIPAL_DATA, TEACHER_DATA, DISTRICT_DATA, PARENT_DATA, MOCK_RAG_DOCUMENTS } from '../constants';
import type { DashboardData, RAGDocument} from '../types';
import { UserRole, ApprovalStatus, DocumentScope } from '../types';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { generateDashboardBriefingStream } from '../services/geminiService';

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
  kind: 'primary' | 'secondary' | 'tertiary';
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

const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.PRINCIPAL);
  const [data, setData] = useState<DashboardData>(PRINCIPAL_DATA);
  const [hasHydrated, setHasHydrated] = useState(false);
  
  // UI State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [messageRecipient, setMessageRecipient] = useState<string | undefined>(undefined);

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

  const availablePagesByRole: Record<UserRole, string[]> = useMemo(
    () => ({
      [UserRole.PRINCIPAL]: ['dashboard', 'rosters', 'lesson_plans', 'interventions', 'calendar', 'reports', 'messages', 'documents', 'import', 'settings', 'profile'],
      [UserRole.TEACHER]: ['dashboard', 'class_roster', 'gradebook', 'lesson_plans', 'interventions', 'calendar', 'messages', 'documents', 'import', 'settings', 'profile'],
      [UserRole.DISTRICT]: ['dashboard', 'map', 'reports', 'calendar', 'messages', 'documents', 'import', 'settings', 'profile'],
      [UserRole.PARENT]: ['dashboard', 'reports', 'calendar', 'messages', 'documents', 'settings', 'profile'],
    }),
    []
  );

  const roleHeadline = useMemo(
    () =>
      ({
        [UserRole.PRINCIPAL]: 'Principal Command Center',
        [UserRole.TEACHER]: 'Classroom Command Center',
        [UserRole.DISTRICT]: 'District Operations Workspace',
        [UserRole.PARENT]: 'Family Progress Workspace',
      }) as Record<UserRole, string>,
    []
  );

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
    setIsModalOpen(false);
    setSelectedStudent(null);
    setActivePage((current) => (availablePagesByRole[currentRole].includes(current) ? current : 'dashboard'));
    setProfileStudent(null);
    setIsMobileMenuOpen(false);
    setMessageRecipient(undefined);
    setIsReferralModalOpen(false);
  }, [availablePagesByRole, currentRole]);

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
    if (!computedFreshness.lastUpdatedAt) return 'Update status unavailable';
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

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    window.setTimeout(() => {
      setFreshness({
        source: 'local',
        lastUpdatedAt: new Date().toISOString(),
        status: 'fresh',
      });
      setIsRefreshing(false);
    }, 450);
  };

  const handleGenerateInsight = async () => {
    setIsGenerating(true);
    setShowBriefing(true);
    setBriefing(''); // Clear previous briefing
    
    // Reset feedback UI for new generation
    setShowFeedbackInput(false);
    setFeedbackSubmitted(false);
    setFeedbackSentiment(null);
    setFeedbackText('');

    await generateDashboardBriefingStream(data, feedbackHistory, (chunk) => {
      setBriefing(prev => (prev || '') + chunk);
    });
    
    setIsGenerating(false);
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
    setActivePage('profile');
    setIsModalOpen(false);
    window.scrollTo(0,0);
  };

  const handleBackToDashboard = () => {
    setActivePage('dashboard');
    setProfileStudent(null);
  };

  // Messaging Handlers
  const handleNavigateToMessages = (recipient?: string) => {
    setIsModalOpen(false);
    setActivePage('messages');
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
        kind: 'primary',
        enabled: true,
        onClick: () => handleNavigateToMessages('Mr. Davis'),
        icon: MessageSquare,
      };
    }
    if (currentRole === UserRole.DISTRICT) {
      return {
        id: 'open-reports',
        label: 'Open Reports',
        kind: 'primary',
        enabled: true,
        onClick: () => setActivePage('reports'),
        icon: BarChart2,
      };
    }
    return {
      id: 'new-referral',
      label: 'New Referral',
      kind: 'primary',
      enabled: true,
      onClick: () => setIsReferralModalOpen(true),
      icon: Plus,
    };
  })();

  const secondaryActions = (() => {
    const actions: HeaderAction[] = [
      {
        id: 'refresh-local',
        label: isRefreshing ? 'Refreshing…' : 'Refresh Data',
        kind: 'secondary',
        enabled: !isRefreshing,
        onClick: handleRefresh,
        icon: RefreshCw,
      },
      {
        id: 'ai-brief',
        label: isGenerating ? 'Generating…' : showBriefing ? 'Refresh AI Brief' : 'Generate AI Brief',
        kind: 'secondary',
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
        kind: 'tertiary',
        enabled: true,
        onClick: () => setActivePage('calendar'),
        icon: CalendarPlus,
      });
    }
    if (currentRole === UserRole.TEACHER) {
      actions.push({
        id: 'view-roster',
        label: 'View Roster',
        kind: 'tertiary',
        enabled: true,
        onClick: () => setActivePage('class_roster'),
        icon: Users,
      });
    }
    if (currentRole === UserRole.DISTRICT) {
      actions.push({
        id: 'allocate',
        label: 'Allocate Resources',
        kind: 'tertiary',
        enabled: false,
        tooltip: 'Allocation workflow is not available in this build.',
        onClick: () => {},
        icon: CalendarPlus,
      });
    }
    return actions;
  })();

  const topTasks: Array<{ id: string; label: string; onClick: () => void }> = ({
      [UserRole.PRINCIPAL]: [
        { id: 'task-referral', label: 'Create Referral', onClick: () => setIsReferralModalOpen(true) },
        { id: 'task-interventions', label: 'Review Interventions', onClick: () => setActivePage('interventions') },
        { id: 'task-calendar', label: 'Open MTSS Calendar', onClick: () => setActivePage('calendar') },
      ],
      [UserRole.TEACHER]: [
        { id: 'task-roster', label: 'Open Class Roster', onClick: () => setActivePage('class_roster') },
        { id: 'task-messages', label: 'Message Family', onClick: () => handleNavigateToMessages('Mrs. Martinez') },
        { id: 'task-gradebook', label: 'Update Gradebook', onClick: () => setActivePage('gradebook') },
      ],
      [UserRole.DISTRICT]: [
        { id: 'task-map', label: 'View Schools Map', onClick: () => setActivePage('map') },
        { id: 'task-reports', label: 'Review System Reports', onClick: () => setActivePage('reports') },
        { id: 'task-messages', label: 'Send District Message', onClick: () => setActivePage('messages') },
      ],
      [UserRole.PARENT]: [
        { id: 'task-report', label: 'Review Progress Report', onClick: () => setActivePage('reports') },
        { id: 'task-message', label: 'Message Teacher', onClick: () => handleNavigateToMessages('Mr. Davis') },
        { id: 'task-calendar', label: 'Check Calendar', onClick: () => setActivePage('calendar') },
      ],
    }[currentRole]);

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
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Workspace</p>
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
                {freshnessLabel} • Local workspace source
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

          {secondaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={!action.enabled}
              title={action.tooltip}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                action.kind === 'secondary'
                  ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <action.icon size={16} />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
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
    </header>
  );

  const renderAIBriefing = () => (
    showBriefing && (
      <div className="mb-8 bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-xl p-6 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Bot size={120} />
        </div>
        
        <div className="flex justify-between items-start relative z-10">
          <h3 className="text-indigo-900 font-bold text-lg mb-2 flex items-center gap-2">
            <Bot size={20} className="text-indigo-600"/>
            AI {currentRole === UserRole.PARENT ? 'Assistant' : 'Executive Summary'}
          </h3>
          {!isGenerating && briefing && !feedbackSubmitted && !showFeedbackInput && (
            <div className="flex items-center gap-2 text-sm text-indigo-400">
              <span className="text-xs hidden sm:inline">Helpful?</span>
              <button type="button" aria-label="Mark AI summary as helpful" onClick={() => handleFeedbackClick('positive')} className="p-1 hover:bg-indigo-100 rounded-full transition-colors hover:text-indigo-600"><ThumbsUp size={16} /></button>
              <button type="button" aria-label="Mark AI summary as not helpful" onClick={() => handleFeedbackClick('negative')} className="p-1 hover:bg-indigo-100 rounded-full transition-colors hover:text-indigo-600"><ThumbsDown size={16} /></button>
            </div>
          )}
        </div>

        <div className="relative z-10">
          {isGenerating && !briefing ? (
            <div className="flex items-center gap-3 text-indigo-700 animate-pulse py-2">
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-200" />
              Analyzing data...
            </div>
          ) : (
            <>
              <div className="max-w-4xl">
                <RichTextRenderer content={briefing || ''} variant="dark" className="text-indigo-900/80" isTyping={isGenerating} />
              </div>
              {!isGenerating && (showFeedbackInput || feedbackSubmitted) && (
                <div className="mt-4 pt-4 border-t border-indigo-100/50 animate-in fade-in slide-in-from-top-2">
                  {feedbackSubmitted ? (
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium"><ThumbsUp size={16} /> Thank you for your feedback!</div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
                       <div className="relative flex-1">
                         <MessageSquare size={16} className="absolute left-3 top-3 text-indigo-400" />
                         <input 
                           type="text" 
                           placeholder="Improve this briefing?..."
                           value={feedbackText}
                           onChange={(e) => setFeedbackText(e.target.value)}
                           className="w-full pl-9 pr-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white/80"
                           onKeyDown={(e) => e.key === 'Enter' && handleSubmitFeedback()}
                         />
                       </div>
                       <div className="flex gap-2">
                        <button type="button" onClick={handleSubmitFeedback} className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">Submit <Send size={14} /></button>
                        <button type="button" aria-label="Close feedback input" onClick={() => setShowFeedbackInput(false)} className="p-2 text-indigo-400 hover:text-indigo-600 bg-white border border-indigo-100 rounded-lg sm:bg-transparent sm:border-none"><X size={18} /></button>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  );

  const renderDashboard = () => (
    <>
      {renderHeader()}
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} icon={iconMap[metric.icon] || Activity} />
        ))}
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
              onViewAll={() => setActivePage('reports')}
              totalCount={data.actionItems.length}
            />
          </div>

          {renderAIBriefing()}

          {/* Dynamic Chart Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                 <h3 className="font-bold text-slate-800">{data.chartTitle}</h3>
                 <p className="text-sm text-slate-500">Performance Visualization</p>
              </div>
            </div>
            
            <div ref={chartContainerRef} className="h-56 md:h-64 w-full min-w-0">
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
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
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

        {/* Right Column (Side Panels) */}
        <div className={`col-span-12 ${currentRole === UserRole.PARENT ? 'lg:col-span-5' : 'lg:col-span-4'} space-y-6 md:space-y-8`}>
          {currentRole !== UserRole.PARENT && data.tierDistribution && (
            <TierDistribution data={data.tierDistribution} />
          )}

          <div className="md:sticky md:top-8">
              <MonitoringPulse 
                  students={data.monitoringPulse} 
                  onStudentClick={handleStudentClick}
                  onViewAll={() => setActivePage(currentRole === UserRole.PRINCIPAL || currentRole === UserRole.TEACHER ? 'class_roster' : 'reports')}
                  freshnessLabel={freshnessLabel}
              />
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

  const renderUnavailableView = (title: string, description: string) => (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm">{description}</p>
      <button
        type="button"
        onClick={() => setActivePage('dashboard')}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
      >
        Back to Workspace
        <ArrowRight size={14} />
      </button>
    </div>
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
        ) : null;
      case 'rosters':
        return (
          <RosterView 
            onMenuClick={() => setIsMobileMenuOpen(true)} 
            onEmailClick={(name) => handleNavigateToMessages(name)}
            onStudentClick={(name) => { setSelectedStudent(name); setIsModalOpen(true); }}
            onNavigate={setActivePage}
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
             onNavigate={setActivePage}
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
            onImportComplete={() => setActivePage('dashboard')}
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
      case 'staffing':
        return renderUnavailableView('Staffing Workspace Not Enabled', 'Staffing workflows are not enabled in this environment yet.');
      case 'assignments':
        return renderUnavailableView('Assignments Not Enabled', 'Assignments are not enabled for this parent workspace build yet.');
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
        />
      </Suspense>

      <Sidebar 
        currentRole={currentRole} 
        onRoleChange={setCurrentRole}
        userName={data.userName}
        schoolName={data.schoolName}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activePage={activePage}
        onNavigate={setActivePage}
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



