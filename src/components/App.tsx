
import React, { useState, useEffect } from 'react';
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
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MetricCard } from './MetricCard';
import { ActionItemsList } from './ActionItemsList';
import { TierDistribution } from './TierDistribution';
import { MonitoringPulse } from './MonitoringPulse';
import { StudentDetailModal } from './StudentDetailModal';
import { StudentProfile } from './StudentProfile';
import { RosterView } from './RosterView';
import { StudentRosterView } from './StudentRosterView';
import { GradebookView } from './GradebookView';
import { DocumentManager } from './DocumentManager'; 
import { Chatbot } from './Chatbot'; 
import { MessagesView } from './MessagesView'; 
import { SettingsView } from './SettingsView'; 
import { CalendarView } from './CalendarView'; 
import { SchoolsMapView } from './SchoolsMapView';
import { DataImporter } from './DataImporter'; 
import { ReportsView } from './ReportsView'; 
import { ReferralModal } from './ReferralModal';
import { InterventionManager } from './InterventionManager';
import { LessonPlanLibrary } from './LessonPlanLibrary';
import { RichTextRenderer } from './RichTextRenderer';
import { PRINCIPAL_DATA, TEACHER_DATA, DISTRICT_DATA, PARENT_DATA, MOCK_RAG_DOCUMENTS } from '../constants';
import type { DashboardData, RAGDocument} from '../types';
import { UserRole, ApprovalStatus, DocumentScope } from '../types';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { generateDashboardBriefingStream } from '../services/geminiService';

const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.PRINCIPAL);
  const [data, setData] = useState<DashboardData>(PRINCIPAL_DATA);
  
  // UI State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [messageRecipient, setMessageRecipient] = useState<string | undefined>(undefined);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success'>('idle');
  const [lastSynced, setLastSynced] = useState<Date>(new Date());

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

  // Navigation State (Student Profile)
  const [profileStudent, setProfileStudent] = useState<string | null>(null);

  // Modal State
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Referral Modal
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  // RAG Document State
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>(MOCK_RAG_DOCUMENTS);

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
    setActivePage('dashboard');
    setProfileStudent(null);
    setIsMobileMenuOpen(false);
    setMessageRecipient(undefined);
    setIsReferralModalOpen(false);
  }, [currentRole]);

  const iconMap: Record<string, React.ElementType> = {
    Activity,
    Zap,
    AlertCircle,
    Users,
    Calendar
  };

  const handleSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    
    // Simulate data synchronization delay
    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatus('success');
      setLastSynced(new Date());
      
      // Revert to idle after 3 seconds
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);
    }, 2000);
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

  // --- Render Helpers ---

  const renderHeader = () => (
    <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          <Menu size={24} />
        </button>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            {currentRole === UserRole.PARENT ? 'Welcome' : 'Good Morning'}, {data.userName}
          </h2>
          <p className="text-sm md:text-base text-slate-500 mt-1 md:mt-2 font-medium">
            {currentRole === UserRole.DISTRICT ? 'District-wide' : data.schoolName} pulse for Thursday, Nov 21.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-3">
          <button 
          onClick={handleGenerateInsight}
          disabled={isGenerating}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors font-medium border border-transparent disabled:opacity-70 disabled:cursor-not-allowed text-sm"
          >
            <Bot size={18} />
            {isGenerating ? 'Generating...' : (showBriefing ? 'Refresh AI' : 'AI Brief')}
        </button>

        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-sm border transition-all font-medium text-sm ${
            syncStatus === 'success' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
          title={`Last synced: ${lastSynced.toLocaleTimeString()}`}
        >
          {isSyncing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : syncStatus === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <RefreshCw size={18} />
          )}
          {isSyncing ? 'Syncing...' : syncStatus === 'success' ? 'Synced' : 'Sync'}
        </button>

        {currentRole === UserRole.PRINCIPAL && (
          <button 
            onClick={() => setActivePage('calendar')}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors font-medium text-sm"
          >
            <CalendarPlus size={18} />
            Schedule MTSS
          </button>
        )}

        {currentRole === UserRole.TEACHER && (
          <button 
            onClick={() => setActivePage('class_roster')}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors font-medium text-sm"
          >
            <Users size={18} />
            View Roster
          </button>
        )}

        {currentRole !== UserRole.PARENT && (
          <button 
            onClick={() => {
              if (currentRole === UserRole.DISTRICT) {
                alert("Allocation feature not implemented in this demo.");
              } else {
                setIsReferralModalOpen(true);
              }
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors font-medium hover:shadow-lg transform active:scale-95 duration-100 text-sm"
          >
            <Plus size={18} />
            {currentRole === UserRole.DISTRICT ? 'Allocate' : 'New Referral'}
          </button>
        )}
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
              <button onClick={() => handleFeedbackClick('positive')} className="p-1 hover:bg-indigo-100 rounded-full transition-colors hover:text-indigo-600"><ThumbsUp size={16} /></button>
              <button onClick={() => handleFeedbackClick('negative')} className="p-1 hover:bg-indigo-100 rounded-full transition-colors hover:text-indigo-600"><ThumbsDown size={16} /></button>
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
                        <button onClick={handleSubmitFeedback} className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">Submit <Send size={14} /></button>
                        <button onClick={() => setShowFeedbackInput(false)} className="p-2 text-indigo-400 hover:text-indigo-600 bg-white border border-indigo-100 rounded-lg sm:bg-transparent sm:border-none"><X size={18} /></button>
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
      {renderAIBriefing()}
      
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
            <ActionItemsList items={data.actionItems} onStudentClick={handleStudentClick} />
          </div>

          {/* Dynamic Chart Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                 <h3 className="font-bold text-slate-800">{data.chartTitle}</h3>
                 <p className="text-sm text-slate-500">Performance Visualization</p>
              </div>
            </div>
            
            <div className="h-56 md:h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={data.chartData} barSize={60}>
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
              </ResponsiveContainer>
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
                  onViewAll={() => setActivePage('class_roster')}
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
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50/80 font-sans text-slate-900">
      
      {/* Global Chatbot */}
      <Chatbot 
        currentUserRole={currentRole}
        currentUserName={data.userName}
        documents={ragDocuments}
        currentSchoolName={data.schoolName}
        currentClassName={currentRole === UserRole.TEACHER ? 'Class 4-B' : undefined}
      />

      <StudentDetailModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        studentName={selectedStudent} 
        onViewFullProfile={handleNavigateToProfile}
        onMessageParents={() => handleNavigateToMessages('Mrs. Martinez')} // Mock parent name
      />

      <ReferralModal 
        isOpen={isReferralModalOpen} 
        onClose={() => setIsReferralModalOpen(false)}
      />

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
      
      <main className={`flex-1 transition-all duration-300 ${isMobileMenuOpen ? 'lg:ml-64' : 'lg:ml-64'} p-4 md:p-8 w-full max-w-[1600px] mx-auto`}>
        {renderActivePage()}
      </main>
    </div>
  );
};

export default App;
