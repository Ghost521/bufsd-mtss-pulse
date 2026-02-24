
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { STAFF_ROSTER_DATA } from '../constants';
import type { StaffRosterItem} from '../types';
import { UserRole } from '../types';
import { StudentRosterView } from './StudentRosterView';
import type { WorkspacePageId } from '../lib/workspaceRoutes';
import { useTenantCollection } from '../hooks/useTenantCollection';
import {
  normalizeInterventionFocus,
  type InterventionistFocus,
} from '../lib/interventionists';
import { 
  Users, 
  TrendingUp, 
  MoreHorizontal, 
  ClipboardList,
  Search,
  Filter,
  Mail,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Check,
  Camera,
  ArrowRight,
  Info,
  Activity,
  Clock,
  ThumbsUp,
  GraduationCap,
  Upload,
  CheckCircle2,
  Trash2,
  Archive,
  Download,
  X,
  BookOpen,
  Calculator
} from 'lucide-react';
import { SidebarToggleButton } from './SidebarToggleButton';

interface RosterViewProps {
  onMenuClick: () => void;
  onEmailClick?: (name: string) => void;
  onStudentClick?: (name: string) => void;
  onNavigate?: (page: WorkspacePageId) => void;
  currentUserRole: UserRole;
  defaultTab?: 'staff' | 'students';
}

// Extend type locally to support custom avatar without modifying global types yet
interface ExtendedStaffRosterItem extends StaffRosterItem {
  customAvatar?: string;
}

type StaffSortKey = 'Name' | 'Fidelity' | 'Attendance' | 'Interventions' | 'Caseload';
type StaffSortDirection = 'asc' | 'desc';
const STAFF_SORT_OPTIONS: StaffSortKey[] = ['Fidelity', 'Attendance', 'Interventions', 'Caseload', 'Name'];
const INTERVENTION_FOCUSES: InterventionistFocus[] = ['Reading', 'Math'];

// Helper to generate deterministic breakdown based on total score and seed
const getFidelityBreakdown = (totalScore: number, seed: string) => {
    const pseudoRandom = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return (Math.abs(hash) % 100) / 100;
    };
    
    const r = pseudoRandom(seed);
    const variance = (100 - totalScore) * 0.5; 
    const adherence = Math.min(100, Math.max(0, totalScore + (r > 0.5 ? variance * 0.5 : -variance)));
    const dosage = Math.min(100, Math.max(0, totalScore - (r * variance)));
    const quality = Math.min(100, Math.max(0, totalScore + (r * variance * 0.8)));
    let responsiveness = (totalScore * 4) - adherence - dosage - quality;
    responsiveness = Math.min(100, Math.max(0, responsiveness));

    return [
        { label: 'Adherence', value: Math.round(adherence), icon: ClipboardList, color: 'bg-blue-500', text: 'text-blue-700' },
        { label: 'Dosage', value: Math.round(dosage), icon: Clock, color: 'bg-amber-500', text: 'text-amber-700' },
        { label: 'Quality', value: Math.round(quality), icon: Activity, color: 'bg-emerald-500', text: 'text-emerald-700' },
        { label: 'Response', value: Math.round(responsiveness), icon: ThumbsUp, color: 'bg-violet-500', text: 'text-violet-700' },
    ];
};

