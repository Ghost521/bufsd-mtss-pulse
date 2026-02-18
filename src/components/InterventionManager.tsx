
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  ArrowUpDown, 
  Layers, 
  Zap, 
  AlertCircle, 
  TrendingUp,
  LayoutList,
  LayoutGrid,
  Plus,
  Save,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Filter,
  X,
  Share2,
  Bot,
  Loader2,
  Send
} from 'lucide-react';
import { Tier } from '../types';
import { DraggableModal } from './DraggableModal';
import type { AIInterventionPlan } from '../services/geminiService';
import { generateStructuredIntervention } from '../services/geminiService';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { SidebarToggleButton } from './SidebarToggleButton';

const TEACHERS = ["Mr. Davis", "Mrs. Johnson", "Mr. Thompson", "Ms. Lee", "Mrs. Garcia"];

interface InterventionRecord {
  id: string;
  studentName: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacher: string;
  tier: Tier;
  planName: string;
  startDate: string;
  durationWeeks: number;
  progress: number; // 0-100
  attendance: number; // 0-100
  status: 'On Track' | 'At Risk' | 'Critical';
  avatarSeed: string;
  lessonPlan?: AIInterventionPlan; // Optional robust plan
}

interface ReferralRecord {
  id: string;
  studentName: string;
  grade?: string;
  type: string;
  urgency: string;
  status?: string;
  createdAt?: string;
}

// --- Grouping & Sorting Types ---
type GroupBy = 'None' | 'Teacher' | 'Grade' | 'Tier' | 'Status';
type SortBy = 'Last Name' | 'First Name' | 'Progress' | 'Attendance' | 'Duration' | 'Grade' | 'Teacher' | 'Tier' | 'Plan Name';

interface InterventionManagerProps {
  onStudentClick: (name: string) => void;
  onMenuClick: () => void;
  highlightedReferralId?: string | null;
  onReferralHighlightConsumed?: () => void;
}

