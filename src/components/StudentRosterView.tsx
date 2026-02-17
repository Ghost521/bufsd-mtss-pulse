
import React, { useState, useMemo, useEffect } from 'react';
import { CLASS_ROSTER_DATA, generateMasterRoster, TEACHERS } from '../constants';
import { Tier } from '../types';
import { 
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Check,
  Menu,
  AlertCircle,
  Clock,
  LayoutGrid,
  List as ListIcon,
  GraduationCap,
  Users,
  TrendingUp,
  X,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  ShieldAlert,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Pencil,
  UserPlus,
  Trash2,
  Archive,
  Download,
  Upload
} from 'lucide-react';
import { ReferralModal } from './ReferralModal';
import { DraggableModal } from './DraggableModal';
import type { WorkspacePageId } from '../lib/workspaceRoutes';

interface StudentRosterViewProps {
  onMenuClick: () => void;
  onStudentClick: (name: string) => void;
  viewType?: 'classroom' | 'master';
  embedded?: boolean; // New prop to hide header if nested
  onNavigate?: (page: WorkspacePageId) => void;
}

// Extended type for local view handling
interface ExtendedStudent {
    id: string;
    name: string;
    grade: string;
    tier: Tier;
    gpa: string;
    attendance: number;
    readingLevel: string;
    activeInterventions: number;
    alerts: number;
    avatarSeed: string;
    teacher: string;
    status: 'Active' | 'Monitoring';
}

const READING_LEVELS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
type SortBy = 'Name' | 'GPA' | 'Attendance' | 'Alerts' | 'Tier' | 'Reading';
const SORT_OPTIONS: SortBy[] = ['Name', 'GPA', 'Attendance', 'Alerts', 'Tier', 'Reading'];