export const RosterView: React.FC<RosterViewProps> = ({
  onMenuClick,
  onEmailClick,
  onStudentClick,
  onNavigate,
  currentUserRole,
  defaultTab = 'staff',
}) => {
  // Tab State
  const [activeTab, setActiveTab] = useState<'staff' | 'students'>(defaultTab);
  const staffCollection = useTenantCollection<ExtendedStaffRosterItem>('staff');
  const seededStaffRef = useRef(false);

  // State for data (allows modification for avatar uploads)
  const [staffList, setStaffList] = useState<ExtendedStaffRosterItem[]>(STAFF_ROSTER_DATA);

  // State for filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [sortState, setSortState] = useState<{ key: StaffSortKey; direction: StaffSortDirection }>({
    key: 'Fidelity',
    direction: 'desc',
  });
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Bulk Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedStaffIds, setExpandedStaffIds] = useState<Set<string>>(new Set());

  // State for Avatar Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const canImportStaff = currentUserRole === UserRole.PRINCIPAL || currentUserRole === UserRole.DISTRICT;
  const canManageInterventionists = currentUserRole === UserRole.PRINCIPAL || currentUserRole === UserRole.DISTRICT;

  useEffect(() => {
    const rows = staffCollection.query.data?.rows;
    if (!rows) return;
    if (rows.length > 0) seededStaffRef.current = true;
    setStaffList(rows);
  }, [staffCollection.query.data?.rows]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (seededStaffRef.current) return;
    if (!staffCollection.query.isSuccess) return;
    const rows = staffCollection.query.data?.rows ?? [];
    if (rows.length > 0) {
      seededStaffRef.current = true;
      return;
    }
    seededStaffRef.current = true;
    staffCollection.replaceMutation.mutate(STAFF_ROSTER_DATA);
  }, [staffCollection.query.isSuccess, staffCollection.query.data?.rows, staffCollection.replaceMutation]);

  // Derived Data
  const filteredAndSortedStaff = useMemo(() => {
    let result = [...staffList];

    // 1. Filter by Search
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(staff => 
        staff.name.toLowerCase().includes(lowerQuery) || 
        staff.grade?.toLowerCase().includes(lowerQuery)
      );
    }

    // 2. Filter by Role
    if (roleFilter !== 'All') {
      result = result.filter(staff => staff.role === roleFilter);
    }

    // 3. Sort
    result.sort((a, b) => {
      const baseResult = (() => {
        switch (sortState.key) {
          case 'Fidelity': return b.mtssFidelityScore - a.mtssFidelityScore;
          case 'Attendance': return b.attendanceRate - a.attendanceRate;
          case 'Interventions': return b.activeInterventions - a.activeInterventions;
          case 'Caseload': return b.studentCount - a.studentCount;
          case 'Name': return a.name.localeCompare(b.name);
          default: return 0;
        }
      })();
      return sortState.direction === 'desc' ? baseResult : baseResult * -1;
    });

    return result;
  }, [searchQuery, roleFilter, sortState, staffList]);

  // Helpers
  const getFidelityColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-emerald-500', text: 'text-emerald-700', bar: 'bg-emerald-500', track: 'bg-emerald-100' };
    if (score >= 80) return { bg: 'bg-amber-500', text: 'text-amber-700', bar: 'bg-amber-400', track: 'bg-amber-100' };
    return { bg: 'bg-rose-500', text: 'text-rose-700', bar: 'bg-rose-500', track: 'bg-rose-100' };
  };

  const getRoleBadgeStyle = (role: string) => {
    switch(role) {
        case 'Teacher': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        case 'Consultant': return 'bg-violet-50 text-violet-700 border-violet-100';
        case 'Specialist': return 'bg-sky-50 text-sky-700 border-sky-100';
        default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const handleAction = (action: string, staffName: string) => {
    if (action === 'Email' && onEmailClick) {
      onEmailClick(staffName);
    } else {
      alert(`${action} for ${staffName}`);
    }
  };

  const persistInterventionFocus = (staffId: string, nextFocus: InterventionistFocus[]) => {
    setStaffList((previous) =>
      previous.map((staff) =>
        staff.id === staffId
          ? {
              ...staff,
              interventionFocus: nextFocus,
              isInterventionist: nextFocus.length > 0,
            }
          : staff,
      ),
    );
    staffCollection.updateMutation.mutate({
      id: staffId,
      patch: {
        interventionFocus: nextFocus,
        isInterventionist: nextFocus.length > 0,
      },
    });
  };

  const handleToggleInterventionFocus = (staff: ExtendedStaffRosterItem, focus: InterventionistFocus) => {
    if (!canManageInterventionists || staff.role !== 'Teacher') return;
    const currentFocus = normalizeInterventionFocus(staff.interventionFocus);
    const nextFocus = currentFocus.includes(focus)
      ? currentFocus.filter((value) => value !== focus)
      : [...currentFocus, focus];
    persistInterventionFocus(staff.id, nextFocus);
  };

  // Avatar Upload Handlers
  const handleAvatarClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadTargetId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && uploadTargetId) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Profile image must be 2MB or smaller.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const nextAvatar = reader.result as string;
            setStaffList(prev => prev.map(s => 
                s.id === uploadTargetId ? { ...s, customAvatar: nextAvatar } : s
            ));
            staffCollection.updateMutation.mutate({ id: uploadTargetId, patch: { customAvatar: nextAvatar } });
            setUploadTargetId(null);
        };
        reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Bulk Handlers
  const handleToggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
      if (filteredAndSortedStaff.length === 0) return;
      if (selectedIds.size === filteredAndSortedStaff.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredAndSortedStaff.map(s => s.id)));
      }
  };

  const handleSortKeySelect = (key: StaffSortKey) => {
    setSortState((current) => ({ ...current, key }));
    setIsSortMenuOpen(false);
  };

  const handleToggleSortDirection = () => {
    setSortState((current) => ({
      ...current,
      direction: current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handleToggleCardDetails = (staffId: string) => {
    setExpandedStaffIds((current) => {
      const next = new Set(current);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
      if (window.confirm(`Remove ${selectedIds.size} staff members from the active roster?`)) {
          setStaffList(prev => prev.filter(s => !selectedIds.has(s.id)));
          selectedIds.forEach((id) => {
              staffCollection.deleteMutation.mutate({ id });
          });
          setSelectedIds(new Set());
          setIsSelectionMode(false);
      }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 relative">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Header & View Toggle */}
      <div className="flex flex-col gap-6 mb-8 bg-white/80 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden z-10">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            <div className="flex items-center gap-4">
                <SidebarToggleButton
                    onClick={onMenuClick}
                    className="lg:hidden p-2.5 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-xl"
                />
                <div className="p-3 bg-indigo-50/80 rounded-xl shadow-sm border border-indigo-100/50 text-indigo-600 hidden sm:block">
                    <Users size={24} strokeWidth={2.5} />
                </div>
                <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Roster workspace</h2>
                    <p className="text-slate-500 mt-1.5 text-sm font-medium">Manage staff and student rosters.</p>
                </div>
            </div>

            {/* Segmented View Toggle */}
            <div className="bg-slate-100/80 p-1.5 rounded-xl flex items-center w-full md:w-auto shadow-inner border border-slate-200/50">
                <button
                    onClick={() => setActiveTab('staff')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        activeTab === 'staff' 
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                    }`}
                >
                    <Users size={16} strokeWidth={2.5} /> Staff Directory
                </button>
                <button
                    onClick={() => setActiveTab('students')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        activeTab === 'students' 
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                    }`}
                >
                    <GraduationCap size={16} strokeWidth={2.5} /> Students
                </button>
            </div>
        </div>

        {/* STAFF VIEW CONTROLS */}
        {activeTab === 'staff' && (
            <div className="flex flex-col md:flex-row gap-4 animate-in fade-in justify-between items-center bg-slate-50/50 p-4 rounded-3xl border border-slate-200/60 shadow-sm backdrop-blur-md">
                
                <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
                    {/* Search */}
                    <div className="relative group w-full md:w-64 xl:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search staff by name or grade..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 pr-5 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 w-full transition-all shadow-sm"
                        />
                    </div>

                    {/* Filters Group */}
                    <div className="grid grid-cols-2 md:flex gap-3 w-full md:w-auto">
                        <div className="relative">
                            <button 
                                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                                className={`w-full md:w-auto flex items-center justify-between md:justify-start gap-3 px-4 py-3 border rounded-xl text-sm font-bold transition-all duration-300 shadow-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
                                    isFilterMenuOpen || roleFilter !== 'All'
                                    ? 'bg-indigo-50 border-indigo-200/80 text-indigo-700' 
                                    : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 truncate">
                                    <Filter size={16} className={`shrink-0 ${roleFilter !== 'All' ? "text-indigo-600" : "text-slate-500"}`} strokeWidth={2.5} />
                                    <span className="truncate">{roleFilter === 'All' ? 'Role' : roleFilter}</span>
                                </div>
                                <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isFilterMenuOpen ? 'rotate-180' : ''} ${roleFilter !== 'All' ? "text-indigo-500" : "text-slate-400"}`} />
                            </button>
                            {isFilterMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setIsFilterMenuOpen(false)} />
                                    <div className="absolute left-0 md:left-auto md:right-0 mt-3 w-full md:w-56 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-xl z-30 p-2 animate-in fade-in zoom-in-95 duration-200 origin-top">
                                        <div className="px-4 py-2.5 border-b border-slate-100/80 mb-2">
                                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Select Role</p>
                                        </div>
                                        {['All', 'Teacher', 'Consultant', 'Specialist'].map(role => (
                                            <button
                                                key={role}
                                                onClick={() => { setRoleFilter(role); setIsFilterMenuOpen(false); }}
                                                className={`w-full text-left px-4 py-3 text-sm rounded-xl flex items-center justify-between transition-colors ${
                                                    roleFilter === role 
                                                        ? 'bg-indigo-50/80 text-indigo-700 font-extrabold border border-indigo-100/50 shadow-sm' 
                                                        : 'text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                                }`}
                                            >
                                                {role === 'All' ? 'All Roles' : role}
                                                {roleFilter === role && <Check size={16} strokeWidth={3} className="text-indigo-600" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="relative flex items-center gap-2">
                            <button 
                                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                                className={`w-full md:w-auto flex items-center justify-between md:justify-start gap-3 px-4 py-3 border rounded-xl text-sm font-bold transition-all duration-300 shadow-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
                                    isSortMenuOpen 
                                    ? 'bg-indigo-50 border-indigo-200/80 text-indigo-700' 
                                    : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 truncate">
                                    <ArrowUpDown size={16} className={`shrink-0 ${isSortMenuOpen ? "text-indigo-600" : "text-slate-500"}`} strokeWidth={2.5} />
                                    <span className="truncate">Sort: {sortState.key}</span>
                                </div>
                                <ChevronDown size={16} className={`shrink-0 transition-transform duration-300 ${isSortMenuOpen ? 'rotate-180' : ''} text-slate-400`} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Sort direction: ${sortState.direction === 'desc' ? 'Descending' : 'Ascending'}`}
                              onClick={handleToggleSortDirection}
                              className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:shadow hover:-translate-y-0.5"
                            >
                              {sortState.direction === 'desc' ? <ArrowDown size={16} strokeWidth={2.5} /> : <ArrowUp size={16} strokeWidth={2.5} />}
                            </button>
                            {isSortMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setIsSortMenuOpen(false)} />
                                    <div className="absolute right-0 top-full mt-3 w-full md:w-56 bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-xl z-30 p-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <div className="px-4 py-2.5 border-b border-slate-100/80 mb-2">
                                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Order By</p>
                                        </div>
                                        {STAFF_SORT_OPTIONS.map(sort => (
                                            <button
                                                key={sort}
                                                onClick={() => handleSortKeySelect(sort)}
                                                className={`w-full text-left px-4 py-3 text-sm rounded-xl flex items-center justify-between transition-colors ${
                                                    sortState.key === sort 
                                                        ? 'bg-indigo-50/80 text-indigo-700 font-extrabold border border-indigo-100/50 shadow-sm' 
                                                        : 'text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                                }`}
                                            >
                                                {sort}
                                                {sortState.key === sort && <Check size={16} strokeWidth={3} className="text-indigo-600" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    {/* Bulk Selection Toggle */}
                    <button 
                       onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                       className={`flex-1 md:flex-none items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-extrabold transition-all shadow-sm border ${isSelectionMode ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 hover:shadow-md' : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:shadow-md'}`}
                    >
                        {isSelectionMode ? <X size={16} strokeWidth={2.5} /> : <CheckCircle2 size={16} strokeWidth={2.5} />}
                        {isSelectionMode ? 'Done' : 'Select'}
                    </button>

                    {/* Import Button */}
                    {canImportStaff && (
                      <button 
                          onClick={() => onNavigate && onNavigate('import')}
                          className="flex-1 md:flex-none bg-white border border-slate-200/80 text-slate-700 hover:text-indigo-700 hover:border-indigo-200/80 hover:bg-indigo-50/50 px-5 py-3 rounded-xl font-extrabold shadow-sm transition-all text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-md"
                      >
                          <Upload size={16} strokeWidth={2.5} /> 
                          <span>Import</span>
                      </button>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* CONTENT AREA */}
      
      {/* STAFF GRID */}
      {activeTab === 'staff' && (
          <>
            {isSelectionMode && (
                <div className="sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
                    <button 
                        onClick={handleSelectAll}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:text-indigo-700"
                    >
                        Select All
                    </button>
                    <span className="text-xs font-semibold text-slate-600">{selectedIds.size} selected</span>
                    <div className="h-4 w-px bg-slate-200" />
                    <button
                      onClick={handleBulkDelete}
                      disabled={selectedIds.size === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors enabled:hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                    <button
                      disabled={selectedIds.size === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Archive size={14} />
                      Deactivate
                    </button>
                    <button
                      disabled={selectedIds.size === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download size={14} />
                      Export
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                {filteredAndSortedStaff.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-slate-500 bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200/60 flex flex-col items-center gap-3">
                        <Search size={48} className="text-slate-300 mb-2" strokeWidth={1.5} />
                        <p className="font-extrabold text-lg text-slate-700 tracking-tight">No staff members found.</p>
                        <p className="text-sm font-medium text-slate-500">Try adjusting your filters or search query.</p>
                        <button 
                            onClick={() => {setRoleFilter('All'); setSearchQuery('');}}
                            className="mt-3 text-sm text-indigo-600 font-bold hover:underline underline-offset-4"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    filteredAndSortedStaff.map((staff) => {
                    const fidelityStyles = getFidelityColor(staff.mtssFidelityScore);
                    const breakdown = getFidelityBreakdown(staff.mtssFidelityScore, staff.name);
                    const isSelected = selectedIds.has(staff.id);
                    const interventionFocus = normalizeInterventionFocus(staff.interventionFocus);
                    const isInterventionist = interventionFocus.length > 0 || Boolean(staff.isInterventionist);
                    const isExpanded = expandedStaffIds.has(staff.id);
                    
                    return (
                    <div 
                        key={staff.id} 
                        onClick={() => isSelectionMode && handleToggleSelection(staff.id)}
                        className={`bg-white/90 backdrop-blur-sm rounded-2xl border shadow-sm hover:shadow-lg hover:border-indigo-300/80 transition-all duration-300 group relative flex flex-col h-full hover:-translate-y-1 overflow-hidden ${isSelectionMode ? 'cursor-pointer' : 'cursor-default'} ${isSelectionMode && isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md' : 'border-slate-200/60'}`}
                    >
                        
                        {/* Decorative Top Border */}
                        <div className={`h-1.5 w-full transition-colors ${staff.mtssFidelityScore >= 90 ? 'bg-emerald-500' : staff.mtssFidelityScore >= 80 ? 'bg-amber-500' : 'bg-rose-500'}`} />

                        {/* Header Section */}
                        <div className="p-6 pb-5 relative z-10">
                        <div className="flex justify-between items-start mb-5">
                            <div className="flex items-center gap-4">
                            {/* Avatar with Upload Overlay */}
                            <div className="relative group/avatar">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-white shadow-md overflow-hidden ring-1 ring-slate-200/50 group-hover/avatar:ring-indigo-300 transition-all duration-300 relative flex items-center justify-center">
                                    {isSelectionMode ? (
                                        <div className={`w-full h-full flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600' : 'bg-slate-100'}`}>
                                            {isSelected ? <Check size={32} strokeWidth={3} className="text-white" /> : <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${staff.avatarSeed}&backgroundColor=e0e7ff`} className="opacity-50" />}
                                        </div>
                                    ) : (
                                        <>
                                            <img 
                                                src={staff.customAvatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${staff.avatarSeed}&backgroundColor=e0e7ff`} 
                                                alt={staff.name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110"
                                            />
                                            {/* Camera Upload Overlay */}
                                            <div 
                                                onClick={(e) => handleAvatarClick(staff.id, e)}
                                                className="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer backdrop-blur-[2px] border-2 border-transparent"
                                            >
                                                <Camera size={24} strokeWidth={2.5} className="text-white drop-shadow-md" />
                                            </div>
                                        </>
                                    )}
                                </div>

                                {staff.flaggedStudents > 0 && !isSelectionMode && (
                                    <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-rose-500 text-white rounded-xl border-2 border-white flex items-center justify-center text-[11px] font-extrabold shadow-sm animate-pulse pointer-events-none" title={`${staff.flaggedStudents} Flagged Students`}>
                                        {staff.flaggedStudents}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-xl font-extrabold tracking-tight text-slate-800 group-hover:text-indigo-700 transition-colors cursor-pointer" onClick={() => !isSelectionMode && handleAction('View Profile', staff.name)}>
                                    {staff.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md border shadow-sm ${getRoleBadgeStyle(staff.role)}`}>
                                        {staff.role}
                                    </span>
                                    {staff.grade && <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border border-slate-200/80 px-2 py-0.5 rounded-md bg-slate-50 shadow-sm">{staff.grade}</span>}
                                    {isInterventionist ? (
                                      <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md border border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-sm">
                                        Interv{interventionFocus.length > 0 ? `: ${interventionFocus.join(' + ')}` : ''}
                                      </span>
                                    ) : null}
                                </div>
                            </div>
                            </div>
                            {!isSelectionMode && (
                                <button className="text-slate-400 hover:text-indigo-600 p-2 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm transition-all">
                                    <MoreHorizontal size={20} strokeWidth={2.5} />
                                </button>
                            )}
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div className="flex flex-col p-4 bg-slate-50/80 rounded-2xl border border-slate-200/50 group-hover:border-indigo-200/50 transition-all shadow-sm group/stat">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest mb-1 text-slate-500 group-hover/stat:text-indigo-600 transition-colors">Caseload</span>
                                <div className="flex items-center gap-2">
                                    <Users size={18} className="text-indigo-500" strokeWidth={2.5} />
                                    <span className="text-2xl font-extrabold tracking-tight text-slate-800">{staff.studentCount}</span>
                                    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">students</span>
                                </div>
                            </div>
                            <div className="flex flex-col p-4 bg-slate-50/80 rounded-2xl border border-slate-200/50 group-hover:border-indigo-200/50 transition-all shadow-sm">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest mb-1 text-slate-500">Attendance</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-2xl font-extrabold tracking-tight ${staff.attendanceRate >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {staff.attendanceRate}%
                                    </span>
                                    <div className={`w-2 h-2 rounded-full shadow-sm ${staff.attendanceRate >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                </div>
                            </div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleCardDetails(staff.id);
                          }}
                          className="mb-5 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition-all hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/30 shadow-sm"
                        >
                          {isExpanded ? 'Hide details' : 'Show details'}
                          <ChevronDown
                            size={16}
                            strokeWidth={2.5}
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                        </div>

                        {/* Fidelity Summary */}
                        <div className="px-6 py-5 bg-slate-50/80 flex-1 border-t border-slate-100/80 relative z-10">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 text-slate-500">
                                    <ClipboardList size={16} className="text-slate-400" strokeWidth={2.5} /> 
                                    MTSS Fidelity Score
                                    <Info size={14} className="text-slate-300" />
                                </span>
                                <span className={`text-sm font-extrabold ${fidelityStyles.text}`}>
                                    {staff.mtssFidelityScore}%
                                </span>
                            </div>
                            <div className={`w-full h-3 rounded-full overflow-hidden shadow-inner border border-slate-200/50 ${fidelityStyles.track}`}>
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${fidelityStyles.bar}`}
                                    style={{ width: `${staff.mtssFidelityScore}%` }}
                                />
                            </div>
                        </div>

                        {isExpanded && !isSelectionMode ? (
                          <div className="space-y-4 border-t border-slate-100/80 bg-white px-6 py-5 rounded-b-2xl relative z-10">
                            <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-indigo-50/50 border border-indigo-100/50 shadow-sm">
                                <TrendingUp size={16} strokeWidth={2.5} className="text-indigo-500 shrink-0" /> 
                                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Performance:</span>
                                <span className="text-sm font-extrabold text-slate-800">{staff.performanceMetric}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 shadow-sm">
                                {breakdown.map((metric, i) => (
                                    <div key={i} className="flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                <metric.icon size={12} strokeWidth={2.5} className="text-slate-400" />
                                                {metric.label}
                                            </span>
                                            <span className={`text-[11px] font-extrabold ${metric.text}`}>{metric.value}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100/80 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                            <div 
                                                className={`h-full rounded-full ${metric.color}`}
                                                style={{ width: `${metric.value}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {canManageInterventionists && staff.role === 'Teacher' ? (
                              <div
                                className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 shadow-sm"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <div className="mb-3 flex items-center justify-between">
                                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Interventionist Tags</p>
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {interventionFocus.length > 0 ? interventionFocus.join(' + ') : 'None'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {INTERVENTION_FOCUSES.map((focus) => {
                                    const selected = interventionFocus.includes(focus);
                                    return (
                                      <button
                                        key={focus}
                                        type="button"
                                        onClick={() => handleToggleInterventionFocus(staff, focus)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest transition-all shadow-sm ${
                                          selected
                                            ? 'border-indigo-300/80 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-200/80 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/30'
                                        }`}
                                      >
                                        {focus === 'Reading' ? <BookOpen size={14} strokeWidth={2.5} /> : <Calculator size={14} strokeWidth={2.5} />}
                                        {focus}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Quick Actions</span>
                                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md border text-slate-500 bg-slate-50 border-slate-200/80 shadow-sm">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-sm" />
                                        {staff.activeInterventions} Active Plans
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => handleAction('Email', staff.name)}
                                        className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 hover:text-indigo-700 hover:border-indigo-300 transition-all shadow-sm group/btn"
                                    >
                                        <Mail size={16} strokeWidth={2.5} className="text-slate-400 group-hover/btn:text-indigo-500 transition-colors" /> 
                                        Email Staff
                                    </button>
                                    <button 
                                        onClick={() => handleAction('View Details', staff.name)}
                                        className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-white bg-indigo-600 border border-indigo-600 rounded-xl hover:bg-indigo-700 hover:shadow-lg transition-all shadow-md hover:-translate-y-0.5 group/btn"
                                    >
                                        View Details <ArrowRight size={16} strokeWidth={2.5} className="group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                          </div>
                        ) : null}
                    </div>
                    )})
                )}
            </div>
          </>
      )}

      {/* STUDENT ROSTER VIEW */}
      {activeTab === 'students' && (
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden p-6 sm:p-8">
            <StudentRosterView 
                onMenuClick={onMenuClick}
                onStudentClick={onStudentClick || ((name) => console.log(name))}
                currentUserRole={currentUserRole}
                viewType={currentUserRole === UserRole.TEACHER ? "classroom" : "master"}
                embedded={true} 
                onNavigate={onNavigate}
            />
          </div>
      )}
    </div>
  );
};