export const InterventionManager: React.FC<InterventionManagerProps> = ({
  onStudentClick,
  onMenuClick,
  highlightedReferralId,
  onReferralHighlightConsumed,
}) => {
  const interventionsCollection = useTenantCollection<InterventionRecord>('interventions');
  const referralsCollection = useTenantCollection<ReferralRecord>('referrals');
  const [records, setRecords] = useState<InterventionRecord[]>([]);
  
  // View Controls
  const [groupBy, setGroupBy] = useState<GroupBy>('None');
  const [sortBy, setSortBy] = useState<SortBy>('Last Name');
  const [sortDesc, setSortDesc] = useState(false);
  const [layout, setLayout] = useState<'List' | 'Cards'>('List');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All'); // 'All', 'Active', 'Completed'
  const [teacherFilter, setTeacherFilter] = useState<string>('All');

  // Expansion State
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Modal State
  const [isNewPlanOpen, setIsNewPlanOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedPlanForShare, setSelectedPlanForShare] = useState<InterventionRecord | null>(null);
  
  // New Plan Data & AI State
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatedPlanDetails, setGeneratedPlanDetails] = useState<AIInterventionPlan | null>(null);
  const [newPlanData, setNewPlanData] = useState({
    studentName: '',
    planName: '',
    tier: Tier.TIER_2,
    teacher: 'Mr. Davis',
    focusArea: 'Reading Comprehension'
  });

  // Monitoring Agent State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const hasHydratedRef = useRef(false);
  const lastPersistedRef = useRef("");

  useEffect(() => {
    const rows = interventionsCollection.query.data?.rows;
    if (!rows) return;
    hasHydratedRef.current = true;
    const serialized = JSON.stringify(rows);
    lastPersistedRef.current = serialized;
    setRecords(rows);
  }, [interventionsCollection.query.data]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    const serialized = JSON.stringify(records);
    if (serialized === lastPersistedRef.current) return;
    const timeout = window.setTimeout(() => {
      lastPersistedRef.current = serialized;
      interventionsCollection.replaceMutation.mutate(records);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [interventionsCollection.replaceMutation, records]);

  const referrals = useMemo(
    () => referralsCollection.query.data?.rows ?? [],
    [referralsCollection.query.data?.rows],
  );

  const recentReferrals = useMemo(() => {
    const toTime = (value?: string) => {
      if (!value) return 0;
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    return [...referrals]
      .sort((left, right) => toTime(right.createdAt) - toTime(left.createdAt))
      .slice(0, 6);
  }, [referrals]);

  useEffect(() => {
    if (!highlightedReferralId || !onReferralHighlightConsumed) return;
    const timeout = window.setTimeout(() => onReferralHighlightConsumed(), 8000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [highlightedReferralId, onReferralHighlightConsumed]);

  // Filter & Sort Logic
  const processedData = useMemo<Record<string, InterventionRecord[]>>(() => {
    let data = [...records];

    // 1. Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(r => 
        r.studentName.toLowerCase().includes(q) || 
        r.planName.toLowerCase().includes(q) ||
        r.teacher.toLowerCase().includes(q)
      );
    }

    if (tierFilter !== 'All') {
      data = data.filter(r => r.tier === tierFilter);
    }

    if (teacherFilter !== 'All') {
      data = data.filter(r => r.teacher === teacherFilter);
    }

    if (statusFilter !== 'All') {
      if (statusFilter === 'Active') {
        data = data.filter(r => r.progress < 100);
      } else if (statusFilter === 'Completed') {
        data = data.filter(r => r.progress === 100);
      }
    }

    // 2. Sort (Helper Function)
    const sortFn = (a: InterventionRecord, b: InterventionRecord) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortBy) {
        case 'Last Name': valA = a.lastName; valB = b.lastName; break;
        case 'First Name': valA = a.firstName; valB = b.firstName; break;
        case 'Progress': valA = a.progress; valB = b.progress; break;
        case 'Attendance': valA = a.attendance; valB = b.attendance; break;
        case 'Duration': valA = a.durationWeeks; valB = b.durationWeeks; break;
        case 'Grade': valA = a.grade; valB = b.grade; break;
        case 'Teacher': valA = a.teacher; valB = b.teacher; break;
        case 'Tier': valA = a.tier; valB = b.tier; break;
        case 'Plan Name': valA = a.planName; valB = b.planName; break;
      }

      if (valA < valB) return sortDesc ? 1 : -1;
      if (valA > valB) return sortDesc ? -1 : 1;
      return 0;
    };

    data.sort(sortFn);

    // 3. Group
    if (groupBy === 'None') {
      return { 'All Plans': data };
    }

    const groups: Record<string, InterventionRecord[]> = {};
    data.forEach(item => {
      let key = '';
      switch (groupBy) {
        case 'Teacher': key = item.teacher; break;
        case 'Grade': key = item.grade; break;
        case 'Tier': key = item.tier; break;
        case 'Status': key = item.status; break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    // Sort Group Keys logic
    return Object.keys(groups).sort().reduce((acc, key) => {
        acc[key] = groups[key];
        return acc;
    }, {} as Record<string, InterventionRecord[]>);

  }, [records, searchQuery, groupBy, sortBy, sortDesc, tierFilter, statusFilter, teacherFilter]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const handleHeaderSort = (column: SortBy) => {
    if (sortBy === column) {
        setSortDesc(!sortDesc);
    } else {
        setSortBy(column);
        setSortDesc(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!newPlanData.studentName) return;
    setIsGeneratingPlan(true);
    try {
      const plan = await generateStructuredIntervention(
        newPlanData.studentName,
        '4th', // Simplified for demo
        newPlanData.tier,
        newPlanData.focusArea
      );
      setGeneratedPlanDetails(plan);
      setNewPlanData(prev => ({ ...prev, planName: plan.title }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleSaveNewPlan = () => {
    const [first, ...rest] = newPlanData.studentName.split(' ');
    const newRecord: InterventionRecord = {
      id: `new-${Date.now()}`,
      studentName: newPlanData.studentName || 'New Student',
      firstName: first || 'New',
      lastName: rest.join(' ') || 'Student',
      grade: '4th', // Default
      teacher: newPlanData.teacher,
      tier: newPlanData.tier,
      planName: newPlanData.planName,
      startDate: new Date().toISOString().split('T')[0],
      durationWeeks: 6,
      progress: 0,
      attendance: 100,
      status: 'On Track',
      avatarSeed: (newPlanData.studentName || 'new').replace(/ /g, ''),
      lessonPlan: generatedPlanDetails || undefined
    };

    setRecords([newRecord, ...records]);
    setIsNewPlanOpen(false);
    // Reset
    setNewPlanData({ studentName: '', planName: '', tier: Tier.TIER_2, teacher: 'Mr. Davis', focusArea: 'Reading' });
    setGeneratedPlanDetails(null);
  };

  const handleScanClass = () => {
    setIsScanning(true);
    // Simulate AI Agent Process
    setTimeout(() => {
        setIsScanning(false);
        setScanResult("Found 3 students with declining attendance and reading scores. Recommended actions added to queue.");
        setTimeout(() => setScanResult(null), 4000);
    }, 2000);
  };

  const handleSharePlan = (plan: InterventionRecord) => {
      setSelectedPlanForShare(plan);
      setIsShareModalOpen(true);
  };

  const handleConfirmShare = () => {
      setIsShareModalOpen(false);
      setSelectedPlanForShare(null);
      alert("Lesson plan shared successfully with selected recipients.");
  };

  const clearFilters = () => {
    setTierFilter('All');
    setStatusFilter('All');
    setTeacherFilter('All');
    setSearchQuery('');
  };

  const formatReferralTime = (value?: string) => {
    if (!value) return 'Unknown time';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown time';
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // --- Render Helpers ---

  const getTierBadge = (tier: Tier) => {
    const colors = {
      [Tier.TIER_1]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      [Tier.TIER_2]: 'bg-amber-50 text-amber-700 border-amber-200',
      [Tier.TIER_3]: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colors[tier]}`}>
        {tier}
      </span>
    );
  };

  const getProgressBar = (val: number) => {
    let color = 'bg-emerald-500';
    if (val < 50) color = 'bg-rose-500';
    else if (val < 75) color = 'bg-amber-500';
    
    return (
      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
      </div>
    );
  };

  const renderSortIcon = (column: SortBy) => {
      if (sortBy !== column) return <ArrowUpDown size={12} className="opacity-30" />;
      return sortDesc ? <ArrowDown size={12} className="text-indigo-600" /> : <ArrowUp size={12} className="text-indigo-600" />;
  };

  const stats = {
    total: records.length,
    critical: records.filter(r => r.status === 'Critical').length,
    tier3: records.filter(r => r.tier === Tier.TIER_3).length,
    avgProgress: records.length > 0
      ? Math.round(records.reduce((acc, r) => acc + r.progress, 0) / records.length)
      : 0
  };

  const activeFilterCount = [
    tierFilter !== 'All',
    statusFilter !== 'All',
    teacherFilter !== 'All'
  ].filter(Boolean).length;

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50/50">
      
      {/* Share Modal */}
      <DraggableModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Share Lesson Plan"
        initialWidth={500}
        initialHeight={400}
        footer={
            <div className="flex justify-end gap-3 w-full">
                <button onClick={() => setIsShareModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg">Cancel</button>
                <button onClick={handleConfirmShare} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                    <Send size={16} /> Send
                </button>
            </div>
        }
      >
          <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="font-bold text-slate-800 text-sm">{selectedPlanForShare?.planName}</h4>
                  <p className="text-xs text-slate-500">For: {selectedPlanForShare?.studentName}</p>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Recipients</label>
                  <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" defaultChecked />
                          <div className="flex-1">
                              <span className="text-sm font-bold text-slate-700 block">Parents / Guardians</span>
                              <span className="text-xs text-slate-400">Via Parent Portal & Email</span>
                          </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" />
                          <div className="flex-1">
                              <span className="text-sm font-bold text-slate-700 block">Principal</span>
                              <span className="text-xs text-slate-400">For approval/review</span>
                          </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" defaultChecked />
                          <div className="flex-1">
                              <span className="text-sm font-bold text-slate-700 block">Support Staff</span>
                              <span className="text-xs text-slate-400">Intervention specialists</span>
                          </div>
                      </label>
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Message (Optional)</label>
                  <textarea className="w-full p-2.5 border border-slate-200 rounded-lg text-sm h-20 resize-none" placeholder="Add a note..." />
              </div>
          </div>
      </DraggableModal>

      {/* New Plan Modal */}
      <DraggableModal
        isOpen={isNewPlanOpen}
        onClose={() => setIsNewPlanOpen(false)}
        title="Create Intervention Lesson Plan"
        initialWidth={700}
        initialHeight={700}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button onClick={() => setIsNewPlanOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button 
                onClick={handleSaveNewPlan} 
                disabled={!generatedPlanDetails}
                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} /> Save Plan
            </button>
          </div>
        }
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Student Name</label>
                <input 
                type="text" 
                value={newPlanData.studentName}
                onChange={(e) => setNewPlanData({...newPlanData, studentName: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Jordan Lee"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Focus Area</label>
                <input 
                type="text" 
                value={newPlanData.focusArea}
                onChange={(e) => setNewPlanData({...newPlanData, focusArea: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Reading Comprehension"
                />
            </div>
          </div>
          
          <div className="flex gap-4">
             <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tier Level</label>
                <div className="flex gap-2">
                {[Tier.TIER_1, Tier.TIER_2, Tier.TIER_3].map(t => (
                    <button
                    key={t}
                    onClick={() => setNewPlanData({...newPlanData, tier: t})}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        newPlanData.tier === t 
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700 ring-1 ring-indigo-600' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    >
                    {t}
                    </button>
                ))}
                </div>
             </div>
             <div className="flex items-end">
                 <button 
                    onClick={handleGeneratePlan}
                    disabled={isGeneratingPlan || !newPlanData.studentName}
                    className="h-[38px] px-4 bg-indigo-100 text-indigo-700 font-bold text-sm rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                 >
                     {isGeneratingPlan ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                     Generate Lesson Plan
                 </button>
             </div>
          </div>

          {generatedPlanDetails && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                      <div>
                          <h3 className="font-bold text-indigo-900 text-lg">{generatedPlanDetails.title}</h3>
                          <p className="text-sm text-slate-600">{generatedPlanDetails.strategy}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                          <p>Freq: {generatedPlanDetails.frequency}</p>
                          <p>Duration: {generatedPlanDetails.duration}</p>
                      </div>
                  </div>
                  
                  <div className="space-y-3">
                      <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase">Objective</h4>
                          <p className="text-sm text-slate-800">{generatedPlanDetails.lessonPlan.objective}</p>
                      </div>
                      <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase">Procedure</h4>
                          <ul className="list-disc pl-4 text-sm text-slate-700 space-y-1">
                              {generatedPlanDetails.lessonPlan.procedure.map((step, i) => (
                                  <li key={i}>{step}</li>
                              ))}
                          </ul>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase">Materials</h4>
                              <p className="text-xs text-slate-600">{generatedPlanDetails.lessonPlan.materials.join(', ')}</p>
                          </div>
                          <div>
                              <h4 className="text-xs font-bold text-slate-500 uppercase">Assessment</h4>
                              <p className="text-xs text-slate-600">{generatedPlanDetails.lessonPlan.assessment}</p>
                          </div>
                      </div>
                  </div>
              </div>
          )}
        </div>
      </DraggableModal>

      {/* Header & Stats */}
      <div className="bg-white border-b border-slate-200 p-6 pb-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
                <SidebarToggleButton
                    onClick={onMenuClick}
                    className="lg:hidden p-2 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-lg"
                />
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Intervention Plans</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage and track support plans across the school.</p>
                </div>
            </div>
            
            <div className="flex gap-3">
                <button 
                    onClick={handleScanClass}
                    disabled={isScanning}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-70"
                >
                    {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                    Scan Class for Needs
                </button>
                <button 
                onClick={() => setIsNewPlanOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-all active:scale-95"
                >
                    <Plus size={18} /> New Plan
                </button>
            </div>
        </div>

        {scanResult && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 text-indigo-800 text-sm animate-in fade-in slide-in-from-top-2">
                <Bot size={20} className="text-indigo-600" />
                <span className="font-bold">Agent Report:</span> {scanResult}
            </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Plans</p>
                    <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Zap size={20} /></div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical Status</p>
                    <p className="text-2xl font-bold text-rose-600">{stats.critical}</p>
                </div>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertCircle size={20} /></div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tier 3 Load</p>
                    <p className="text-2xl font-bold text-slate-800">{stats.tier3}</p>
                </div>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Layers size={20} /></div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Progress</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.avgProgress}%</p>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={20} /></div>
            </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold text-slate-900">Referral Queue</h2>
                    <p className="text-xs text-slate-500">Most recent referrals awaiting review.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {referrals.length} total
                </span>
            </div>

            {referralsCollection.query.isLoading ? (
                <div className="py-4 text-sm text-slate-500">Loading referral queue...</div>
            ) : recentReferrals.length === 0 ? (
                <div className="py-4 text-sm text-slate-500">No referrals in the queue yet.</div>
            ) : (
                <div className="space-y-2">
                    {recentReferrals.map((referral) => {
                        const isHighlighted = referral.id === highlightedReferralId;
                        return (
                            <div
                                key={referral.id}
                                className={`rounded-lg border p-3 transition-colors ${
                                    isHighlighted
                                        ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-300'
                                        : 'border-slate-200 bg-slate-50'
                                }`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">
                                            {referral.studentName}
                                            <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                                {referral.id}
                                            </span>
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Grade {referral.grade ?? 'N/A'} | {referral.type} | {referral.urgency}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500">{formatReferralTime(referral.createdAt)}</p>
                                            <p className="text-xs font-semibold text-amber-700">{referral.status ?? 'Pending Review'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onStudentClick(referral.studentName)}
                                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                        >
                                            Open Student
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col gap-4 pb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Search & Filter Toggle */}
                <div className="flex gap-3 flex-1 w-full">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search students, teachers, or plans..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-sm font-medium ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                        <Filter size={18} />
                        {activeFilterCount > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Group By */}
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    <div className="relative shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Layers size={14} /></span>
                        <select 
                            value={groupBy} 
                            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                            className="pl-8 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none cursor-pointer hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="None">No Grouping</option>
                            <option value="Teacher">Group by Teacher</option>
                            <option value="Grade">Group by Grade</option>
                            <option value="Tier">Group by Tier</option>
                            <option value="Status">Group by Status</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Sort By */}
                    <div className="relative shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><ArrowUpDown size={14} /></span>
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value as SortBy)}
                            className="pl-8 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none cursor-pointer hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option>Last Name</option>
                            <option>First Name</option>
                            <option>Progress</option>
                            <option>Attendance</option>
                            <option>Duration</option>
                            <option>Grade</option>
                            <option>Teacher</option>
                            <option>Tier</option>
                            <option>Plan Name</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    <button 
                        onClick={() => setSortDesc(!sortDesc)}
                        className={`p-2.5 rounded-xl border transition-all ${sortDesc ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}
                        title={sortDesc ? "Descending" : "Ascending"}
                    >
                        <ArrowUpDown size={16} className={sortDesc ? "rotate-180 transition-transform" : "transition-transform"} />
                    </button>

                    <div className="w-px h-8 bg-slate-200 mx-1"></div>

                    <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                        <button onClick={() => setLayout('List')} className={`p-1.5 rounded-lg transition-all ${layout === 'List' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                            <LayoutList size={18} />
                        </button>
                        <button onClick={() => setLayout('Cards')} className={`p-1.5 rounded-lg transition-all ${layout === 'Cards' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Collapsible Filter Row */}
            {showFilters && (
                <div className="flex flex-wrap gap-4 pt-2 animate-in slide-in-from-top-2 border-t border-slate-100">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tier Level</label>
                        <select 
                            value={tierFilter}
                            onChange={(e) => setTierFilter(e.target.value)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                        >
                            <option value="All">All Tiers</option>
                            <option value={Tier.TIER_1}>{Tier.TIER_1}</option>
                            <option value={Tier.TIER_2}>{Tier.TIER_2}</option>
                            <option value={Tier.TIER_3}>{Tier.TIER_3}</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Intervention Status</label>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teacher</label>
                        <select 
                            value={teacherFilter}
                            onChange={(e) => setTeacherFilter(e.target.value)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                        >
                            <option value="All">All Teachers</option>
                            {TEACHERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {(activeFilterCount > 0 || searchQuery) && (
                        <div className="flex flex-col justify-end">
                            <button 
                                onClick={clearFilters}
                                className="p-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <X size={14} /> Clear All
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-7xl mx-auto">
            
            {/* Sticky Header for List View */}
            {layout === 'List' && (
                <div className="sticky top-0 z-10 flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200 rounded-t-xl text-xs font-bold text-slate-500 uppercase tracking-wider shadow-sm">
                    <div 
                        className="flex items-center gap-2 w-1/4 min-w-[200px] cursor-pointer hover:text-indigo-600"
                        onClick={() => handleHeaderSort('Last Name')}
                    >
                        Student Name {renderSortIcon('Last Name')}
                    </div>
                    <div 
                        className="w-1/6 hidden md:flex items-center gap-2 cursor-pointer hover:text-indigo-600"
                        onClick={() => handleHeaderSort('Teacher')}
                    >
                        Teacher / Grade {renderSortIcon('Teacher')}
                    </div>
                    <div 
                        className="w-1/6 hidden sm:flex items-center gap-2 cursor-pointer hover:text-indigo-600"
                        onClick={() => handleHeaderSort('Tier')}
                    >
                        Tier {renderSortIcon('Tier')}
                    </div>
                    <div 
                        className="w-1/4 flex items-center gap-2 cursor-pointer hover:text-indigo-600"
                        onClick={() => handleHeaderSort('Progress')}
                    >
                        Plan Progress {renderSortIcon('Progress')}
                    </div>
                    <div className="w-1/12 text-right">Actions</div>
                </div>
            )}

            {Object.keys(processedData).length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <Filter size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No interventions match your filters.</p>
                    <button onClick={clearFilters} className="text-indigo-600 font-bold text-sm hover:underline mt-2">Clear Filters</button>
                </div>
            ) : (
                Object.entries(processedData).map(([groupName, groupItems]: [string, InterventionRecord[]]) => {
                    const isCollapsed = collapsedGroups[groupName];
                    
                    return (
                    <div key={groupName} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        {groupBy !== 'None' && (
                            <div 
                                onClick={() => toggleGroup(groupName)}
                                className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>
                                        <ChevronRight size={18} />
                                    </span>
                                    <h3 className="font-bold text-slate-800 text-base">{groupName}</h3>
                                    <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {groupItems.length}
                                    </span>
                                </div>
                                {/* Group Summary Stats */}
                                <div className="hidden sm:flex items-center gap-6 text-xs text-slate-500 font-medium">
                                    <span>Avg Progress: <span className="text-slate-800 font-bold">{groupItems.length > 0 ? Math.round(groupItems.reduce((a,b)=>a+b.progress,0)/groupItems.length) : 0}%</span></span>
                                    {groupBy !== 'Tier' && (
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-rose-500" title="Tier 3"></span>
                                            <span>{groupItems.filter(i => i.tier === Tier.TIER_3).length} T3</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Items Container - Default to expanded (NOT collapsed) */}
                        {!isCollapsed && (
                            <div className={`p-4 ${layout === 'Cards' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'flex flex-col gap-0'}`}>
                                {groupItems.map((item) => (
                                    layout === 'Cards' ? (
                                        // CARD VIEW
                                        <div 
                                            key={item.id} 
                                            onClick={() => onStudentClick(item.studentName)}
                                            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group relative"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                                        <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${item.avatarSeed}&backgroundColor=e0e7ff`} alt={item.studentName} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{item.studentName}</h4>
                                                        <p className="text-[10px] text-slate-500">{item.grade} • {item.teacher}</p>
                                                    </div>
                                                </div>
                                                {getTierBadge(item.tier)}
                                            </div>
                                            
                                            <div className="bg-slate-50 rounded-lg p-2 mb-3 border border-slate-100">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan</span>
                                                    <span className="text-[10px] font-bold text-indigo-600">{item.durationWeeks} wks</span>
                                                </div>
                                                <p className="text-xs font-semibold text-slate-700 truncate">{item.planName}</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="flex justify-between text-[10px] mb-1">
                                                        <span className="text-slate-500 font-bold">Progress</span>
                                                        <span className="text-slate-800 font-bold">{item.progress}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${item.progress < 60 ? 'bg-rose-500' : item.progress < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${item.progress}%` }} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[10px] mb-1">
                                                        <span className="text-slate-500 font-bold">Attendance</span>
                                                        <span className="text-slate-800 font-bold">{item.attendance}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${item.attendance < 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${item.attendance}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Share Button (Cards) */}
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleSharePlan(item); }}
                                                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm"
                                                    title="Share Lesson Plan"
                                                >
                                                    <Share2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // LIST VIEW
                                        <div 
                                            key={item.id}
                                            onClick={() => onStudentClick(item.studentName)} 
                                            className="flex items-center justify-between p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                                                    <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${item.avatarSeed}&backgroundColor=e0e7ff`} alt={item.studentName} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600">{item.studentName}</h4>
                                                    <p className="text-[10px] text-slate-500 hidden sm:block">{item.id}</p>
                                                </div>
                                            </div>

                                            <div className="w-1/6 hidden md:block">
                                                <p className="text-xs font-semibold text-slate-700">{item.teacher}</p>
                                                <p className="text-[10px] text-slate-500">{item.grade}</p>
                                            </div>

                                            <div className="w-1/6 hidden sm:block">
                                                {getTierBadge(item.tier)}
                                            </div>

                                            <div className="w-1/4">
                                                <div className="flex items-center gap-2">
                                                    {getProgressBar(item.progress)}
                                                    <span className="text-xs font-bold text-slate-700 w-8 text-right">{item.progress}%</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">{item.planName}</p>
                                            </div>

                                            <div className="w-1/12 text-right flex justify-end gap-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleSharePlan(item); }}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Share Lesson Plan"
                                                >
                                                    <Share2 size={16} />
                                                </button>
                                                <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors">
                                                    <MoreHorizontal size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                )})
            )}
        </div>
      </div>
    </div>
  );
};
