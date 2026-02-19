
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  AlertCircle,
  BookCopy, 
  Search, 
  Clock, 
  Bot, 
  Loader2, 
  Share2,
  Printer,
  Save,
  Trash2,
  Sparkles,
  BookOpen,
  Check,
  Layout,
  ListOrdered,
  Users,
  User,
  Lock,
  Globe,
  Edit3,
  ChevronDown,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { UserRole, type MessagesLaunchContext, type StudentRosterItem } from '../types';
import { DraggableModal } from './DraggableModal';
import type { AIInterventionPlan } from '../services/geminiService';
import { generateStructuredIntervention } from '../services/geminiService';
import { Tier } from '../types';
import { RichTextRenderer } from './RichTextRenderer';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { SidebarToggleButton } from './SidebarToggleButton';
import { useStudents } from '../hooks/useStudents';
import {
  areLessonPlansEqual,
  isLessonPlanOwnedBy,
  isLessonPlanVisible,
  matchesLessonPlanSearch,
  normalizeOwnerKey,
  sortLessonPlans,
  type LessonPlanSort,
} from '../lib/lesson-plan-utils';

interface LessonPlanLibraryProps {
  onMenuClick: () => void;
  currentUserRole: UserRole;
  currentUserName: string;
  currentUserId?: string;
  onComposeMessage?: (launch: MessagesLaunchContext) => void;
}

interface LessonPlan extends AIInterventionPlan {
  id: string;
  subject: string;
  grade: string;
  createdDate: string;
  updatedAt?: string;
  author: string;
  ownerId: string; // To track ownership
  isShared: boolean;
  studentGroup?: string[]; // Names of students in the group
}

type ViewFilter = 'All' | 'My Plans' | 'Shared';
const VIEW_FILTERS: ViewFilter[] = ['All', 'My Plans', 'Shared'];

