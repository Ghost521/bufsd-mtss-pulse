
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
}

// Extend type locally to support custom avatar without modifying global types yet
interface ExtendedStaffRosterItem extends StaffRosterItem {
  customAvatar?: string;
}

type StaffSortKey = 'Name' | 'Fidelity' | 'Attendance' | 'Interventions' | 'Caseload';
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

export const RosterView: React.FC<RosterViewProps> = ({ onMenuClick, onEmailClick, onStudentClick, onNavigate, currentUserRole }) => {
  // Tab State
  const [activeTab, setActiveTab] = useState<'staff' | 'students'>('staff');
  const staffCollection = useTenantCollection<ExtendedStaffRosterItem>('staff');
  const seededStaffRef = useRef(false);

  // State for data (allows modification for avatar uploads)
  const [staffList, setStaffList] = useState<ExtendedStaffRosterItem[]>(STAFF_ROSTER_DATA);

  // State for filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<StaffSortKey>('Fidelity');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Bulk Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hover state for Fidelity Breakdown
  const [hoveredFidelityId, setHoveredFidelityId] = useState<string | null>(null);

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
      switch (sortBy) {
        case 'Fidelity': return b.mtssFidelityScore - a.mtssFidelityScore;
        case 'Attendance': return b.attendanceRate - a.attendanceRate;
        case 'Interventions': return b.activeInterventions - a.activeInterventions;
        case 'Caseload': return b.studentCount - a.studentCount;
        case 'Name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    return result;
  }, [searchQuery, roleFilter, sortBy, staffList]);

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
      if (selectedIds.size === filteredAndSortedStaff.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredAndSortedStaff.map(s => s.id)));
      }
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

      {/* Floating Bulk Action Bar */}
      {isSelectionMode && selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-4 zoom-in-95">
                <span className="font-bold text-sm">{selectedIds.size} Selected</span>
                <div className="h-4 w-px bg-white/20"></div>
                <button onClick={handleBulkDelete} className="flex items-center gap-2 hover:text-rose-400 transition-colors text-sm font-semibold">
                    <Trash2 size={16} /> Remove
                </button>
                <button className="flex items-center gap-2 hover:text-indigo-300 transition-colors text-sm font-semibold">
                    <Archive size={16} /> Deactivate
                </button>
                <button className="flex items-center gap-2 hover:text-emerald-300 transition-colors text-sm font-semibold">
                    <Download size={16} /> Export
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-2 p-1 hover:bg-white/20 rounded-full">
                    <X size={14} />
                </button>
            </div>
      )}

      {/* Header & View Toggle */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex items-center gap-3">
                <SidebarToggleButton
                    onClick={onMenuClick}
                    className="lg:hidden p-2 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-lg"
                />
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Roster workspace</h2>
                    <p className="text-slate-500 mt-1">Manage staff and student rosters.</p>
                </div>
            </div>

            {/* Segmented View Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center w-full md:w-auto">
                <button
                    onClick={() => setActiveTab('staff')}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                        activeTab === 'staff' 
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Users size={16} /> Staff Directory
                </button>
                <button
                    onClick={() => setActiveTab('students')}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                        activeTab === 'students' 
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <GraduationCap size={16} /> Students
                </button>
            </div>
        </div>

        {/* STAFF VIEW CONTROLS */}
        {activeTab === 'staff' && (
            <div className="flex flex-col md:flex-row gap-3 animate-in fade-in justify-between">
                
                <div className="flex flex-col md:flex-row gap-3 flex-1">
                    {/* Search */}
                    <div className="relative group w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search staff..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full transition-all shadow-sm focus:shadow-md hover:border-slate-300"
                        />
                    </div>

                    {/* Filters Group */}
                    <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
                        <div className="relative">
                            <button 
                                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                                className={`w-full md:w-auto flex items-center justify-between md:justify-start gap-2 px-3 py-2.5 border rounded-lg text-sm font-medium transition-all duration-200 shadow-sm whitespace-nowrap ${
                                    isFilterMenuOpen || roleFilter !== 'All'
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Filter size={16} className={`shrink-0 ${roleFilter !== 'All' ? "text-indigo-600" : "text-slate-500"}`} />
                                    <span className="truncate">{roleFilter === 'All' ? 'Role' : roleFilter}</span>
                                </div>
                                <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${isFilterMenuOpen ? 'rotate-180' : ''} ${roleFilter !== 'All' ? "text-indigo-500" : "text-slate-400"}`} />
                            </button>
                            {isFilterMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsFilterMenuOpen(false)} />
                                    <div className="absolute left-0 md:left-auto md:right-0 mt-2 w-full md:w-48 bg-white border border-slate-100 rounded-xl shadow-lg ring-1 ring-black/5 z-20 p-1 animate-in fade-in zoom-in-95 duration-200 origin-top">
                                        <div className="px-3 py-2 border-b border-slate-50 mb-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Role</p>
                                        </div>
                                        {['All', 'Teacher', 'Consultant', 'Specialist'].map(role => (
                                            <button
                                                key={role}
                                                onClick={() => { setRoleFilter(role); setIsFilterMenuOpen(false); }}
                                                className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors ${
                                                    roleFilter === role 
                                                        ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                }`}
                                            >
                                                {role === 'All' ? 'All Roles' : role}
                                                {roleFilter === role && <Check size={14} className="text-indigo-600" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="relative">
                            <button 
                                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                                className={`w-full md:w-auto flex items-center justify-between md:justify-start gap-2 px-3 py-2.5 border rounded-lg text-sm font-medium transition-all duration-200 shadow-sm whitespace-nowrap ${
                                    isSortMenuOpen 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <ArrowUpDown size={16} className={`shrink-0 ${isSortMenuOpen ? "text-indigo-600" : "text-slate-500"}`} />
                                    <span className="truncate">Sort</span>
                                </div>
                                <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${isSortMenuOpen ? 'rotate-180' : ''} text-slate-400`} />
                            </button>
                            {isSortMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsSortMenuOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-full md:w-52 bg-white border border-slate-100 rounded-xl shadow-lg ring-1 ring-black/5 z-20 p-1 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <div className="px-3 py-2 border-b border-slate-50 mb-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order By</p>
                                        </div>
                                        {STAFF_SORT_OPTIONS.map(sort => (
                                            <button
                                                key={sort}
                                                onClick={() => { setSortBy(sort); setIsSortMenuOpen(false); }}
                                                className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors ${
                                                    sortBy === sort 
                                                        ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                }`}
                                            >
                                                {sort}
                                                {sortBy === sort && <Check size={14} className="text-indigo-600" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* Bulk Selection Toggle */}
                    <button 
                       onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                       className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold border transition-all ${isSelectionMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}
                    >
                        {isSelectionMode ? <X size={16} /> : <CheckCircle2 size={16} />}
                        {isSelectionMode ? 'Cancel' : 'Bulk Select'}
                    </button>

                    {/* Import Button */}
                    {canImportStaff && (
                      <button 
                          onClick={() => onNavigate && onNavigate('import')}
                          className="bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 px-4 py-2.5 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center gap-2 active:translate-y-0.5 transform"
                      >
                          <Upload size={16} /> 
                          <span>Import Staff</span>
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
                <div className="mb-4 flex items-center gap-2 bg-slate-100 p-2 rounded-lg w-fit">
                    <button 
                        onClick={handleSelectAll}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-white rounded shadow-sm"
                    >
                        Select All
                    </button>
                    <span className="text-xs font-medium text-slate-500 px-2">{selectedIds.size} Selected</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                {filteredAndSortedStaff.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center gap-2">
                        <Search size={48} className="text-slate-300 mb-2" />
                        <p className="font-medium">No staff members found.</p>
                        <p className="text-sm text-slate-400">Try adjusting your filters or search query.</p>
                        <button 
                            onClick={() => {setRoleFilter('All'); setSearchQuery('');}}
                            className="mt-2 text-sm text-indigo-600 font-medium hover:underline"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    filteredAndSortedStaff.map((staff) => {
                    const fidelityStyles = getFidelityColor(staff.mtssFidelityScore);
                    const breakdown = getFidelityBreakdown(staff.mtssFidelityScore, staff.name);
                    const isHovered = hoveredFidelityId === staff.id;
                    const isSelected = selectedIds.has(staff.id);
                    const interventionFocus = normalizeInterventionFocus(staff.interventionFocus);
                    const isInterventionist = interventionFocus.length > 0 || Boolean(staff.isInterventionist);
                    
                    return (
                    <div 
                        key={staff.id} 
                        onClick={() => isSelectionMode && handleToggleSelection(staff.id)}
                        className={`bg-white rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 group relative flex flex-col h-full hover:-translate-y-1 overflow-hidden cursor-pointer ${isSelectionMode && isSelected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-indigo-100'}`}
                    >
                        
                        {/* Decorative Top Border */}
                        <div className={`h-1 w-full ${staff.mtssFidelityScore >= 90 ? 'bg-emerald-500' : staff.mtssFidelityScore >= 80 ? 'bg-amber-500' : 'bg-rose-500'}`} />

                        {/* Header Section */}
                        <div className="p-6 pb-4">
                        <div className="flex justify-between items-start mb-5">
                            <div className="flex items-center gap-4">
                            {/* Avatar with Upload Overlay */}
                            <div className="relative group/avatar">
                                <div className="w-16 h-16 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden ring-1 ring-slate-100 group-hover/avatar:ring-indigo-200 transition-all duration-300 relative flex items-center justify-center">
                                    {isSelectionMode ? (
                                        <div className={`w-full h-full flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600' : 'bg-slate-100'}`}>
                                            {isSelected ? <Check size={32} className="text-white" /> : <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${staff.avatarSeed}&backgroundColor=e0e7ff`} className="opacity-50" />}
                                        </div>
                                    ) : (
                                        <>
                                            <img 
                                                src={staff.customAvatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${staff.avatarSeed}&backgroundColor=e0e7ff`} 
                                                alt={staff.name}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover/avatar:scale-105"
                                            />
                                            {/* Camera Upload Overlay */}
                                            <div 
                                                onClick={(e) => handleAvatarClick(staff.id, e)}
                                                className="absolute inset-0 rounded-full bg-slate-900/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer backdrop-blur-[1px] border-4 border-transparent"
                                            >
                                                <Camera size={20} className="text-white drop-shadow-md" />
                                            </div>
                                        </>
                                    )}
                                </div>

                                {staff.flaggedStudents > 0 && !isSelectionMode && (
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-rose-500 text-white rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-sm animate-pulse pointer-events-none" title={`${staff.flaggedStudents} Flagged Students`}>
                                        {staff.flaggedStudents}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => !isSelectionMode && handleAction('View Profile', staff.name)}>
                                    {staff.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${getRoleBadgeStyle(staff.role)}`}>
                                        {staff.role}
                                    </span>
                                    {staff.grade && <span className="text-xs text-slate-500 font-medium border border-slate-100 px-1.5 py-0.5 rounded bg-slate-50">{staff.grade}</span>}
                                    {isInterventionist ? (
                                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
                                        Interventionist{interventionFocus.length > 0 ? `: ${interventionFocus.join(' + ')}` : ''}
                                      </span>
                                    ) : null}
                                </div>
                            </div>
                            </div>
                            {!isSelectionMode && (
                                <button className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
                                    <MoreHorizontal size={20} />
                                </button>
                            )}
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div 
                                onClick={(e) => { e.stopPropagation(); setSortBy('Caseload'); }}
                                className={`flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100/50 group-hover:border-indigo-100/50 transition-all cursor-pointer hover:bg-indigo-50/30 hover:shadow-inner ${sortBy === 'Caseload' ? 'ring-1 ring-indigo-200 bg-indigo-50/30' : ''}`}
                                title="Click to sort by Caseload"
                            >
                                <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${sortBy === 'Caseload' ? 'text-indigo-600' : 'text-slate-500'}`}>Caseload</span>
                                <div className="flex items-center gap-2">
                                    <Users size={16} className={`${sortBy === 'Caseload' ? 'text-indigo-600' : 'text-indigo-500'}`} />
                                    <span className="text-xl font-bold text-slate-900">{staff.studentCount}</span>
                                    <span className="text-[10px] text-slate-400">students</span>
                                </div>
                            </div>
                            <div 
                                onClick={(e) => { e.stopPropagation(); setSortBy('Attendance'); }}
                                className={`flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100/50 group-hover:border-indigo-100/50 transition-all cursor-pointer hover:bg-indigo-50/30 hover:shadow-inner ${sortBy === 'Attendance' ? 'ring-1 ring-indigo-200 bg-indigo-50/30' : ''}`}
                                title="Click to sort by Attendance"
                            >
                                <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${sortBy === 'Attendance' ? 'text-indigo-600' : 'text-slate-500'}`}>Attendance</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xl font-bold ${staff.attendanceRate >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {staff.attendanceRate}%
                                    </span>
                                    <div className={`w-1.5 h-1.5 rounded-full ${staff.attendanceRate >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                </div>
                            </div>
                        </div>
                        
                        {/* Performance Text */}
                        <div className="flex items-center gap-2 mb-1 py-1 px-2 rounded-lg bg-indigo-50/50 border border-indigo-50">
                            <TrendingUp size={14} className="text-indigo-500" /> 
                            <span className="text-xs font-semibold text-slate-600">Performance:</span>
                            <span className="text-xs font-bold text-slate-800">{staff.performanceMetric}</span>
                        </div>
                        {canManageInterventionists && staff.role === 'Teacher' && !isSelectionMode ? (
                          <div
                            className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Interventionist Tags</p>
                              <span className="text-[10px] font-semibold text-slate-500">
                                {interventionFocus.length > 0 ? interventionFocus.join(' + ') : 'None'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {INTERVENTION_FOCUSES.map((focus) => {
                                const selected = interventionFocus.includes(focus);
                                return (
                                  <button
                                    key={focus}
                                    type="button"
                                    onClick={() => handleToggleInterventionFocus(staff, focus)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                                      selected
                                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'
                                    }`}
                                  >
                                    {focus === 'Reading' ? <BookOpen size={12} /> : <Calculator size={12} />}
                                    {focus}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        </div>

                        {/* Enhanced Fidelity Progress Section */}
                        <div 
                            className="relative"
                            onMouseEnter={() => setHoveredFidelityId(staff.id)}
                            onMouseLeave={() => setHoveredFidelityId(null)}
                        >
                            {/* Main Bar View */}
                            <div 
                                onClick={(e) => { e.stopPropagation(); setSortBy('Fidelity'); }}
                                className={`px-6 py-4 bg-slate-50/50 flex-1 border-t border-slate-100 cursor-pointer hover:bg-indigo-50/10 transition-colors relative z-10 ${sortBy === 'Fidelity' ? 'bg-indigo-50/20' : ''}`}
                                title="Click to sort by Fidelity"
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-xs font-semibold flex items-center gap-1.5 ${sortBy === 'Fidelity' ? 'text-indigo-700' : 'text-slate-600'}`}>
                                        <ClipboardList size={14} className={sortBy === 'Fidelity' ? 'text-indigo-500' : 'text-slate-400'} /> 
                                        MTSS Fidelity Score
                                        <Info size={12} className="text-slate-300" />
                                    </span>
                                    <span className={`text-xs font-bold ${fidelityStyles.text}`}>
                                        {staff.mtssFidelityScore}%
                                    </span>
                                </div>
                                <div className={`w-full h-2.5 rounded-full overflow-hidden ${fidelityStyles.track}`}>
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ${fidelityStyles.bar}`}
                                        style={{ width: `${staff.mtssFidelityScore}%` }}
                                    />
                                </div>
                            </div>

                            {/* Breakdown Overlay (Visible on Hover) */}
                            <div className={`absolute inset-0 bg-white z-20 border-t border-slate-100 flex flex-col justify-center px-6 transition-all duration-300 ease-in-out ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    {breakdown.map((metric, i) => (
                                        <div key={i} className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                                                    <metric.icon size={10} className="text-slate-400" />
                                                    {metric.label}
                                                </span>
                                                <span className={`text-[10px] font-bold ${metric.text}`}>{metric.value}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${metric.color}`}
                                                    style={{ width: `${metric.value}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions - Quick Actions */}
                        {!isSelectionMode && (
                            <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl space-y-3 relative z-30">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Actions</span>
                                    <div 
                                        onClick={(e) => { e.stopPropagation(); setSortBy('Interventions'); }}
                                        className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border transition-all cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 ${sortBy === 'Interventions' ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-slate-500 bg-slate-50 border-slate-100'}`}
                                        title="Click to sort by Active Plans"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                        {staff.activeInterventions} Active Plans
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => handleAction('Email', staff.name)}
                                        className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm group/btn"
                                    >
                                        <Mail size={14} className="text-slate-400 group-hover/btn:text-indigo-500 transition-colors" /> 
                                        Email Staff
                                    </button>
                                    <button 
                                        onClick={() => handleAction('View Details', staff.name)}
                                        className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700 hover:shadow-md transition-all shadow-sm group/btn"
                                    >
                                        View Details <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    )})
                )}
            </div>
          </>
      )}

      {/* STUDENT ROSTER VIEW */}
      {activeTab === 'students' && (
          <StudentRosterView 
            onMenuClick={onMenuClick}
            onStudentClick={onStudentClick || ((name) => console.log(name))}
            currentUserRole={currentUserRole}
            viewType={currentUserRole === UserRole.TEACHER ? "classroom" : "master"}
            embedded={true} 
            onNavigate={onNavigate}
          />
      )}
    </div>
  );
};