export const StudentRosterView: React.FC<StudentRosterViewProps> = ({ 
  onMenuClick, 
  onStudentClick,
  viewType = 'classroom',
  embedded = false,
  onNavigate
}) => {
  // Initialize state with enriched data (Teacher & Status)
  const [students, setStudents] = useState<ExtendedStudent[]>(() => {
      const rawData = viewType === 'master' ? generateMasterRoster() : CLASS_ROSTER_DATA;
      return rawData.map((s, i) => ({
          ...s,
          // deterministic mock assignment
          teacher: TEACHERS[i % TEACHERS.length], 
          status: s.activeInterventions > 0 ? 'Active' : 'Monitoring'
      }));
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [teacherFilter, setTeacherFilter] = useState<string>('All');
  
  const [sortBy, setSortBy] = useState<SortBy>('Name');
  const [sortDesc, setSortDesc] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Referral Modal State
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralStudentId, setReferralStudentId] = useState('');

  // Attendance Mode State
  const [isAttendanceMode, setIsAttendanceMode] = useState(false);
  const [attendanceState, setAttendanceState] = useState<Record<string, 'Present' | 'Absent' | 'Late'>>({});
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);

  // Bulk Edit / Selection State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<ExtendedStudent | null>(null);

  // Add Student State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [newStudentData, setNewStudentData] = useState({
      firstName: '',
      lastName: '',
      studentId: '',
      grade: '4th',
      tier: Tier.TIER_1,
      readingLevel: 'C',
      gpa: '3.0'
  });

  // Effect to update students if viewType prop changes
  useEffect(() => {
    const rawData = viewType === 'master' ? generateMasterRoster() : CLASS_ROSTER_DATA;
    setStudents(rawData.map((s, i) => ({
        ...s,
        teacher: TEACHERS[i % TEACHERS.length],
        status: s.activeInterventions > 0 ? 'Active' : 'Monitoring'
    })));
  }, [viewType]);

  // --- Derived Data ---
  const classStats = useMemo(() => {
    const total = students.length;
    const atRisk = students.filter(s => s.tier !== Tier.TIER_1).length;
    const avgAttendance = Math.round(students.reduce((acc, s) => acc + s.attendance, 0) / total) || 0;
    const avgGpa = total > 0 ? (students.reduce((acc, s) => acc + parseFloat(s.gpa), 0) / total).toFixed(1) : "0.0";
    
    return { total, atRisk, avgAttendance, avgGpa };
  }, [students]);

  const filteredAndSortedStudents = useMemo(() => {
    let result = [...students];

    // Search
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(s => 
            s.name.toLowerCase().includes(q) || 
            s.teacher.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q)
        );
    }

    // Filters
    if (tierFilter !== 'All') {
        result = result.filter(s => s.tier === tierFilter);
    }
    if (statusFilter !== 'All') {
        result = result.filter(s => s.status === statusFilter);
    }
    if (teacherFilter !== 'All') {
        result = result.filter(s => s.teacher === teacherFilter);
    }

    // Sort
    result.sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';

        switch (sortBy) {
            case 'GPA': 
                valA = parseFloat(a.gpa);
                valB = parseFloat(b.gpa);
                break;
            case 'Attendance': 
                valA = a.attendance; 
                valB = b.attendance; 
                break;
            case 'Alerts': 
                valA = a.alerts; 
                valB = b.alerts; 
                break;
            case 'Tier':
                // Custom tier sorting (Tier 3 > Tier 2 > Tier 1)
                const tierWeight = { [Tier.TIER_3]: 3, [Tier.TIER_2]: 2, [Tier.TIER_1]: 1 };
                valA = tierWeight[a.tier];
                valB = tierWeight[b.tier];
                break;
            case 'Reading':
                valA = a.readingLevel;
                valB = b.readingLevel;
                break;
            case 'Name': 
            default: 
                valA = a.name; 
                valB = b.name; 
                break;
        }

        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
    });

    return result;
  }, [students, searchQuery, tierFilter, statusFilter, teacherFilter, sortBy, sortDesc]);

  const activeFilterCount = [
      tierFilter !== 'All',
      statusFilter !== 'All',
      teacherFilter !== 'All'
  ].filter(Boolean).length;

  const clearFilters = () => {
      setTierFilter('All');
      setStatusFilter('All');
      setTeacherFilter('All');
      setSearchQuery('');
  };

  // --- Handlers ---
  const handleHeaderSort = (column: typeof sortBy) => {
      if (sortBy === column) {
          setSortDesc(!sortDesc);
      } else {
          setSortBy(column);
          setSortDesc(false); // Default to ascending for new column
      }
  };

  const renderSortIcon = (column: typeof sortBy) => {
      if (sortBy !== column) return <ArrowUpDown size={14} className="opacity-30 ml-1" />;
      return sortDesc ? <ArrowDown size={14} className="text-indigo-600 ml-1" /> : <ArrowUp size={14} className="text-indigo-600 ml-1" />;
  };

  // Attendance Handlers
  const handleStartAttendance = () => {
    setIsBulkMode(false); // Can't be in both
    const initial: Record<string, 'Present' | 'Absent' | 'Late'> = {};
    // Initialize all visible students to Present by default
    filteredAndSortedStudents.forEach(s => {
        initial[s.id] = 'Present';
    });
    setAttendanceState(initial);
    setIsAttendanceMode(true);
  };

  const handleMarkAttendance = (id: string, status: 'Present' | 'Absent' | 'Late', e?: React.MouseEvent) => {
      e?.stopPropagation();
      setAttendanceState(prev => ({...prev, [id]: status}));
  };

  const handleSubmitAttendance = () => {
      setIsSubmittingAttendance(true);
      // Simulate API call
      setTimeout(() => {
          setIsSubmittingAttendance(false);
          setIsAttendanceMode(false);
          // In a real app, you would save this data
          console.log("Attendance Submitted:", attendanceState);
      }, 1500);
  };

  // Bulk Selection Handlers
  const handleToggleBulkMode = () => {
      if (isBulkMode) {
          setIsBulkMode(false);
          setSelectedIds(new Set());
      } else {
          setIsAttendanceMode(false); // Ensure unique mode
          setIsBulkMode(true);
      }
  };

  const handleSelectStudent = (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
      if (selectedIds.size === filteredAndSortedStudents.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredAndSortedStudents.map(s => s.id)));
      }
  };

  const handleBulkDelete = () => {
      if (window.confirm(`Are you sure you want to remove ${selectedIds.size} students from the roster?`)) {
          setStudents(prev => prev.filter(s => !selectedIds.has(s.id)));
          setSelectedIds(new Set());
          setIsBulkMode(false);
      }
  };

  // --- Edit/Add Handlers ---
  const handleSaveStudent = () => {
      if (!editingStudent) return;
      
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? editingStudent : s));
      setEditingStudent(null);
  };

  const handleAddNewStudent = () => {
      const fullName = `${newStudentData.firstName} ${newStudentData.lastName}`.trim();
      if (!fullName) return;

      const newStudent: ExtendedStudent = {
          id: newStudentData.studentId || `STU-${Math.floor(Math.random() * 10000)}`,
          name: fullName,
          grade: newStudentData.grade,
          tier: newStudentData.tier,
          gpa: newStudentData.gpa,
          attendance: 100, // Default for new
          readingLevel: newStudentData.readingLevel,
          activeInterventions: newStudentData.tier === Tier.TIER_1 ? 0 : 1, // Default logic
          alerts: 0,
          avatarSeed: fullName.replace(/ /g, ''),
          teacher: 'Mr. Davis', // Default
          status: 'Active'
      };

      setStudents(prev => [newStudent, ...prev]);
      setIsAddStudentModalOpen(false);
      // Reset
      setNewStudentData({
          firstName: '',
          lastName: '',
          studentId: '',
          grade: '4th',
          tier: Tier.TIER_1,
          readingLevel: 'C',
          gpa: '3.0'
      });
  };

  // --- Style Helpers ---
  const getTierStyles = (tier: Tier) => {
    switch (tier) {
        case Tier.TIER_1: return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
        case Tier.TIER_2: return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', bar: 'bg-amber-500' };
        case Tier.TIER_3: return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', bar: 'bg-rose-500' };
        default: return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500', bar: 'bg-slate-500' };
    }
  };

  const handleQuickAction = (e: React.MouseEvent, action: string, student: ExtendedStudent) => {
      e.stopPropagation();
      if (action === 'Referral') {
          setReferralStudentId(student.id);
          setIsReferralModalOpen(true);
      } else if (action === 'Edit') {
          setEditingStudent(student);
      } else {
          alert(`${action} for ${student.name}`);
      }
  };

  const handleOpenNewReferral = () => {
      setReferralStudentId(''); // Reset so user picks student
      setIsReferralModalOpen(true);
  };

  return (
    <div className={`animate-in fade-in slide-in-from-bottom-4 duration-500 ${embedded ? '' : 'pb-20'} space-y-6 relative`}>
        
        {/* Floating Bulk Action Bar */}
        {isBulkMode && selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-4 zoom-in-95">
                <span className="font-bold text-sm">{selectedIds.size} Selected</span>
                <div className="h-4 w-px bg-white/20"></div>
                <button onClick={handleBulkDelete} className="flex items-center gap-2 hover:text-rose-400 transition-colors text-sm font-medium">
                    <Trash2 size={16} /> Delete
                </button>
                <button className="flex items-center gap-2 hover:text-indigo-300 transition-colors text-sm font-medium">
                    <Archive size={16} /> Archive
                </button>
                <button className="flex items-center gap-2 hover:text-emerald-300 transition-colors text-sm font-medium">
                    <Download size={16} /> Export
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-2 p-1 hover:bg-white/20 rounded-full">
                    <X size={14} />
                </button>
            </div>
        )}

        <ReferralModal 
            isOpen={isReferralModalOpen}
            onClose={() => setIsReferralModalOpen(false)}
            defaultStudentId={referralStudentId}
            onViewQueue={() => {
              setIsReferralModalOpen(false);
              onNavigate?.('interventions');
            }}
        />

        {/* Edit Student Modal */}
        <DraggableModal
            isOpen={!!editingStudent}
            onClose={() => setEditingStudent(null)}
            title="Edit Student Details"
            initialWidth={500}
            initialHeight={450}
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <button 
                        onClick={() => setEditingStudent(null)}
                        className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveStudent}
                        className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Save size={16} /> Save Changes
                    </button>
                </div>
            }
        >
            {editingStudent && (
                <div className="p-6 space-y-5">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-16 h-16 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                            <img 
                                src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${editingStudent.avatarSeed}&backgroundColor=e0e7ff`} 
                                alt={editingStudent.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{editingStudent.name}</h3>
                            <p className="text-sm text-slate-500">{editingStudent.id} • Grade {editingStudent.grade}</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Support Tier</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[Tier.TIER_1, Tier.TIER_2, Tier.TIER_3].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setEditingStudent({...editingStudent, tier: t})}
                                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                                        editingStudent.tier === t 
                                            ? t === Tier.TIER_1 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                            : t === Tier.TIER_2 ? 'border-amber-500 bg-amber-50 text-amber-700'
                                            : 'border-rose-500 bg-rose-50 text-rose-700'
                                            : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Reading Level (F&P)</label>
                        <select 
                            value={editingStudent.readingLevel}
                            onChange={(e) => setEditingStudent({...editingStudent, readingLevel: e.target.value})}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                            {READING_LEVELS.map(level => (
                                <option key={level} value={level}>Level {level}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </DraggableModal>

        {/* Add Student Modal */}
        <DraggableModal
            isOpen={isAddStudentModalOpen}
            onClose={() => setIsAddStudentModalOpen(false)}
            title="Add New Student"
            initialWidth={600}
            initialHeight={600}
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <button 
                        onClick={() => setIsAddStudentModalOpen(false)}
                        className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleAddNewStudent}
                        disabled={!newStudentData.firstName || !newStudentData.lastName}
                        className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserPlus size={16} /> Create Record
                    </button>
                </div>
            }
        >
            <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">First Name *</label>
                        <input 
                            type="text"
                            value={newStudentData.firstName}
                            onChange={(e) => setNewStudentData({...newStudentData, firstName: e.target.value})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="e.g. John"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Last Name *</label>
                        <input 
                            type="text"
                            value={newStudentData.lastName}
                            onChange={(e) => setNewStudentData({...newStudentData, lastName: e.target.value})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="e.g. Doe"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Student ID</label>
                    <input 
                        type="text"
                        value={newStudentData.studentId}
                        onChange={(e) => setNewStudentData({...newStudentData, studentId: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Optional (Auto-generated if empty)"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Grade Level</label>
                        <select 
                            value={newStudentData.grade}
                            onChange={(e) => setNewStudentData({...newStudentData, grade: e.target.value})}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                            {['K', '1st', '2nd', '3rd', '4th', '5th', '6th'].map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Initial GPA</label>
                        <input 
                            type="text"
                            value={newStudentData.gpa}
                            onChange={(e) => setNewStudentData({...newStudentData, gpa: e.target.value})}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="e.g. 3.0"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Initial Tier</label>
                    <div className="grid grid-cols-3 gap-3">
                        {[Tier.TIER_1, Tier.TIER_2, Tier.TIER_3].map(t => (
                            <button
                                key={t}
                                onClick={() => setNewStudentData({...newStudentData, tier: t})}
                                className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                                    newStudentData.tier === t 
                                        ? t === Tier.TIER_1 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                        : t === Tier.TIER_2 ? 'border-amber-500 bg-amber-50 text-amber-700'
                                        : 'border-rose-500 bg-rose-50 text-rose-700'
                                        : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Reading Level (F&P)</label>
                    <select 
                        value={newStudentData.readingLevel}
                        onChange={(e) => setNewStudentData({...newStudentData, readingLevel: e.target.value})}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                        {READING_LEVELS.map(level => (
                            <option key={level} value={level}>Level {level}</option>
                        ))}
                    </select>
                </div>
            </div>
        </DraggableModal>

        {/* Header & Stats */}
        <div className="flex flex-col gap-6">
            {!embedded && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onMenuClick}
                            className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <Menu size={24} />
                        </button>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                                {viewType === 'master' ? 'Monitored Student Cases' : 'My Classroom'}
                            </h2>
                            <p className="text-slate-500 mt-1">
                                {viewType === 'master' ? 'School-Wide • Active Interventions' : '4th Grade • Room 204'}
                            </p>
                        </div>
                    </div>
                    {/* Header Action Buttons (Import) */}
                    <button 
                        onClick={() => onNavigate && onNavigate('import')}
                        className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-indigo-600 font-bold text-sm transition-all"
                    >
                        <Upload size={16} /> Import Roster
                    </button>
                </div>
            )}
            
            {/* Controls Row (View Toggle & Actions) - Shown even when embedded */}
            <div className="flex flex-wrap md:flex-nowrap justify-between items-center gap-3">
               <div className="flex items-center gap-3">
                   {embedded && (
                       <div className="text-sm font-bold text-slate-500 flex items-center gap-2 mr-2">
                           <Users size={16} /> {classStats.total} Students
                       </div>
                   )}
                   
                   {/* Bulk Actions Dropdown */}
                   <div className="relative group">
                       <button 
                           onClick={handleToggleBulkMode}
                           className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border transition-all ${isBulkMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'}`}
                       >
                           {isBulkMode ? <X size={16} /> : <CheckCircle2 size={16} />}
                           {isBulkMode ? 'Cancel Selection' : 'Bulk Actions'}
                       </button>
                   </div>
               </div>

               <div className="flex gap-2 ml-auto">
                    {isAttendanceMode ? (
                        <>
                            <button 
                                onClick={() => setIsAttendanceMode(false)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                                disabled={isSubmittingAttendance}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSubmitAttendance}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-all active:scale-95"
                                disabled={isSubmittingAttendance}
                            >
                                {isSubmittingAttendance ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                <span>Submit</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => setIsAddStudentModalOpen(true)}
                                className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm"
                            >
                                <UserPlus size={18} />
                                <span>New Student</span>
                            </button>
                            <button 
                                onClick={handleStartAttendance}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm"
                            >
                                <ClipboardCheck size={18} />
                                <span className="hidden sm:inline">Attendance</span>
                            </button>
                            <button 
                                onClick={handleOpenNewReferral}
                                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all active:scale-95 hover:shadow-lg"
                            >
                                <ShieldAlert size={18} />
                                <span className="hidden sm:inline">Referral</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* KPI Stats Cards - Only show if not embedded */}
            {!isAttendanceMode && !embedded && !isBulkMode && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Students</span>
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform"><Users size={16} /></div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{classStats.total}</span>
                        <span className="text-xs text-slate-500">{viewType === 'master' ? 'monitored' : 'enrolled'}</span>
                    </div>
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-rose-200 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">At Risk (Tier 2/3)</span>
                        <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:scale-110 transition-transform"><AlertCircle size={16} /></div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-rose-600">{classStats.atRisk}</span>
                        <div className="h-1.5 flex-1 bg-rose-100 rounded-full ml-2 overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{width: `${(classStats.atRisk/classStats.total)*100}%`}}></div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attendance Avg</span>
                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform"><Clock size={16} /></div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-emerald-600">{classStats.avgAttendance}%</span>
                        <span className="text-xs text-emerald-600/80 font-medium flex items-center gap-1"><TrendingUp size={12} /> +1.2%</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-200 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average GPA</span>
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform"><GraduationCap size={16} /></div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-blue-600">{classStats.avgGpa}</span>
                        <span className="text-xs text-slate-500">/ 4.0 scale</span>
                    </div>
                </div>
            </div>
            )}
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex gap-3 flex-1">
                    {/* Select All Checkbox (Bulk Mode) */}
                    {isBulkMode && (
                        <button 
                            onClick={handleSelectAll}
                            className={`p-2.5 rounded-lg border transition-all shrink-0 ${selectedIds.size === filteredAndSortedStudents.length && filteredAndSortedStudents.length > 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-300 hover:border-indigo-300'}`}
                            title="Select All"
                        >
                            <Check size={18} />
                        </button>
                    )}

                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search students, ID, or teacher..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-transparent text-sm focus:outline-none text-slate-700 placeholder:text-slate-400"
                        />
                    </div>
                    
                    {!isAttendanceMode && !isBulkMode && (
                        <div className="hidden md:flex items-center gap-2">
                            <button 
                                onClick={() => setTierFilter(tierFilter === Tier.TIER_3 ? 'All' : Tier.TIER_3)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${tierFilter === Tier.TIER_3 ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-200 hover:text-rose-600'}`}
                            >
                                Tier 3 Only
                            </button>
                            <button 
                                onClick={() => setTierFilter(tierFilter === Tier.TIER_2 ? 'All' : Tier.TIER_2)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${tierFilter === Tier.TIER_2 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-200 hover:text-amber-600'}`}
                            >
                                Tier 2 Only
                            </button>
                        </div>
                    )}

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block self-center"></div>

                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${showFilters ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'hover:bg-slate-50 text-slate-600 border-slate-200'}`}
                    >
                        <Filter size={16} />
                        <span>Filter</span>
                        {activeFilterCount > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-1">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                    {/* Sort */}
                    <div className="relative flex items-center gap-2">
                        <div className="relative">
                            <button 
                                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-600 transition-all whitespace-nowrap"
                            >
                                <ArrowUpDown size={16} />
                                <span>Sort: {sortBy}</span>
                            </button>
                            {isSortMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsSortMenuOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-100 rounded-xl shadow-lg z-20 p-1 animate-in fade-in zoom-in-95 origin-top-right">
                                        {SORT_OPTIONS.map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => { setSortBy(s); setIsSortMenuOpen(false); setSortDesc(false); }}
                                                className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between ${sortBy === s ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                {s}
                                                {sortBy === s && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <button 
                            onClick={() => setSortDesc(!sortDesc)}
                            className={`p-2 rounded-lg border transition-all ${sortDesc ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}
                            title={sortDesc ? "Descending" : "Ascending"}
                        >
                            {sortDesc ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

                    {/* View Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="List View"
                        >
                            <ListIcon size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Collapsible Filters Row */}
            {showFilters && (
                <div className="flex flex-wrap gap-4 pt-2 animate-in slide-in-from-top-2 border-t border-slate-100 mt-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tier Level</label>
                        <select 
                            value={tierFilter}
                            onChange={(e) => setTierFilter(e.target.value)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            <option value="All">All Tiers</option>
                            <option value={Tier.TIER_1}>{Tier.TIER_1}</option>
                            <option value={Tier.TIER_2}>{Tier.TIER_2}</option>
                            <option value={Tier.TIER_3}>{Tier.TIER_3}</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Active">Active (Ongoing)</option>
                            <option value="Monitoring">Monitoring (Completed)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teacher</label>
                        <select 
                            value={teacherFilter}
                            onChange={(e) => setTeacherFilter(e.target.value)}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 cursor-pointer"
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

        {/* GRID VIEW */}
        {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {filteredAndSortedStudents.length === 0 ? (
                    <div className="col-span-full py-12 flex flex-col items-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Search size={48} className="mb-2 opacity-50" />
                        <p className="font-medium">No students found.</p>
                        <button onClick={clearFilters} className="text-indigo-600 text-sm hover:underline mt-2 font-bold">Clear Filters</button>
                    </div>
                ) : (
                    filteredAndSortedStudents.map((student) => {
                        const tierStyles = getTierStyles(student.tier);
                        const attendanceStatus = attendanceState[student.id];
                        const isSelected = selectedIds.has(student.id);

                        return (
                            <div 
                                key={student.id} 
                                onClick={() => {
                                    if (isBulkMode) handleSelectStudent(student.id);
                                    else if (!isAttendanceMode) onStudentClick(student.name);
                                }}
                                className={`bg-white rounded-2xl border shadow-sm transition-all duration-300 group relative flex flex-col overflow-hidden ${isAttendanceMode || isBulkMode ? 'cursor-pointer' : 'cursor-pointer hover:shadow-lg hover:border-indigo-100 hover:-translate-y-1'} ${isAttendanceMode && attendanceStatus === 'Absent' ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'} ${isBulkMode && isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/10' : ''}`}
                            >
                                {/* Left Accent Bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${tierStyles.bar}`} />

                                <div className="p-5 pl-6 flex flex-col h-full">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3.5">
                                            {isBulkMode ? (
                                                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300 border-2 border-slate-200'}`}>
                                                    {isSelected ? <Check size={24} /> : <div className="w-14 h-14 rounded-full overflow-hidden opacity-50"><img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${student.avatarSeed}&backgroundColor=e0e7ff`} className="w-full h-full object-cover"/></div>}
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <div className="w-14 h-14 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden ring-1 ring-slate-100">
                                                        <img 
                                                            src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${student.avatarSeed}&backgroundColor=e0e7ff`} 
                                                            alt={student.name}
                                                            className="w-full h-full object-cover transform transition-transform group-hover:scale-110"
                                                        />
                                                    </div>
                                                    <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border border-white shadow-sm text-white ${tierStyles.bg.replace('50', '500')}`}>
                                                        {student.tier.replace('Tier ', 'T')}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div>
                                                <h3 className={`font-bold group-hover:text-indigo-600 transition-colors text-lg leading-tight ${isAttendanceMode && attendanceStatus === 'Absent' ? 'text-rose-700' : 'text-slate-900'}`}>{student.name}</h3>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">{student.id}</p>
                                                {viewType === 'master' && <p className="text-xs text-slate-500 mt-0.5 font-medium truncate max-w-[120px]">{student.teacher}</p>}
                                            </div>
                                        </div>
                                        {student.alerts > 0 && !isAttendanceMode && !isBulkMode && (
                                            <div className="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg border border-rose-100 flex items-center gap-1 shadow-sm animate-pulse">
                                                <AlertCircle size={14} />
                                                <span className="text-xs font-bold">{student.alerts}</span>
                                            </div>
                                        )}
                                        {isAttendanceMode && (
                                            <div className={`text-xs font-bold px-2 py-1 rounded border ${attendanceStatus === 'Absent' ? 'bg-rose-100 text-rose-700 border-rose-200' : attendanceStatus === 'Late' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                                {attendanceStatus || 'Present'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-3 gap-3 mb-5">
                                        <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">GPA</span>
                                            <span className={`text-sm font-bold ${parseFloat(student.gpa) < 2.5 ? 'text-rose-600' : 'text-slate-700'}`}>{student.gpa}</span>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Attend</span>
                                            <span className={`text-sm font-bold ${student.attendance < 90 ? 'text-rose-600' : 'text-emerald-600'}`}>{student.attendance}%</span>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Reading</span>
                                            <span className="text-sm font-bold text-indigo-600">{student.readingLevel}</span>
                                        </div>
                                    </div>

                                    {/* Footer / Quick Actions / Attendance Toggle */}
                                    {isAttendanceMode ? (
                                        <div className="mt-auto grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                                            <button 
                                                onClick={(e) => handleMarkAttendance(student.id, 'Present', e)}
                                                className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${attendanceStatus === 'Present' ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-200' : 'bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                                            >
                                                <CheckCircle2 size={16} /> Present
                                            </button>
                                            <button 
                                                onClick={(e) => handleMarkAttendance(student.id, 'Late', e)}
                                                className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${attendanceStatus === 'Late' ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-200' : 'bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600'}`}
                                            >
                                                <Clock size={16} /> Late
                                            </button>
                                            <button 
                                                onClick={(e) => handleMarkAttendance(student.id, 'Absent', e)}
                                                className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${attendanceStatus === 'Absent' ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-200' : 'bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600'}`}
                                            >
                                                <XCircle size={16} /> Absent
                                            </button>
                                        </div>
                                    ) : !isBulkMode && (
                                        <div className="mt-auto flex gap-2 pt-4 border-t border-slate-100 opacity-100 md:opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => handleQuickAction(e, 'Edit', student)}
                                                className="flex-1 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <Pencil size={14} /> Edit
                                            </button>
                                            <button 
                                                onClick={(e) => handleQuickAction(e, 'Referral', student)}
                                                className="flex-1 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <ShieldAlert size={14} /> Refer
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        )}

        {/* LIST VIEW */}
        {viewMode === 'list' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                            <th 
                                className="px-6 py-4 font-bold cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                                onClick={() => handleHeaderSort('Name')}
                            >
                                <div className="flex items-center gap-1">Student Name {renderSortIcon('Name')}</div>
                            </th>
                            {viewType === 'master' && (
                                <th className="px-4 py-4 hidden md:table-cell">Teacher</th>
                            )}
                            <th 
                                className="px-4 py-4 cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                                onClick={() => handleHeaderSort('Tier')}
                            >
                                <div className="flex items-center gap-1">Tier {renderSortIcon('Tier')}</div>
                            </th>
                            <th 
                                className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors hidden sm:table-cell"
                                onClick={() => handleHeaderSort('GPA')}
                            >
                                <div className="flex items-center justify-center gap-1">GPA {renderSortIcon('GPA')}</div>
                            </th>
                            <th 
                                className="px-4 py-4 cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                                onClick={() => handleHeaderSort('Attendance')}
                            >
                                <div className="flex items-center gap-1">Attendance {renderSortIcon('Attendance')}</div>
                            </th>
                            <th 
                                className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100 hover:text-indigo-600 transition-colors hidden md:table-cell"
                                onClick={() => handleHeaderSort('Reading')}
                            >
                                <div className="flex items-center justify-center gap-1">Reading {renderSortIcon('Reading')}</div>
                            </th>
                            <th className="px-4 py-4 text-right">
                                {isAttendanceMode ? "Today's Status" : "Actions"}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredAndSortedStudents.map((student) => {
                            const tierStyles = getTierStyles(student.tier);
                            const attendanceStatus = attendanceState[student.id];
                            const isSelected = selectedIds.has(student.id);

                            return (
                                <tr 
                                    key={student.id} 
                                    onClick={() => {
                                        if (isBulkMode) handleSelectStudent(student.id);
                                        else if (!isAttendanceMode) onStudentClick(student.name);
                                    }}
                                    className={`transition-colors group ${isAttendanceMode ? (attendanceStatus === 'Absent' ? 'bg-rose-50/30' : '') : isBulkMode && isSelected ? 'bg-indigo-50/20' : 'hover:bg-indigo-50/30 cursor-pointer'}`}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden border border-slate-200 flex items-center justify-center">
                                                {isBulkMode ? (
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                                        {isSelected && <Check size={14} className="text-white" />}
                                                    </div>
                                                ) : (
                                                    <img 
                                                        src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${student.avatarSeed}&backgroundColor=e0e7ff`} 
                                                        className="w-full h-full object-cover"
                                                        alt={student.name}
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <p className={`font-bold transition-colors ${isAttendanceMode && attendanceStatus === 'Absent' ? 'text-rose-700' : 'text-slate-800 group-hover:text-indigo-600'}`}>{student.name}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">{student.id}</p>
                                            </div>
                                            {student.alerts > 0 && !isAttendanceMode && (
                                                <AlertCircle size={14} className="text-rose-500 animate-pulse ml-1" />
                                            )}
                                        </div>
                                    </td>
                                    {viewType === 'master' && (
                                        <td className="px-4 py-4 font-medium text-slate-600 hidden md:table-cell">
                                            {student.teacher}
                                        </td>
                                    )}
                                    <td className="px-4 py-4">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${tierStyles.bg} ${tierStyles.text} ${tierStyles.border}`}>
                                            {student.tier}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center font-medium text-slate-700 hidden sm:table-cell">{student.gpa}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                                                <div className={`h-full rounded-full ${student.attendance < 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{width: `${student.attendance}%`}}></div>
                                            </div>
                                            <span className={`font-bold text-xs ${student.attendance < 90 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {student.attendance}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center font-medium text-slate-700 hidden md:table-cell">{student.readingLevel}</td>
                                    <td className="px-4 py-4 text-right">
                                        {isAttendanceMode ? (
                                            <div className="flex items-center justify-end gap-1">
                                                <button 
                                                    onClick={(e) => handleMarkAttendance(student.id, 'Present', e)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${attendanceStatus === 'Present' ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                                                    title="Present"
                                                >
                                                    <CheckCircle2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleMarkAttendance(student.id, 'Late', e)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${attendanceStatus === 'Late' ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200' : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-600'}`}
                                                    title="Late"
                                                >
                                                    <Clock size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e) => handleMarkAttendance(student.id, 'Absent', e)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${attendanceStatus === 'Absent' ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-200' : 'bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600'}`}
                                                    title="Absent"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            </div>
                                        ) : !isBulkMode && (
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => handleQuickAction(e, 'Edit', student)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600" title="Edit"><Pencil size={16} /></button>
                                                <button onClick={(e) => handleQuickAction(e, 'Referral', student)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600" title="Refer"><ShieldAlert size={16} /></button>
                                                <MoreHorizontal className="text-slate-300 ml-1" size={16} />
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
};