export const LessonPlanLibrary: React.FC<LessonPlanLibraryProps> = ({
  onMenuClick,
  currentUserRole,
  currentUserName,
  currentUserId,
  onComposeMessage,
}) => {
  const lessonPlanCollection = useTenantCollection<LessonPlan>('lesson-plans');
  const studentsApi = useStudents('class');
  const ownerKey = normalizeOwnerKey(currentUserId ?? currentUserName);
  const userLabel = currentUserName.trim() || 'MTSS User';
  const classRoster = (studentsApi.studentsQuery.data?.rows ?? []) as StudentRosterItem[];
  
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('All');
  const [sortBy, setSortBy] = useState<LessonPlanSort>('Newest');
  
  // Create State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<'Topic' | 'Group'>('Topic');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  const [newPlanData, setNewPlanData] = useState({
    topic: '',
    grade: '4th',
    subject: 'Math',
    focusArea: '',
    duration: '30 min',
    frequency: 'Daily'
  });
  const [generatedPlan, setGeneratedPlan] = useState<AIInterventionPlan | null>(null);

  // View & Edit State
  const [selectedPlan, setSelectedPlan] = useState<LessonPlan | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPlan, setEditedPlan] = useState<LessonPlan | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pendingDeletePlan, setPendingDeletePlan] = useState<LessonPlan | null>(null);
  const [discardIntent, setDiscardIntent] = useState<'close' | 'cancel-edit' | null>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareRecipient, setShareRecipient] = useState<UserRole>(UserRole.TEACHER);
  const [shareNote, setShareNote] = useState('');
  const [actionNotice, setActionNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const hasHydratedRef = useRef(false);
  const lastPersistedRef = useRef("");

  useEffect(() => {
    const rows = lessonPlanCollection.query.data?.rows;
    if (!rows) return;
    hasHydratedRef.current = true;
    const serialized = JSON.stringify(rows);
    lastPersistedRef.current = serialized;
    setPlans(rows);
  }, [lessonPlanCollection.query.data]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    const serialized = JSON.stringify(plans);
    if (serialized === lastPersistedRef.current) return;
    const timeout = window.setTimeout(() => {
      lastPersistedRef.current = serialized;
      lessonPlanCollection.replaceMutation.mutate(plans);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [lessonPlanCollection.replaceMutation, plans]);

  useEffect(() => {
    if (!actionNotice) return;
    const timeout = window.setTimeout(() => setActionNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

  // Computed
  const hasActiveFilters = searchQuery.trim().length > 0 || subjectFilter !== 'All' || gradeFilter !== 'All' || viewFilter !== 'All';
  const filteredPlans = useMemo(() => {
    const visible = plans.filter((plan) => {
      const matchesSubject = subjectFilter === 'All' || plan.subject === subjectFilter;
      const matchesGrade = gradeFilter === 'All' || plan.grade === gradeFilter;
      const matchesSearch = matchesLessonPlanSearch(plan, searchQuery);
      if (!matchesSubject || !matchesGrade || !matchesSearch) return false;
      return isLessonPlanVisible(plan, ownerKey, viewFilter);
    });
    return sortLessonPlans(visible, sortBy);
  }, [gradeFilter, ownerKey, plans, searchQuery, sortBy, subjectFilter, viewFilter]);

  const isEditDirty = useMemo(
    () => (isEditMode ? !areLessonPlansEqual(selectedPlan, editedPlan) : false),
    [editedPlan, isEditMode, selectedPlan],
  );

  const toggleStudentSelection = (id: string) => {
      const newSet = new Set(selectedStudentIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedStudentIds(newSet);
  };

  const handleGenerate = async () => {
    if (!newPlanData.topic) return;
    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      let target = "Classroom";
      let context = "";
      
      if (generationMode === 'Group') {
          const selectedStudents = classRoster.filter(s => selectedStudentIds.has(s.id));
          target = `Small Group (${selectedStudents.length} students)`;
          
          // Build rich context from student data
          context = selectedStudents.map(s => 
              `- ${s.name}: ${s.tier}, Reading Level ${s.readingLevel}, GPA ${s.gpa}. Notes: ${s.alerts > 0 ? 'Has active alerts.' : 'No active alerts.'}`
          ).join('\n');
      }

      const plan = await generateStructuredIntervention(
        target,
        newPlanData.grade,
        Tier.TIER_1, // Default base
        `${newPlanData.subject}: ${newPlanData.topic} ${newPlanData.focusArea}`,
        context, // Pass the group context
        newPlanData.duration,
        newPlanData.frequency
      );
      setGeneratedPlan(plan);
    } catch (e) {
      console.error(e);
      setGenerationError(e instanceof Error ? e.message : 'Unable to generate a lesson plan right now.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedPlan) return;
    
    let groupNames: string[] | undefined;
    if (generationMode === 'Group') {
        groupNames = classRoster.filter(s => selectedStudentIds.has(s.id)).map(s => s.name);
    }

    const newLesson: LessonPlan = {
      ...generatedPlan,
      id: `lp-${Date.now()}`,
      subject: newPlanData.subject,
      grade: newPlanData.grade,
      createdDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
      author: userLabel,
      ownerId: userLabel,
      isShared: false, // Default private
      studentGroup: groupNames
    };
    setPlans([newLesson, ...plans]);
    setIsCreateModalOpen(false);
    setGeneratedPlan(null);
    setNewPlanData({ topic: '', grade: '4th', subject: 'Math', focusArea: '', duration: '30 min', frequency: 'Daily' });
    setSelectedStudentIds(new Set());
    setGenerationMode('Topic');
    setGenerationError(null);
    setActionNotice({ tone: 'success', text: 'Lesson plan saved to your library.' });
  };

  const toggleShare = (planId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const target = plans.find((plan) => plan.id === planId);
      if (!target || !isLessonPlanOwnedBy(target, ownerKey)) return;
      setPlans((prev) =>
        prev.map((plan) =>
          plan.id === planId
            ? { ...plan, isShared: !plan.isShared, updatedAt: new Date().toISOString() }
            : plan,
        ),
      );
      setActionNotice({
        tone: 'success',
        text: target.isShared ? 'Plan visibility set to private.' : 'Plan shared with your team.',
      });
  };

  const requestDeletePlan = (planId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const target = plans.find((plan) => plan.id === planId);
      if (!target || !isLessonPlanOwnedBy(target, ownerKey)) return;
      setPendingDeletePlan(target);
      setIsDeleteConfirmOpen(true);
  };

  const confirmDeletePlan = () => {
      if (!pendingDeletePlan) return;
      setPlans((prev) => prev.filter((plan) => plan.id !== pendingDeletePlan.id));
      if (selectedPlan?.id === pendingDeletePlan.id) {
        setSelectedPlan(null);
        setIsEditMode(false);
        setEditedPlan(null);
      }
      setActionNotice({ tone: 'success', text: 'Lesson plan deleted.' });
      setPendingDeletePlan(null);
      setIsDeleteConfirmOpen(false);
  };

  // Edit Handlers
  const startEditing = () => {
    if (selectedPlan) {
      setEditedPlan(JSON.parse(JSON.stringify(selectedPlan)));
      setIsEditMode(true);
    }
  };

  const requestCancelEditing = () => {
    if (isEditDirty) {
      setDiscardIntent('cancel-edit');
      setIsDiscardConfirmOpen(true);
      return;
    }
    setIsEditMode(false);
    setEditedPlan(null);
  };

  const saveEditedPlan = () => {
    if (!editedPlan) return;
    const updatedPlan = { ...editedPlan, updatedAt: new Date().toISOString() };
    setPlans(prev => prev.map(p => p.id === editedPlan.id ? updatedPlan : p));
    setSelectedPlan(updatedPlan);
    setIsEditMode(false);
    setEditedPlan(null);
    setActionNotice({ tone: 'success', text: 'Lesson plan changes saved.' });
  };

  const closeDetailModal = () => {
    setSelectedPlan(null);
    setIsEditMode(false);
    setEditedPlan(null);
    setDiscardIntent(null);
  };

  const requestCloseDetailModal = () => {
    if (isEditDirty) {
      setDiscardIntent('close');
      setIsDiscardConfirmOpen(true);
      return;
    }
    closeDetailModal();
  };

  const confirmDiscardChanges = () => {
    if (discardIntent === 'cancel-edit') {
      setIsEditMode(false);
      setEditedPlan(null);
    } else {
      closeDetailModal();
    }
    setDiscardIntent(null);
    setIsDiscardConfirmOpen(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSubjectFilter('All');
    setGradeFilter('All');
    setViewFilter('All');
    setSortBy('Newest');
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setGenerationError(null);
    setGeneratedPlan(null);
    setNewPlanData({ topic: '', grade: '4th', subject: 'Math', focusArea: '', duration: '30 min', frequency: 'Daily' });
    setSelectedStudentIds(new Set());
    setGenerationMode('Topic');
  };

  const openShareComposer = () => {
    if (!selectedPlan) return;
    if (!onComposeMessage) {
      setActionNotice({ tone: 'error', text: 'Messages is not available right now.' });
      return;
    }
    const recipientNameByRole: Record<UserRole, string> = {
      [UserRole.TEACHER]: 'Mr. Davis',
      [UserRole.PRINCIPAL]: 'Rosa Cortese',
      [UserRole.DISTRICT]: 'Dr. Aris Thorne',
      [UserRole.PARENT]: 'Family Contact',
    };
    const fallbackStudentName = selectedPlan.studentGroup?.[0] ?? selectedPlan.title;
    const defaultDraft = `Sharing "${selectedPlan.title}" (${selectedPlan.subject}, ${selectedPlan.grade}) for review and follow-up.`;
    const messagePayload: MessagesLaunchContext = {
      recipientRole: shareRecipient,
      recipientName: recipientNameByRole[shareRecipient],
      draft: shareNote.trim() || defaultDraft,
      context: {
        type: 'intervention',
        studentName: fallbackStudentName,
        interventionId: selectedPlan.id,
        interventionPlanName: selectedPlan.title,
      },
    };
    onComposeMessage(messagePayload);
    setIsShareModalOpen(false);
    setShareNote('');
    setActionNotice({ tone: 'success', text: 'Opened Messages with plan context.' });
  };

  const handlePrintPlan = () => {
    window.print();
    setActionNotice({ tone: 'info', text: 'Print dialog opened.' });
  };

  const getSubjectColor = (subject: string) => {
    switch(subject) {
        case 'Math': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'Reading': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Science': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'Behavior': return 'bg-rose-50 text-rose-700 border-rose-200';
        default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Render logic based on edit mode
  const currentPlan = isEditMode ? editedPlan : selectedPlan;

  return (
    <div className="h-full flex flex-col bg-slate-50/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
                <SidebarToggleButton
                    onClick={onMenuClick}
                    className="lg:hidden p-2 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-lg"
                />
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                    <BookCopy size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lesson Plan Library</h1>
                    <p className="text-slate-500 text-sm mt-1">Build, refine, and share lesson plans with your MTSS team.</p>
                </div>
            </div>
            <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all active:scale-95"
            >
                <Sparkles size={18} /> Create Plan
            </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3 flex-1 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search plans, objective, student, subject..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search lesson plans"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>

                <div className="relative">
                    <select 
                        value={gradeFilter}
                        onChange={(e) => setGradeFilter(e.target.value)}
                        className="appearance-none pl-4 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-white transition-colors"
                    >
                        <option value="All">All Grades</option>
                        {['K', '1st', '2nd', '3rd', '4th', '5th', '6th'].map(g => <option key={g} value={g}>{g} Grade</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <div className="relative">
                    <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as LessonPlanSort)}
                        className="appearance-none pl-8 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-white transition-colors"
                    >
                        <option value="Newest">Newest</option>
                        <option value="Recently Updated">Recently Updated</option>
                        <option value="Title A-Z">Title A-Z</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <div className="w-px h-8 bg-slate-200 mx-1 hidden md:block"></div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {['All', 'Math', 'Reading', 'Science', 'Social Studies'].map(subj => (
                        <button
                            key={subj}
                            onClick={() => setSubjectFilter(subj)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                                subjectFilter === subj 
                                ? 'bg-slate-800 text-white border-slate-800' 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {subj}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {VIEW_FILTERS.map((view) => (
                        <button
                            key={view}
                            onClick={() => setViewFilter(view)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewFilter === view ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {view}
                        </button>
                    ))}
                </div>
                {hasActiveFilters ? (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        <X size={14} />
                        Clear
                    </button>
                ) : null}
            </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="p-6 overflow-y-auto flex-1">
        {actionNotice ? (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              actionNotice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : actionNotice.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {actionNotice.text}
          </div>
        ) : null}

        {filteredPlans.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <BookCopy size={24} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {hasActiveFilters ? 'No plans match these filters.' : 'No lesson plans yet.'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {hasActiveFilters
                ? 'Adjust filters or clear them to find plans in your library.'
                : 'Generate your first plan to build your library.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Create Plan
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredPlans.map((plan) => {
              const isMine = isLessonPlanOwnedBy(plan, ownerKey);
              return (
                <article
                  key={plan.id}
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-lg"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex gap-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${getSubjectColor(plan.subject)}`}>
                        {plan.subject}
                      </span>
                      {plan.studentGroup ? (
                        <span className="flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
                          <Users size={10} /> Group ({plan.studentGroup.length})
                        </span>
                      ) : null}
                    </div>
                    {isMine ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={(event) => toggleShare(plan.id, event)}
                          className={`rounded p-1.5 transition-colors hover:bg-slate-100 ${plan.isShared ? 'text-emerald-600' : 'text-slate-400'}`}
                          title={plan.isShared ? "Set private" : "Share with team"}
                          aria-label={plan.isShared ? `Set ${plan.title} to private` : `Share ${plan.title} with team`}
                        >
                          {plan.isShared ? <Globe size={16} /> : <Lock size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => requestDeletePlan(plan.id, event)}
                          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Delete ${plan.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => { setSelectedPlan(plan); setIsEditMode(false); setEditedPlan(null); }}
                    className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-lg"
                    aria-label={`Open lesson plan ${plan.title}`}
                  >
                    <h3 className="mb-2 line-clamp-2 text-lg font-bold leading-tight text-slate-800 transition-colors hover:text-indigo-700">
                      {plan.title}
                    </h3>

                    <div className="mb-4 flex-1 line-clamp-3 text-sm text-slate-500">
                      <RichTextRenderer content={plan.lessonPlan.objective} />
                    </div>

                    {plan.studentGroup ? (
                      <div className="mb-4 flex flex-wrap gap-1">
                        {plan.studentGroup.slice(0, 3).map((name, index) => (
                          <span key={index} className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {name.split(' ')[0]}
                          </span>
                        ))}
                        {plan.studentGroup.length > 3 ? (
                          <span className="px-1 text-[10px] text-slate-400">+{plan.studentGroup.length - 3}</span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-auto flex items-center gap-4 border-t border-slate-100 pt-4 text-xs font-medium text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} /> {plan.duration}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User size={14} /> {isMine ? 'You' : plan.author}
                      </span>
                      <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                        {plan.grade}
                      </span>
                    </div>
                  </button>

                  <div className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-indigo-50/50 blur-2xl transition-colors group-hover:bg-indigo-100/50" />
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <DraggableModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title={
            <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-indigo-600" />
                <span className="font-bold text-lg text-slate-900">AI Lesson Generator</span>
            </div>
        }
        initialWidth={1000}
        initialHeight={800}
        footer={
            <div className="flex justify-end gap-3 w-full">
                <button onClick={closeCreateModal} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button 
                    onClick={handleSave} 
                    disabled={!generatedPlan}
                    className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={16} /> Save Plan
                </button>
            </div>
        }
      >
          <div className="p-6 space-y-6">
              {generationError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                      <div className="flex items-start gap-2">
                          <AlertCircle size={16} className="mt-0.5 shrink-0" />
                          <p>{generationError}</p>
                      </div>
                  </div>
              ) : null}
              {/* Generation Mode Switch */}
              <div className="bg-slate-100 p-1 rounded-xl flex w-fit mx-auto mb-6">
                  <button 
                    onClick={() => {
                      setGenerationMode('Topic');
                      setGenerationError(null);
                    }}
                    className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${generationMode === 'Topic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <BookOpen size={16} /> Standard Lesson
                  </button>
                  <button 
                    onClick={() => {
                      setGenerationMode('Group');
                      setGenerationError(null);
                    }}
                    className={`px-6 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${generationMode === 'Group' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                      <Users size={16} /> Targeted Group
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Inputs */}
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Subject</label>
                            <select 
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                value={newPlanData.subject}
                                onChange={(e) => setNewPlanData({...newPlanData, subject: e.target.value})}
                            >
                                <option>Math</option>
                                <option>Reading</option>
                                <option>Writing</option>
                                <option>Science</option>
                                <option>Social Studies</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Grade Level</label>
                            <select 
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                value={newPlanData.grade}
                                onChange={(e) => setNewPlanData({...newPlanData, grade: e.target.value})}
                            >
                                {['K', '1st', '2nd', '3rd', '4th', '5th', '6th'].map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Lesson Topic</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Fractions, Main Idea..."
                            className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={newPlanData.topic}
                            onChange={(e) => setNewPlanData({...newPlanData, topic: e.target.value})}
                          />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Duration</label>
                              <input 
                                type="text"
                                placeholder="e.g. 45 min"
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={newPlanData.duration}
                                onChange={(e) => setNewPlanData({...newPlanData, duration: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Frequency</label>
                              <select 
                                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                value={newPlanData.frequency}
                                onChange={(e) => setNewPlanData({...newPlanData, frequency: e.target.value})}
                              >
                                  <option>Daily</option>
                                  <option>Weekly</option>
                                  <option>2x/Week</option>
                                  <option>3x/Week</option>
                                  <option>Once</option>
                              </select>
                          </div>
                      </div>

                      {generationMode === 'Topic' ? (
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Specific Focus (Optional)</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Use visual aids..."
                                className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={newPlanData.focusArea}
                                onChange={(e) => setNewPlanData({...newPlanData, focusArea: e.target.value})}
                              />
                          </div>
                      ) : (
                          <div className="flex-1 flex flex-col h-64">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Select Students</label>
                              <div className="border border-slate-200 rounded-lg flex-1 overflow-y-auto p-2 bg-slate-50">
                                  {studentsApi.studentsQuery.isLoading ? (
                                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                                          <Loader2 size={14} className="mr-2 animate-spin" />
                                          Loading class roster...
                                      </div>
                                  ) : studentsApi.studentsQuery.error ? (
                                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                          Unable to load students for group selection.
                                      </div>
                                  ) : classRoster.length === 0 ? (
                                      <div className="py-6 text-center text-xs text-slate-500">No students available yet.</div>
                                  ) : (
                                      classRoster.map(student => (
                                          <button
                                            type="button"
                                            key={student.id}
                                            onClick={() => toggleStudentSelection(student.id)}
                                            className={`mb-1 flex w-full items-center justify-between rounded-lg border p-2 text-left transition-all ${selectedStudentIds.has(student.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:border-slate-200'}`}
                                          >
                                              <div>
                                                  <p className="text-sm font-bold text-slate-700">{student.name}</p>
                                                  <p className="text-[10px] text-slate-500">Tier {student.tier} ? {student.readingLevel}</p>
                                              </div>
                                              {selectedStudentIds.has(student.id) ? <Check size={16} className="text-indigo-600" /> : null}
                                          </button>
                                      ))
                                  )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 italic">
                                  Selected students' profiles (Tier, Reading Level, etc.) will be used to generate specific differentiation strategies.
                              </p>
                          </div>
                      )}

                      <button 
                        onClick={handleGenerate}
                        disabled={!newPlanData.topic || isGenerating || (generationMode === 'Group' && selectedStudentIds.size === 0)}
                        className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-semibold text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 shadow-sm mt-auto"
                      >
                          {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                          {isGenerating ? 'Generating Plan...' : 'Generate Plan'}
                      </button>
                  </div>

                  {/* Right Column: Preview / Edit */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 overflow-y-auto max-h-[600px] relative">
                      {!generatedPlan ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                              <Layout size={48} className="mb-4 opacity-20" />
                              <p className="text-sm font-medium">No plan generated yet.</p>
                              <p className="text-xs">Fill in the details and click Generate to see the AI magic.</p>
                          </div>
                      ) : (
                          <div className="space-y-5 animate-in fade-in">
                              {/* Header Editable */}
                              <div className="border-b border-slate-200 pb-3 space-y-3">
                                  <input 
                                    type="text" 
                                    className="w-full text-xl font-bold text-indigo-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition-colors"
                                    value={generatedPlan.title}
                                    onChange={(e) => setGeneratedPlan({...generatedPlan, title: e.target.value})}
                                  />
                                  <input 
                                    type="text" 
                                    className="w-full text-sm text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition-colors"
                                    value={generatedPlan.strategy}
                                    onChange={(e) => setGeneratedPlan({...generatedPlan, strategy: e.target.value})}
                                  />
                                  <div className="flex gap-4">
                                      <div className="flex-1">
                                          <label className="text-[10px] uppercase font-bold text-slate-400">Frequency</label>
                                          <input 
                                            type="text" 
                                            className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                                            value={generatedPlan.frequency}
                                            onChange={(e) => setGeneratedPlan({...generatedPlan, frequency: e.target.value})}
                                          />
                                      </div>
                                      <div className="flex-1">
                                          <label className="text-[10px] uppercase font-bold text-slate-400">Duration</label>
                                          <input 
                                            type="text" 
                                            className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                                            value={generatedPlan.duration}
                                            onChange={(e) => setGeneratedPlan({...generatedPlan, duration: e.target.value})}
                                          />
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="space-y-4">
                                  <div>
                                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Objective</h4>
                                      <textarea 
                                        rows={2}
                                        className="w-full text-sm text-slate-800 bg-white p-3 rounded border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                        value={generatedPlan.lessonPlan.objective}
                                        onChange={(e) => setGeneratedPlan({
                                            ...generatedPlan, 
                                            lessonPlan: { ...generatedPlan.lessonPlan, objective: e.target.value }
                                        })}
                                      />
                                  </div>

                                  <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Differentiation / Support</h4>
                                        <textarea 
                                            rows={3}
                                            className="w-full text-sm text-indigo-800 bg-indigo-50 p-3 rounded border border-indigo-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                            value={generatedPlan.lessonPlan.differentiation}
                                            onChange={(e) => setGeneratedPlan({
                                                ...generatedPlan, 
                                                lessonPlan: { ...generatedPlan.lessonPlan, differentiation: e.target.value }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Procedure</h4>
                                        <textarea 
                                            rows={6}
                                            className="w-full text-sm text-slate-700 bg-white p-3 rounded border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                            value={generatedPlan.lessonPlan.procedure.join('\n')}
                                            onChange={(e) => setGeneratedPlan({
                                                ...generatedPlan, 
                                                lessonPlan: { ...generatedPlan.lessonPlan, procedure: e.target.value.split('\n') }
                                            })}
                                            placeholder="Enter each step on a new line..."
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Assessment</h4>
                                        <textarea 
                                            rows={2}
                                            className="w-full text-sm text-slate-700 bg-white p-3 rounded border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                            value={generatedPlan.lessonPlan.assessment}
                                            onChange={(e) => setGeneratedPlan({
                                                ...generatedPlan, 
                                                lessonPlan: { ...generatedPlan.lessonPlan, assessment: e.target.value }
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Materials</h4>
                                        <textarea 
                                            rows={2}
                                            className="w-full text-sm text-slate-700 bg-white p-3 rounded border border-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                            value={generatedPlan.lessonPlan.materials.join('\n')}
                                            onChange={(e) => setGeneratedPlan({
                                                ...generatedPlan, 
                                                lessonPlan: { ...generatedPlan.lessonPlan, materials: e.target.value.split('\n') }
                                            })}
                                            placeholder="List materials (one per line)..."
                                        />
                                    </div>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </DraggableModal>

      <DraggableModal
        isOpen={isDeleteConfirmOpen && !!pendingDeletePlan}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setPendingDeletePlan(null);
        }}
        title={<span className="text-base font-bold text-slate-900">Delete lesson plan?</span>}
        initialWidth={460}
        initialHeight={280}
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                setPendingDeletePlan(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeletePlan}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Delete Plan
            </button>
          </div>
        }
      >
        <div className="p-6">
          <p className="text-sm text-slate-600">
            This removes
            <span className="mx-1 font-semibold text-slate-900">{pendingDeletePlan?.title ?? 'this plan'}</span>
            from your library.
          </p>
        </div>
      </DraggableModal>

      <DraggableModal
        isOpen={isDiscardConfirmOpen}
        onClose={() => {
          setIsDiscardConfirmOpen(false);
          setDiscardIntent(null);
        }}
        title={<span className="text-base font-bold text-slate-900">Discard unsaved changes?</span>}
        initialWidth={460}
        initialHeight={280}
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsDiscardConfirmOpen(false);
                setDiscardIntent(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={confirmDiscardChanges}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Discard Changes
            </button>
          </div>
        }
      >
        <div className="p-6">
          <p className="text-sm text-slate-600">
            Your edits have not been saved and will be lost.
          </p>
        </div>
      </DraggableModal>

      <DraggableModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareNote('');
        }}
        title={<span className="text-base font-bold text-slate-900">Share plan in Messages</span>}
        initialWidth={520}
        initialHeight={360}
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsShareModalOpen(false);
                setShareNote('');
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={openShareComposer}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Open Messages
            </button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Send To</label>
            <select
              value={shareRecipient}
              onChange={(event) => setShareRecipient(event.target.value as UserRole)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={UserRole.TEACHER}>Teacher</option>
              <option value={UserRole.PRINCIPAL}>Principal</option>
              <option value={UserRole.DISTRICT}>District Admin</option>
              <option value={UserRole.PARENT}>Family Contact</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Message Note (Optional)</label>
            <textarea
              value={shareNote}
              onChange={(event) => setShareNote(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Add context for this plan before opening Messages..."
            />
          </div>
        </div>
      </DraggableModal>

      {/* View Modal with Edit Support */}
      {selectedPlan && currentPlan && (
        <DraggableModal
            isOpen={!!selectedPlan}
            onClose={requestCloseDetailModal}
            title={
                <div className="flex items-center gap-2">
                    <Layout size={20} className="text-indigo-600" />
                    <span className="font-bold text-slate-800 text-lg">{isEditMode ? 'Editing Plan' : 'Lesson Plan Details'}</span>
                </div>
            }
            initialWidth={900}
            initialHeight={800}
            footer={
                <div className="flex justify-between w-full">
                    {/* Left Actions */}
                    <div className="flex gap-2">
                      {isEditMode ? (
                         <button onClick={requestCancelEditing} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                      ) : (
                         isLessonPlanOwnedBy(selectedPlan, ownerKey) && (
                            <button 
                                onClick={(e) => requestDeletePlan(selectedPlan.id, e)} 
                                className="text-rose-500 hover:text-rose-700 p-2 rounded hover:bg-rose-50 transition-colors" 
                                title="Delete Plan"
                            >
                                <Trash2 size={18} />
                            </button>
                         )
                      )}
                    </div>

                    {/* Right Actions */}
                    <div className="flex gap-3 ml-auto">
                        {isEditMode ? (
                            <button 
                                onClick={saveEditedPlan}
                                disabled={!isEditDirty}
                                className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save size={16} /> Save Changes
                            </button>
                        ) : (
                            <>
                                {isLessonPlanOwnedBy(selectedPlan, ownerKey) && (
                                    <button 
                                        onClick={startEditing}
                                        className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-2"
                                    >
                                        <Edit3 size={16} /> Edit
                                    </button>
                                )}
                                <button
                                  onClick={handlePrintPlan}
                                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <Printer size={16} /> Print
                                </button>
                                <button
                                  onClick={() => {
                                    setShareRecipient(currentUserRole === UserRole.TEACHER ? UserRole.PRINCIPAL : UserRole.TEACHER);
                                    setShareNote('');
                                    setIsShareModalOpen(true);
                                  }}
                                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2"
                                >
                                    <Share2 size={16} /> Share
                                </button>
                            </>
                        )}
                    </div>
                </div>
            }
        >
            <div className="p-8 space-y-8 bg-white h-full overflow-y-auto">
                <div className="border-b border-slate-100 pb-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-2">
                            {isEditMode ? (
                                <select 
                                    className="text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={currentPlan.subject}
                                    onChange={(e) => setEditedPlan({...currentPlan, subject: e.target.value})}
                                >
                                    <option>Math</option>
                                    <option>Reading</option>
                                    <option>Science</option>
                                    <option>Social Studies</option>
                                    <option>Writing</option>
                                    <option>Behavior</option>
                                </select>
                            ) : (
                                <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${getSubjectColor(currentPlan.subject)}`}>
                                    {currentPlan.subject}
                                </span>
                            )}
                            
                            {currentPlan.isShared && !isEditMode && (
                                <span className="text-xs font-bold px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                                    <Globe size={12} /> Shared
                                </span>
                            )}
                        </div>
                        <div className="text-right text-xs text-slate-400">
                            <p>Created: {new Date(currentPlan.createdDate).toLocaleDateString()}</p>
                            {currentPlan.updatedAt ? <p>Updated: {new Date(currentPlan.updatedAt).toLocaleDateString()}</p> : null}
                            <p>Author: {currentPlan.author}</p>
                        </div>
                    </div>
                    
                    {isEditMode ? (
                        <div className="space-y-3 mb-4">
                            <input 
                                type="text"
                                className="w-full text-3xl font-bold text-slate-900 border-b border-slate-200 focus:border-indigo-500 outline-none pb-1"
                                value={currentPlan.title}
                                onChange={(e) => setEditedPlan({...currentPlan, title: e.target.value})}
                            />
                            <textarea 
                                className="w-full text-lg text-slate-600 font-medium border rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                rows={3}
                                value={currentPlan.lessonPlan.objective}
                                onChange={(e) => setEditedPlan({
                                    ...currentPlan, 
                                    lessonPlan: { ...currentPlan.lessonPlan, objective: e.target.value }
                                })}
                            />
                        </div>
                    ) : (
                        <>
                            <h2 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">{currentPlan.title}</h2>
                            <div className="text-lg text-slate-600 font-medium">
                                <RichTextRenderer content={currentPlan.lessonPlan.objective} />
                            </div>
                        </>
                    )}
                    
                    {currentPlan.studentGroup && (
                        <div className="mt-4 p-3 bg-violet-50 border border-violet-100 rounded-lg">
                            <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-2">Targeted Group</p>
                            <div className="flex flex-wrap gap-2">
                                {currentPlan.studentGroup.map((name, i) => (
                                    <span key={i} className="text-xs bg-white text-violet-800 px-2 py-1 rounded border border-violet-200 font-medium">
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Sidebar (Logistics & Materials) */}
                    <div className="col-span-1 space-y-6">
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Clock size={14} /> Logistics
                            </h4>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <span className="block font-bold text-slate-700 mb-1">Grade Level</span>
                                    {isEditMode ? (
                                        <input 
                                            type="text" 
                                            className="w-full p-1.5 border rounded bg-white"
                                            value={currentPlan.grade}
                                            onChange={(e) => setEditedPlan({...currentPlan, grade: e.target.value})}
                                        />
                                    ) : (
                                        <span className="text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">{currentPlan.grade}</span>
                                    )}
                                </div>
                                <div>
                                    <span className="block font-bold text-slate-700 mb-1">Duration</span>
                                    {isEditMode ? (
                                        <input 
                                            type="text" 
                                            className="w-full p-1.5 border rounded bg-white"
                                            value={currentPlan.duration}
                                            onChange={(e) => setEditedPlan({...currentPlan, duration: e.target.value})}
                                        />
                                    ) : (
                                        <span className="text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">{currentPlan.duration}</span>
                                    )}
                                </div>
                                <div>
                                    <span className="block font-bold text-slate-700 mb-1">Frequency</span>
                                    {isEditMode ? (
                                        <input 
                                            type="text" 
                                            className="w-full p-1.5 border rounded bg-white"
                                            value={currentPlan.frequency}
                                            onChange={(e) => setEditedPlan({...currentPlan, frequency: e.target.value})}
                                        />
                                    ) : (
                                        <span className="text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">{currentPlan.frequency}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <BookOpen size={14} /> Materials
                            </h4>
                            {isEditMode ? (
                                <textarea 
                                    className="w-full p-2 text-sm rounded border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    rows={5}
                                    value={currentPlan.lessonPlan.materials.join('\n')}
                                    onChange={(e) => setEditedPlan({
                                        ...currentPlan,
                                        lessonPlan: { ...currentPlan.lessonPlan, materials: e.target.value.split('\n') }
                                    })}
                                    placeholder="One item per line"
                                />
                            ) : (
                                <ul className="space-y-2">
                                    {currentPlan.lessonPlan.materials.map((m, i) => (
                                        <li key={i} className="flex gap-2 text-sm text-indigo-900">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                            <span className="leading-relaxed"><RichTextRenderer content={m} /></span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="col-span-1 lg:col-span-2 space-y-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                                <ListOrdered size={20} className="text-indigo-600" /> Instructional Procedure
                            </h3>
                            {isEditMode ? (
                                <textarea 
                                    className="w-full p-3 text-sm text-slate-700 bg-white border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                                    rows={10}
                                    value={currentPlan.lessonPlan.procedure.join('\n')}
                                    onChange={(e) => setEditedPlan({
                                        ...currentPlan,
                                        lessonPlan: { ...currentPlan.lessonPlan, procedure: e.target.value.split('\n') }
                                    })}
                                    placeholder="Step 1... (New line for next step)"
                                />
                            ) : (
                                <div className="space-y-4">
                                    {currentPlan.lessonPlan.procedure.map((step, i) => (
                                        <div key={i} className="flex gap-4 group">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center shrink-0 border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors shadow-sm">
                                                {i + 1}
                                            </div>
                                            <div className="pt-1 text-slate-700 leading-relaxed w-full">
                                                <RichTextRenderer content={step} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5">
                                <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Check size={16} /> Assessment
                                </h3>
                                {isEditMode ? (
                                    <textarea 
                                        className="w-full p-2 text-sm rounded border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                                        rows={4}
                                        value={currentPlan.lessonPlan.assessment}
                                        onChange={(e) => setEditedPlan({
                                            ...currentPlan,
                                            lessonPlan: { ...currentPlan.lessonPlan, assessment: e.target.value }
                                        })}
                                    />
                                ) : (
                                    <div className="text-emerald-900 text-sm leading-relaxed">
                                        <RichTextRenderer content={currentPlan.lessonPlan.assessment} />
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-5">
                                <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <Sparkles size={16} /> Differentiation
                                </h3>
                                {isEditMode ? (
                                    <textarea 
                                        className="w-full p-2 text-sm rounded border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none"
                                        rows={4}
                                        value={currentPlan.lessonPlan.differentiation}
                                        onChange={(e) => setEditedPlan({
                                            ...currentPlan,
                                            lessonPlan: { ...currentPlan.lessonPlan, differentiation: e.target.value }
                                        })}
                                    />
                                ) : (
                                    <div className="text-amber-900 text-sm leading-relaxed">
                                        <RichTextRenderer content={currentPlan.lessonPlan.differentiation} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableModal>
      )}

    </div>
  );
};
