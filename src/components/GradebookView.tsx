
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Assignment, GradeEntry, AssignmentType } from '../constants';
import { CLASS_ROSTER_DATA, GLOBAL_ASSIGNMENTS, GLOBAL_GRADES, SUBJECTS } from '../constants';
import type { UserRole } from '../types';
import { Tier } from '../types';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { useStudents } from '../hooks/useStudents';
import { extractPastedCells, parseGradeInput, type ParsedGradeScore } from '../lib/gradebook-editing';
import { 
  Search, 
  Plus, 
  Download, 
  ChevronDown, 
  TrendingUp, 
  AlertCircle,
  BrainCircuit,
  Trash2,
  Calculator,
  CalendarDays,
  X,
  PieChart as PieChartIcon,
  Save,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  LayoutTemplate,
  Zap,
  FilePlus,
  Tag,
  MoreHorizontal,
  Settings,
  MessageSquare,
  Mail,
  Sparkles,
  Send,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { LineChart, Line, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { CustomDatePicker } from './CustomDatePicker';
import { generateParentMessage } from '../services/geminiService';
import { DraggableModal } from './DraggableModal';
import { SidebarToggleButton } from './SidebarToggleButton';

interface GradebookViewProps {
  onMenuClick: () => void;
  currentUserRole: UserRole;
}

// --- Constants ---
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']; // Indigo, Emerald, Amber, Pink

const WEIGHT_PRESETS: Record<string, Record<AssignmentType, number>> = {
  'Standard': { 'Homework': 20, 'Quiz': 30, 'Test': 30, 'Project': 20 },
  'Test Heavy': { 'Homework': 10, 'Quiz': 20, 'Test': 60, 'Project': 10 },
  'Project Based': { 'Homework': 10, 'Quiz': 10, 'Test': 20, 'Project': 60 }
};

type PersistedGradeEntry = GradeEntry & { id: string };
type CellSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const toGradeRowId = (studentId: string, assignmentId: string): string => `${studentId}::${assignmentId}`;

const toPersistedGradeEntry = (entry: GradeEntry): PersistedGradeEntry => ({
  id: toGradeRowId(entry.studentId, entry.assignmentId),
  studentId: entry.studentId,
  assignmentId: entry.assignmentId,
  score: entry.score,
});

const toCellKey = (studentId: string, assignmentId: string): string => `${studentId}::${assignmentId}`;

export const GradebookView: React.FC<GradebookViewProps> = ({ onMenuClick }) => {
  const assignmentCollection = useTenantCollection<Assignment>('gradebook-assignments');
  const gradeCollection = useTenantCollection<PersistedGradeEntry>('gradebook-grades');
  const studentsApi = useStudents('class');
  const seededAssignmentsRef = useRef(false);
  const seededGradesRef = useRef(false);

  // Data State
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades] = useState<PersistedGradeEntry[]>([]);
  
  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Q1');
  const [dateFilter, setDateFilter] = useState<'All' | '30Days' | '7Days'>('All');
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'average'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // Weighting State
  const [weights, setWeights] = useState<Record<AssignmentType, number>>({
    'Homework': 20,
    'Quiz': 30,
    'Test': 30,
    'Project': 20
  });
  const [showWeightsModal, setShowWeightsModal] = useState(false);
  const [tempWeights, setTempWeights] = useState(weights);

  // Add Assignment State
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false);
  const [newAssignmentData, setNewAssignmentData] = useState({
    title: '',
    type: 'Homework' as AssignmentType,
    date: new Date().toISOString().split('T')[0],
    maxPoints: 100,
    description: ''
  });

  // Interaction State
  const [activeCell, setActiveCell] = useState<{sId: string, aId: string} | null>(null);
  const [columnMenuId, setColumnMenuId] = useState<string | null>(null);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [cellSaveState, setCellSaveState] = useState<Record<string, CellSaveState>>({});
  const [lastEditedCell, setLastEditedCell] = useState<{
    studentId: string;
    assignmentId: string;
    previous: ParsedGradeScore;
    next: ParsedGradeScore;
  } | null>(null);
  const [mobileStudentId, setMobileStudentId] = useState<string | null>(null);
  const [mobileAssignmentId, setMobileAssignmentId] = useState<string | null>(null);
  
  // Missing Work Modal State
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [messageComposer, setMessageComposer] = useState<{ studentName: string; assignment: string; parentName: string } | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  // Refs for keyboard nav
  const gridRef = useRef<HTMLDivElement>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rosterStudents = useMemo(
    () => studentsApi.studentsQuery.data?.rows ?? CLASS_ROSTER_DATA,
    [studentsApi.studentsQuery.data?.rows]
  );

  const assignments = useMemo(() => {
    const subjectAssignments = allAssignments.filter((assignment) => assignment.subject === selectedSubject);
    subjectAssignments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return subjectAssignments;
  }, [allAssignments, selectedSubject]);

  useEffect(() => {
    const rows = assignmentCollection.query.data?.rows;
    if (!rows) return;
    if (rows.length > 0) seededAssignmentsRef.current = true;
    setAllAssignments(rows);
  }, [assignmentCollection.query.data?.rows]);

  useEffect(() => {
    if (seededAssignmentsRef.current) return;
    if (!assignmentCollection.query.isSuccess) return;
    const rows = assignmentCollection.query.data?.rows ?? [];
    if (rows.length > 0) {
      seededAssignmentsRef.current = true;
      return;
    }
    seededAssignmentsRef.current = true;
    assignmentCollection.replaceMutation.mutate(GLOBAL_ASSIGNMENTS);
  }, [assignmentCollection.query.isSuccess, assignmentCollection.query.data?.rows, assignmentCollection.replaceMutation]);

  useEffect(() => {
    const rows = gradeCollection.query.data?.rows;
    if (!rows) return;
    if (rows.length > 0) seededGradesRef.current = true;
    setGrades(rows);
  }, [gradeCollection.query.data?.rows]);

  useEffect(() => {
    if (seededGradesRef.current) return;
    if (!gradeCollection.query.isSuccess) return;
    const rows = gradeCollection.query.data?.rows ?? [];
    if (rows.length > 0) {
      seededGradesRef.current = true;
      return;
    }
    seededGradesRef.current = true;
    gradeCollection.replaceMutation.mutate(GLOBAL_GRADES.map(toPersistedGradeEntry));
  }, [gradeCollection.query.isSuccess, gradeCollection.query.data?.rows, gradeCollection.replaceMutation]);

  // Handle Click Outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.grade-cell') && !target.closest('.grade-popover')) {
            setActiveCell(null);
        }
        if (!target.closest('.column-header')) {
            setColumnMenuId(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Helpers & Calculation Logic ---

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  const queuePersistGrades = useCallback((nextRows: PersistedGradeEntry[], changedCellKeys: string[]) => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    setSaveStatus('saving');
    setCellSaveState((prev) => {
      const next = { ...prev };
      changedCellKeys.forEach((key) => {
        next[key] = 'saving';
      });
      return next;
    });

    persistTimerRef.current = setTimeout(() => {
      gradeCollection.replaceMutation.mutate(nextRows, {
        onSuccess: () => {
          setSaveStatus('saved');
          setCellSaveState((prev) => {
            const next = { ...prev };
            changedCellKeys.forEach((key) => {
              next[key] = 'saved';
            });
            return next;
          });

          setTimeout(() => {
            setSaveStatus((current) => (current === 'saved' ? 'idle' : current));
            setCellSaveState((prev) => {
              const next = { ...prev };
              changedCellKeys.forEach((key) => {
                if (next[key] === 'saved') next[key] = 'idle';
              });
              return next;
            });
          }, 1200);
        },
        onError: () => {
          setSaveStatus('error');
          setCellSaveState((prev) => {
            const next = { ...prev };
            changedCellKeys.forEach((key) => {
              next[key] = 'error';
            });
            return next;
          });
        },
      });
    }, 400);
  }, [gradeCollection.replaceMutation]);

  const upsertGradeRow = (
    rows: PersistedGradeEntry[],
    studentId: string,
    assignmentId: string,
    score: ParsedGradeScore,
  ): PersistedGradeEntry[] => {
    const existingIndex = rows.findIndex((grade) => grade.studentId === studentId && grade.assignmentId === assignmentId);
    if (existingIndex >= 0) {
      const next = [...rows];
      next[existingIndex] = { ...next[existingIndex], score };
      return next;
    }
    return [...rows, { id: toGradeRowId(studentId, assignmentId), studentId, assignmentId, score }];
  };

  const getScore = (studentId: string, assignmentId: string): ParsedGradeScore => {
    const score = grades.find((grade) => grade.studentId === studentId && grade.assignmentId === assignmentId)?.score;
    if (score === '' || score === undefined) return null;
    if (score === 'M' || score === 'E' || score === 'L' || score === null) return score;
    const parsed = Number(score);
    if (Number.isNaN(parsed)) return null;
    return parsed;
  };

  const applyParsedScore = (studentId: string, assignmentId: string, nextScore: ParsedGradeScore) => {
    const cellKey = toCellKey(studentId, assignmentId);
    const previous = getScore(studentId, assignmentId);
    if (previous === nextScore) return;

    setCellSaveState((prev) => ({ ...prev, [cellKey]: 'dirty' }));
    setLastEditedCell({ studentId, assignmentId, previous, next: nextScore });
    setSaveStatus('saving');
    setGrades((prev) => {
      const next = upsertGradeRow(prev, studentId, assignmentId, nextScore);
      queuePersistGrades(next, [cellKey]);
      return next;
    });
  };

  const handleScoreChange = (studentId: string, assignmentId: string, value: string) => {
    const parsed = parseGradeInput(value);
    if (parsed === undefined) return;
    applyParsedScore(studentId, assignmentId, parsed);
  };

  const handleUndoLastEdit = () => {
    if (!lastEditedCell) return;
    const { studentId, assignmentId, previous } = lastEditedCell;
    applyParsedScore(studentId, assignmentId, previous);
  };

  const handlePasteGrades = (event: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    const clipboardText = event.clipboardData.getData('text');
    if (!clipboardText || (!clipboardText.includes('\t') && !clipboardText.includes('\n'))) return;

    const pastedCells = extractPastedCells(
      clipboardText,
      rowIndex,
      colIndex,
      filteredAndSortedStudents.length,
      filteredAssignments.length,
    );
    if (pastedCells.length === 0) return;

    event.preventDefault();
    const changedKeys: string[] = [];
    setSaveStatus('saving');
    setGrades((prev) => {
      let next = [...prev];
      pastedCells.forEach((pastedCell) => {
        const student = filteredAndSortedStudents[pastedCell.row];
        const assignment = filteredAssignments[pastedCell.col];
        if (!student || !assignment) return;

        const key = toCellKey(student.id, assignment.id);
        changedKeys.push(key);
        next = upsertGradeRow(next, student.id, assignment.id, pastedCell.value);
      });
      queuePersistGrades(next, changedKeys);
      return next;
    });
  };

  const handleCreateAssignment = () => {
    if (!newAssignmentData.title) return;
    
    const newId = `asn-new-${Date.now()}`;
    const newAsn: Assignment = {
        id: newId,
        title: newAssignmentData.title,
        type: newAssignmentData.type,
        date: newAssignmentData.date,
        maxPoints: newAssignmentData.maxPoints,
        subject: selectedSubject,
        description: newAssignmentData.description
    };
    
    // Prepend assignment and persist full assignment collection
    setAllAssignments(prev => {
      const next = [newAsn, ...prev];
      assignmentCollection.replaceMutation.mutate(next);
      return next;
    });
    
    // Initialize empty grades for all students explicitly
    const newGradeEntries = rosterStudents.map(s => ({
        id: toGradeRowId(s.id, newId),
        studentId: s.id,
        assignmentId: newId,
        score: null
    }));
    setGrades(prev => {
      const next = [...prev, ...newGradeEntries];
      gradeCollection.replaceMutation.mutate(next);
      return next;
    });

    setShowAddAssignmentModal(false);
    setNewAssignmentData({
        title: '',
        type: 'Homework',
        date: new Date().toISOString().split('T')[0],
        maxPoints: 100,
        description: ''
    });
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    if (window.confirm("Are you sure you want to delete this assignment and all associated grades?")) {
      setAllAssignments(prev => {
        const next = prev.filter(a => a.id !== assignmentId);
        assignmentCollection.replaceMutation.mutate(next);
        return next;
      });
      setGrades(prev => {
        const next = prev.filter(g => g.assignmentId !== assignmentId);
        gradeCollection.replaceMutation.mutate(next);
        return next;
      });
      setColumnMenuId(null);
    }
  };

  const handleBulkMissing = (assignmentId: string) => {
    setGrades(prev => {
      const newGrades = [...prev];
      const changedCellKeys: string[] = [];
      rosterStudents.forEach(student => {
        const exists = newGrades.find(g => g.studentId === student.id && g.assignmentId === assignmentId);
        if (!exists || exists.score === null || exists.score === '') {
           if (exists) {
             exists.score = 'M';
           } else {
             newGrades.push({ id: toGradeRowId(student.id, assignmentId), studentId: student.id, assignmentId, score: 'M' });
           }
           changedCellKeys.push(toCellKey(student.id, assignmentId));
        }
      });
      queuePersistGrades(newGrades, changedCellKeys);
      return newGrades;
    });
    setColumnMenuId(null);
  };

  const calculateWeightedAverage = useCallback((studentId: string, assignmentScope: Assignment[]) => {
    const assignmentIdSet = new Set(assignmentScope.map((assignment) => assignment.id));
    const assignmentMap = new Map(assignmentScope.map((assignment) => [assignment.id, assignment]));
    const studentGrades = grades.filter(
      (grade) => grade.studentId === studentId && assignmentIdSet.has(grade.assignmentId),
    );
    
    let totalWeightedScore = 0;
    let totalWeightUsed = 0;

    const typeGroups: Record<string, number[]> = { 'Homework': [], 'Quiz': [], 'Test': [], 'Project': [] };

    studentGrades.forEach(g => {
      const asn = assignmentMap.get(g.assignmentId);
      if (asn && g.score !== null && g.score !== 'E') {
        let val = 0;
        if (g.score === 'M' || g.score === 'L') val = 0;
        else {
            val = parseFloat(String(g.score));
            if (isNaN(val)) val = 0;
        }
        typeGroups[asn.type].push(val);
      }
    });

    Object.entries(typeGroups).forEach(([type, scores]) => {
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const weight = weights[type as AssignmentType] / 100;
        totalWeightedScore += avg * weight;
        totalWeightUsed += weight;
      }
    });

    if (totalWeightUsed === 0) return 0;
    return Math.round(totalWeightedScore / totalWeightUsed);
  }, [grades, weights]);

  const getAssignmentAverage = (assignmentId: string, studentIds?: Set<string>) => {
      const scores = grades
        .filter(g => g.assignmentId === assignmentId && g.score !== null && g.score !== 'E' && (!studentIds || studentIds.has(g.studentId)))
        .map(g => {
            if (g.score === 'M' || g.score === 'L') return 0;
            const val = parseFloat(String(g.score));
            return isNaN(val) ? 0 : val;
        });
      
      if (scores.length === 0) return 0;
      return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const filteredAssignments = useMemo(() => {
    if (dateFilter === 'All') return assignments;
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - (dateFilter === '30Days' ? 30 : 7));
    return assignments.filter(a => new Date(a.date) >= cutoff);
  }, [assignments, dateFilter]);
  const assignmentIdsInScope = useMemo(() => new Set(filteredAssignments.map((assignment) => assignment.id)), [filteredAssignments]);

  const filteredAndSortedStudents = useMemo(() => {
    let students = rosterStudents.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    students = students.sort((a, b) => {
      if (sortConfig.key === 'name') {
        return sortConfig.direction === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        const avgA = calculateWeightedAverage(a.id, filteredAssignments);
        const avgB = calculateWeightedAverage(b.id, filteredAssignments);
        return sortConfig.direction === 'asc' ? avgA - avgB : avgB - avgA;
      }
    });

    return students;
  }, [searchQuery, sortConfig, calculateWeightedAverage, rosterStudents, filteredAssignments]);

  const filteredAverage = useMemo(() => {
    if (filteredAndSortedStudents.length === 0) return 0;
    const sum = filteredAndSortedStudents.reduce((acc, student) => {
      return acc + calculateWeightedAverage(student.id, filteredAssignments);
    }, 0);
    return Math.round(sum / filteredAndSortedStudents.length);
  }, [filteredAndSortedStudents, calculateWeightedAverage, filteredAssignments]);

  const classSubjectAverage = useMemo(() => {
    if (rosterStudents.length === 0) return 0;
    const sum = rosterStudents.reduce((acc, student) => {
      return acc + calculateWeightedAverage(student.id, filteredAssignments);
    }, 0);
    return Math.round(sum / rosterStudents.length);
  }, [rosterStudents, calculateWeightedAverage, filteredAssignments]);

  const missingWorkList = useMemo(() => {
    const results: { studentName: string; studentAvatar: string; assignmentTitle: string; dueDate: string; studentId: string }[] = [];
    const currentAsnIds = new Set(filteredAssignments.map((assignment) => assignment.id));
    
    grades.filter(g => g.score === 'M' && currentAsnIds.has(g.assignmentId)).forEach(g => {
        const student = rosterStudents.find(s => s.id === g.studentId);
        const assign = assignments.find(a => a.id === g.assignmentId);
        if (student && assign) {
            results.push({
                studentName: student.name,
                studentAvatar: student.avatarSeed,
                assignmentTitle: assign.title,
                dueDate: assign.date,
                studentId: student.id
            });
        }
    });
    return results;
  }, [grades, assignments, rosterStudents, filteredAssignments]);

  const filteredStudentIds = useMemo(
    () => new Set(filteredAndSortedStudents.map((student) => student.id)),
    [filteredAndSortedStudents],
  );

  const missingCountInScope = useMemo(
    () => grades.filter((grade) => grade.score === 'M' && assignmentIdsInScope.has(grade.assignmentId)).length,
    [grades, assignmentIdsInScope],
  );

  useEffect(() => {
    if (!filteredAndSortedStudents.length) {
      setMobileStudentId(null);
      return;
    }
    if (!mobileStudentId || !filteredAndSortedStudents.some((student) => student.id === mobileStudentId)) {
      setMobileStudentId(filteredAndSortedStudents[0].id);
    }
  }, [filteredAndSortedStudents, mobileStudentId]);

  useEffect(() => {
    if (!filteredAssignments.length) {
      setMobileAssignmentId(null);
      return;
    }
    if (!mobileAssignmentId || !filteredAssignments.some((assignment) => assignment.id === mobileAssignmentId)) {
      setMobileAssignmentId(filteredAssignments[0].id);
    }
  }, [filteredAssignments, mobileAssignmentId]);

  // --- Keyboard Navigation ---
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (
      e.key === 'ArrowRight' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Enter' ||
      e.key === 'Tab'
    ) {
        e.preventDefault();
        let nextRow = rowIndex;
        let nextCol = colIndex;

        if (e.key === 'ArrowRight') nextCol++;
        if (e.key === 'ArrowLeft') nextCol--;
        if (e.key === 'ArrowUp') nextRow--;
        if (e.key === 'ArrowDown') nextRow++;
        if (e.key === 'Enter') nextRow += e.shiftKey ? -1 : 1;
        if (e.key === 'Tab') nextCol += e.shiftKey ? -1 : 1;

        // Boundaries
        if (nextRow < 0) nextRow = 0;
        if (nextRow >= filteredAndSortedStudents.length) nextRow = filteredAndSortedStudents.length - 1;
        if (nextCol < 0) nextCol = 0;
        if (nextCol >= filteredAssignments.length) nextCol = filteredAssignments.length - 1;

        const nextInput = document.getElementById(`cell-${nextRow}-${nextCol}`);
        if (nextInput) {
            nextInput.focus();
            const nextStudent = filteredAndSortedStudents[nextRow];
            const nextAssign = filteredAssignments[nextCol];
            setActiveCell({ sId: nextStudent.id, aId: nextAssign.id });
        }
    }
  };

  // --- Render Helpers ---

  const getScoreColor = (val: number | string | null) => {
    if (val === 'M') return 'bg-rose-50 text-rose-700 font-bold shadow-inner';
    if (val === 'E') return 'bg-amber-50 text-amber-700 font-medium italic shadow-inner';
    if (val === 'L') return 'bg-yellow-50 text-yellow-700 font-bold shadow-inner';
    
    const num = parseFloat(String(val));
    if (isNaN(num)) return 'text-slate-700 font-medium';

    if (num >= 90) return 'text-emerald-600 font-bold bg-emerald-50/30';
    if (num < 65) return 'text-rose-600 font-bold bg-rose-50/30';
    if (num < 75) return 'text-amber-600 font-bold bg-amber-50/30';
    return 'text-slate-700 font-medium';
  };

  const handleSort = (key: 'name' | 'average') => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const getTierBadgeColor = (tier: Tier) => {
    switch(tier) {
        case Tier.TIER_1: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case Tier.TIER_2: return 'bg-amber-50 text-amber-700 border-amber-200';
        case Tier.TIER_3: return 'bg-rose-50 text-rose-700 border-rose-200';
        default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // --- Composer Handlers ---
  const handleMessageParent = (studentName: string, assignment: string) => {
      setMessageComposer({
          studentName,
          assignment,
          parentName: 'Parent/Guardian of ' + studentName
      });
      setDraftMessage("");
      setMessageSent(false);
  };

  const handleGenerateDraft = async () => {
      if (!messageComposer) return;
      setIsGeneratingMessage(true);
      try {
          const draft = await generateParentMessage(messageComposer.studentName, messageComposer.assignment, messageComposer.parentName);
          setDraftMessage(draft);
      } catch {
          setDraftMessage("I'm writing to inform you that your student has a missing assignment. Please check in with them.");
      } finally {
          setIsGeneratingMessage(false);
      }
  };

  const handleSendMessage = () => {
      // Simulate sending
      setMessageSent(true);
      setTimeout(() => {
          setMessageComposer(null);
          setMessageSent(false);
      }, 1500);
  };

  const handleMessageAllParents = () => {
      alert(`Sending bulk notification to parents of ${missingWorkList.length} students regarding missing work.`);
  };

  const totalTempWeight = useMemo(
    () => (Object.values(tempWeights) as number[]).reduce((total, value) => total + value, 0),
    [tempWeights],
  );
  const remainingWeight = 100 - totalTempWeight;
  const mobileStudent = useMemo(
    () => filteredAndSortedStudents.find((student) => student.id === mobileStudentId) ?? null,
    [filteredAndSortedStudents, mobileStudentId],
  );
  const mobileAssignment = useMemo(
    () => filteredAssignments.find((assignment) => assignment.id === mobileAssignmentId) ?? null,
    [filteredAssignments, mobileAssignmentId],
  );
  const mobileStudentIndex = useMemo(
    () => filteredAndSortedStudents.findIndex((student) => student.id === mobileStudentId),
    [filteredAndSortedStudents, mobileStudentId],
  );

  const normalizeWeights = () => {
    const entries = Object.entries(tempWeights) as Array<[AssignmentType, number]>;
    const sum = entries.reduce((total, [, value]) => total + value, 0);
    if (sum === 0) {
      setTempWeights(WEIGHT_PRESETS.Standard);
      return;
    }

    let distributed = 0;
    const normalized: Record<AssignmentType, number> = {
      Homework: 0,
      Quiz: 0,
      Test: 0,
      Project: 0,
    };
    entries.forEach(([key, value], index) => {
      if (index === entries.length - 1) {
        normalized[key] = 100 - distributed;
      } else {
        const nextValue = Math.max(0, Math.round((value / sum) * 100));
        normalized[key] = nextValue;
        distributed += nextValue;
      }
    });
    setTempWeights(normalized);
  };

  const retrySavingGrades = () => {
    setSaveStatus('saving');
    gradeCollection.replaceMutation.mutate(grades, {
      onSuccess: () => setSaveStatus('saved'),
      onError: () => setSaveStatus('error'),
    });
  };

  const resetFiltersToDefault = () => {
    setSelectedSubject('Mathematics');
    setSelectedTerm('Q1');
    setDateFilter('All');
    setSearchQuery('');
  };

  return (
    <div className="app-responsive-pane relative flex h-[calc(100vh-40px)] min-w-0 flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* --- Missing Work Modal (Draggable) --- */}
      <DraggableModal
        isOpen={showMissingModal}
        onClose={() => setShowMissingModal(false)}
        title={
            <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                    <AlertCircle size={20} />
                </div>
                <div>
                    <span className="font-bold text-lg text-slate-900 block">Missing Assignments</span>
                    <span className="text-xs text-slate-500 font-medium">{missingWorkList.length} flagged items in {selectedSubject}</span>
                </div>
            </div>
        }
        initialWidth={700}
        initialHeight={600}
        footer={
            <div className="flex justify-between items-center w-full">
                <span className="text-xs text-slate-500 italic">
                    Last synced: Just now
                </span>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowMissingModal(false)} 
                        className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        Close
                    </button>
                    {missingWorkList.length > 0 && (
                        <button 
                            onClick={handleMessageAllParents}
                            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl shadow-md hover:bg-indigo-700 flex items-center gap-2 transition-all active:scale-95"
                        >
                            <MessageSquare size={16} /> Message All Parents
                        </button>
                    )}
                </div>
            </div>
        }
      >
            {/* Overlay Composer inside modal if needed, but DraggableModal doesn't support nested full-overlay well without portal. 
                For simplicity, we'll keep the composer logic inline or as a separate modal if complex.
                Here, let's keep it simple and just show the list or composer inside content.
            */}
            
            {/* Overlay Composer Logic */}
            {messageComposer ? (
                <div className="flex flex-col h-full bg-white animate-in fade-in duration-200 absolute inset-0 z-10">
                    <div className="px-6 py-4 border-b border-slate-100 bg-indigo-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2">
                            <MessageSquare size={20} className="text-indigo-600" />
                            Draft Message
                        </h3>
                        <button onClick={() => setMessageComposer(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                    
                    {messageSent ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-emerald-600 gap-3 animate-in zoom-in">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Send size={32} />
                            </div>
                            <p className="font-bold text-lg">Message Sent Successfully!</p>
                        </div>
                    ) : (
                        <div className="flex-1 p-6 flex flex-col gap-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                                <p><span className="font-bold text-slate-600">To:</span> {messageComposer.parentName}</p>
                                <p><span className="font-bold text-slate-600">Subject:</span> Missing Assignment: {messageComposer.assignment}</p>
                            </div>
                            
                            <div className="flex-1 relative">
                                <textarea 
                                    value={draftMessage}
                                    onChange={(e) => setDraftMessage(e.target.value)}
                                    placeholder="Type your message here or use AI to generate a draft..."
                                    className="w-full h-full p-4 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm leading-relaxed"
                                />
                                {isGeneratingMessage && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-indigo-600">
                                        <Sparkles className="animate-spin mb-2" size={24} />
                                        <span className="font-bold text-sm">Drafting with AI...</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={handleGenerateDraft}
                                    className="flex-1 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                                >
                                    <Sparkles size={16} /> {draftMessage ? 'Regenerate Draft' : 'Generate with AI'}
                                </button>
                                <button 
                                    onClick={handleSendMessage}
                                    disabled={!draftMessage.trim()}
                                    className="flex-[2] py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                                >
                                    Send Message <Send size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-0 overflow-y-auto flex-1 bg-white h-full">
                    {missingWorkList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <CheckSquare size={48} className="mb-2 opacity-20" />
                            <p className="font-medium">No missing assignments found.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {missingWorkList.map((item, idx) => (
                                <div key={`${item.studentId}-${idx}`} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                            <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${item.studentAvatar}&backgroundColor=e0e7ff`} alt="avatar" className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900">{item.studentName}</h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{item.assignmentTitle}</span>
                                                <span className="text-[10px] text-slate-400">Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleMessageParent(item.studentName, item.assignmentTitle)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-sm"
                                    >
                                        <Mail size={14} /> Message Parent
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
      </DraggableModal>

      {/* --- Add Assignment Modal (Draggable) --- */}
      <DraggableModal
        isOpen={showAddAssignmentModal}
        onClose={() => setShowAddAssignmentModal(false)}
        title={
            <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <FilePlus size={20} />
                </div>
                <div>
                    <span className="font-bold text-lg text-slate-900 block">New Assignment</span>
                    <span className="text-xs text-slate-500 font-medium">Adding to <span className="text-indigo-600 font-bold">{selectedSubject}</span> • {selectedTerm}</span>
                </div>
            </div>
        }
        initialWidth={600}
        initialHeight={500}
        footer={
            <div className="flex justify-between items-center w-full">
              <div className="text-xs text-slate-400 font-medium italic">
                 * Required fields
              </div>
              <div className="flex gap-3">
                <button 
                    onClick={() => setShowAddAssignmentModal(false)} 
                    className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleCreateAssignment}
                    disabled={!newAssignmentData.title}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all hover:shadow-lg transform active:scale-95"
                >
                    <Save size={18} /> Create Assignment
                </button>
              </div>
            </div>
        }
      >
            <div className="p-6 space-y-5 h-full">
                {/* Title Input */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Assignment Title <span className="text-rose-500">*</span></label>
                    <input 
                        type="text" 
                        autoFocus
                        placeholder="e.g., Chapter 4 Review, Ecosystem Project..."
                        value={newAssignmentData.title}
                        onChange={(e) => setNewAssignmentData({...newAssignmentData, title: e.target.value})}
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm placeholder:text-slate-400"
                    />
                </div>
                
                {/* Grid: Type & Date */}
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Assignment Type</label>
                        <div className="relative">
                            <select
                                value={newAssignmentData.type}
                                onChange={(e) => setNewAssignmentData({...newAssignmentData, type: e.target.value as AssignmentType})}
                                className="w-full p-3 pl-3 pr-10 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white appearance-none cursor-pointer transition-all shadow-sm"
                            >
                                {['Homework', 'Quiz', 'Test', 'Project'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <CustomDatePicker 
                            label="Due Date"
                            value={newAssignmentData.date}
                            onChange={(val) => setNewAssignmentData({...newAssignmentData, date: val})}
                            className="w-full"
                        />
                    </div>
                </div>

                {/* Grid: Points & Description */}
                <div className="grid grid-cols-3 gap-5">
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Max Points</label>
                        <div className="relative">
                            <input 
                                type="number"
                                min="0"
                                value={newAssignmentData.maxPoints}
                                onChange={(e) => setNewAssignmentData({...newAssignmentData, maxPoints: parseInt(e.target.value) || 0})}
                                className="w-full p-3 pl-9 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none italic text-sm">#</div>
                        </div>
                    </div>
                    <div className="col-span-2">
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Standards / Tags (Optional)</label>
                         <div className="relative">
                            <Tag size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="e.g. CCSS.MATH.4.NBT..."
                                className="w-full p-3 pl-10 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                            />
                         </div>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">Description / Notes</label>
                    <textarea 
                        rows={3}
                        placeholder="Add instructions or details for this assignment..."
                        value={newAssignmentData.description}
                        onChange={(e) => setNewAssignmentData({...newAssignmentData, description: e.target.value})}
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all shadow-sm"
                    />
                </div>
            </div>
      </DraggableModal>

      {/* --- Weight Configuration Modal (Draggable) --- */}
      <DraggableModal
        isOpen={showWeightsModal}
        onClose={() => setShowWeightsModal(false)}
        title={
            <div className="flex items-center gap-2">
                <Calculator size={20} className="text-indigo-600" />
                <span className="font-bold text-lg text-slate-900">Grade Weights</span>
            </div>
        }
        initialWidth={500}
        initialHeight={600}
        footer={
            <div className="flex justify-end gap-3 w-full">
              <button onClick={() => setShowWeightsModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">Cancel</button>
              <button 
                onClick={() => { setWeights(tempWeights); setShowWeightsModal(false); }}
                disabled={totalTempWeight !== 100}
                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              >
                <Save size={16} /> Save Configuration
              </button>
            </div>
        }
      >
            <div className="p-6 space-y-6 overflow-y-auto h-full">
              {/* Presets Section */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                 <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                    <LayoutTemplate size={14} /> Quick Presets
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(WEIGHT_PRESETS).map(([name, presetWeights]) => (
                        <button
                            key={name}
                            onClick={() => setTempWeights(presetWeights)}
                            className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all ${
                                JSON.stringify(tempWeights) === JSON.stringify(presetWeights)
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                        >
                            {name}
                        </button>
                    ))}
                    <button
                      onClick={normalizeWeights}
                      className="py-2 px-2 rounded-lg text-xs font-semibold border bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    >
                      Normalize
                    </button>
                 </div>
              </div>

              <div className="flex flex-col gap-8 items-center">
                {/* Visual Donut */}
                <div className="w-40 h-40 relative shrink-0">
                    <PieChart width={160} height={160}>
                      <Pie
                          data={Object.entries(tempWeights).map(([name, value]) => ({ name, value }))}
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={5}
                          dataKey="value"
                          cx={80}
                          cy={80}
                      >
                          {Object.entries(tempWeights).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                          ))}
                      </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                        <span className={`text-xl font-bold transition-colors duration-300 ${totalTempWeight !== 100 ? 'text-rose-500 animate-pulse' : 'text-slate-800'}`}>
                        {totalTempWeight}%
                        </span>
                        <span className={`text-[10px] font-bold ${remainingWeight === 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {remainingWeight === 0 ? 'Balanced' : `${remainingWeight > 0 ? '+' : ''}${remainingWeight}% remaining`}
                        </span>
                    </div>
                </div>

                {/* Sliders */}
                <div className="space-y-4 flex-1 w-full">
                    {(['Homework', 'Quiz', 'Test', 'Project'] as AssignmentType[]).map((type, idx) => (
                    <div key={type} className="space-y-1.5">
                        <div className="flex justify-between text-sm items-center">
                            <span className="font-bold text-slate-700 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                                {type}
                            </span>
                            <div className="relative w-16">
                                <input 
                                    type="number"
                                    value={tempWeights[type]}
                                    onChange={(e) => setTempWeights({...tempWeights, [type]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))})}
                                    className="w-full p-1 text-right text-xs font-bold border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-indigo-400"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
                            </div>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            step="5"
                            value={tempWeights[type]}
                            onChange={(e) => setTempWeights({...tempWeights, [type]: parseInt(e.target.value)})}
                            style={{ accentColor: COLORS[idx] }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    ))}
                </div>
              </div>

              {totalTempWeight !== 100 && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg flex items-center justify-center gap-2 border border-rose-100 font-bold">
                  <AlertCircle size={16} /> Weights must total exactly 100%.
                </div>
              )}
            </div>
      </DraggableModal>

      {/* --- Header --- */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SidebarToggleButton
              onClick={onMenuClick}
              className="lg:hidden p-2 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-lg"
            />
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Gradebook</h2>
              <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
                <span className="font-medium text-indigo-600">Class 4-B</span>
                <span className="text-slate-300">•</span>
                {assignments.length} Assignments
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddAssignmentModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Plus size={18} /> New Assignment
            </button>
            <button
              onClick={() => { setTempWeights(weights); setShowWeightsModal(true); }}
              className="flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
              title="Configure grade weights"
            >
              <PieChartIcon size={16} /> Grade Weights
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <div className="relative">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-slate-50 transition-colors w-full"
            >
              {SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-slate-50 transition-colors w-full"
            >
              <option value="Q1">Quarter 1</option>
              <option value="Q2">Quarter 2</option>
              <option value="Q3">Quarter 3</option>
              <option value="Q4">Quarter 4</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'All' | '30Days' | '7Days')}
              className="appearance-none pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-slate-50 transition-colors w-full"
            >
              <option value="All">All Time</option>
              <option value="30Days">Last 30 Days</option>
              <option value="7Days">Last 7 Days</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filters:</span>
          <button onClick={() => setSelectedSubject('Mathematics')} className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
            {selectedSubject}
          </button>
          <button onClick={() => setSelectedTerm('Q1')} className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
            {selectedTerm}
          </button>
          <button onClick={() => setDateFilter('All')} className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
            {dateFilter === 'All' ? 'All Time' : dateFilter === '30Days' ? 'Last 30 Days' : 'Last 7 Days'}
          </button>
          <button onClick={resetFiltersToDefault} className="ml-auto text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg px-2 py-1">
            Reset Filters
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg ring-4 ring-indigo-50/50">
            {classSubjectAverage}%
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weighted Avg (Class)</p>
            <p className="text-sm font-medium text-slate-600">Across {filteredAssignments.length} Items</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg ring-4 ring-blue-50/50">
            {filteredAverage}%
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weighted Avg (Filtered)</p>
            <p className="text-sm font-medium text-slate-600">{filteredAndSortedStudents.length} Students</p>
          </div>
        </div>

        <div
          onClick={() => setShowMissingModal(true)}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ring-4 transition-transform group-hover:scale-110 ${missingCountInScope > 5 ? 'bg-rose-50 text-rose-600 ring-rose-50/50' : 'bg-emerald-50 text-emerald-600 ring-emerald-50/50'}`}>
            {missingCountInScope}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">Missing</p>
            <p className="text-sm font-medium text-slate-600">In Current Scope</p>
          </div>
        </div>

        <button
          className="bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl shadow-md p-4 flex items-center justify-between text-white relative overflow-hidden group cursor-pointer text-left"
          onClick={() => setShowAiAnalysis(true)}
        >
          <div className="relative z-10">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BrainCircuit size={20} /> Grade Analysis
            </h3>
            <p className="text-indigo-100 text-sm">Open actionable AI insights for current filters.</p>
          </div>
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition-colors relative z-10">
            <TrendingUp size={24} />
          </div>
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors"></div>
        </button>
      </div>

      {/* AI Analysis Drawer */}
      {showAiAnalysis && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-[1px]" onClick={() => setShowAiAnalysis(false)}>
          <div
            className="h-full w-full border-l border-slate-200 bg-white p-5 shadow-2xl overflow-y-auto sm:w-[420px] md:w-[430px] animate-in slide-in-from-right"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">AI Summary</p>
                <h4 className="font-bold text-slate-900 text-lg mt-1">Performance Insight: {selectedSubject}</h4>
              </div>
              <button onClick={() => setShowAiAnalysis(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50">
              <p className="text-sm text-indigo-900 leading-relaxed">
                The class average is <strong>{classSubjectAverage}%</strong>, while the filtered cohort is
                <strong> {filteredAverage}%</strong>. Test performance (weight {weights.Test}%) is strongest, and homework completion remains the largest risk area.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recommended Actions</p>
              <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-semibold">
                Send homework reminder to families with missing work
              </button>
              <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-semibold">
                Create intervention follow-up for Tier 3 students below 70%
              </button>
              <button className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-semibold">
                Review weight distribution before final posting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Gradebook Table */}
      <div className="app-responsive-pane relative flex flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
         
         {/* Toolbar */}
         <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50">
             <div className="relative max-w-xs w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Filter students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
             </div>
             <div className="flex items-center gap-2 flex-wrap">
                 <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                    saveStatus === 'saving'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : saveStatus === 'saved'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : saveStatus === 'error'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                 }`}>
                    {saveStatus === 'saving' && <Loader2 size={12} className="animate-spin" />}
                    {saveStatus === 'saved' && <CheckCircle2 size={12} />}
                    {saveStatus === 'error' && <AlertTriangle size={12} />}
                    {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'All changes saved' : saveStatus === 'error' ? 'Save failed' : 'Ready'}
                 </div>
                 <button
                    onClick={handleUndoLastEdit}
                    disabled={!lastEditedCell}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Undo last edit"
                 >
                    <RotateCcw size={16} />
                 </button>
                 {saveStatus === 'error' && (
                  <button
                    onClick={retrySavingGrades}
                    className="px-2.5 py-1 rounded-lg border border-rose-200 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50"
                  >
                    Retry Save
                  </button>
                 )}
                 <button className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all" title="Download CSV">
                     <Download size={16} />
                 </button>
             </div>
         </div>

         {/* Scrollable Grid Container */}
         <div className="hidden md:flex-1 overflow-auto relative" ref={gridRef}>
            <table className="w-full border-collapse text-sm min-w-max">
                <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                        {/* Sticky Name Column with Sort */}
                        <th className="sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-200 p-0 w-[200px] min-w-[200px]">
                            <div 
                                className="p-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex justify-between items-center"
                                onClick={() => handleSort('name')}
                            >
                                Student Name
                                {sortConfig.key === 'name' && (
                                    sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                )}
                            </div>
                        </th>
                        
                        {/* Sticky Profile Column (Tier/Interventions) */}
                        <th className="sticky left-[200px] z-30 bg-slate-50 border-b border-r border-slate-200 p-0 w-[140px] min-w-[140px]">
                            <div className="p-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider h-full flex items-center">
                                Profile
                            </div>
                        </th>

                        {/* Stats Column - also sticky with Sort */}
                        <th className="sticky left-[340px] z-30 bg-slate-50 border-b border-r border-slate-200 w-[100px] min-w-[100px] text-center shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                            <div 
                                className="p-2 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1 h-full"
                                onClick={() => handleSort('average')}
                            >
                                Avg
                                {sortConfig.key === 'average' && (
                                    sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                )}
                            </div>
                        </th>
                        
                        {/* Assignment Columns */}
                        {filteredAssignments.map(asn => (
                            <th key={asn.id} className="bg-slate-50 border-b border-r border-slate-200 w-[140px] min-w-[140px] group hover:bg-indigo-50/50 transition-colors relative column-header z-10">
                                <div className="p-3 flex flex-col gap-1 h-full justify-between">
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-slate-700 text-xs truncate max-w-[90px]" title={asn.title}>{asn.title}</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setColumnMenuId(columnMenuId === asn.id ? null : asn.id); }}
                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity"
                                        >
                                            <MoreHorizontal size={14} />
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                                        <span>{new Date(asn.date).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</span>
                                        <span className="bg-slate-200 px-1.5 rounded text-slate-600">{asn.maxPoints} pts</span>
                                    </div>
                                </div>
                                
                                {/* Context Menu for Column */}
                                {columnMenuId === asn.id && (
                                    <div className="absolute top-full right-2 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-100 z-50 py-1 animate-in fade-in zoom-in-95 text-left">
                                        <div className="px-3 py-2 text-[10px] text-slate-400 font-bold uppercase border-b border-slate-50 mb-1">Assignment Options</div>
                                        <button onClick={() => alert("Edit Assignment details")} className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2">
                                            <Settings size={12} /> Edit Details
                                        </button>
                                        <button onClick={() => handleBulkMissing(asn.id)} className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-amber-600 flex items-center gap-2">
                                            <CheckSquare size={12} /> Mark Empty as Missing
                                        </button>
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button onClick={() => handleDeleteAssignment(asn.id)} className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                                            <Trash2 size={12} /> Delete Assignment
                                        </button>
                                    </div>
                                )}
                            </th>
                        ))}
                        <th className="bg-slate-50 border-b border-slate-200 w-full"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredAndSortedStudents.map((student, rowIndex) => {
                        const avg = calculateWeightedAverage(student.id, filteredAssignments);
                        
                        // Prepare Trend Data
                        const trendData = filteredAssignments.map(a => {
                            const raw = getScore(student.id, a.id);
                            let val = 0;
                            if (raw === 'M' || raw === 'L') val = 0; 
                            else if (raw !== 'E' && raw !== null) val = parseFloat(String(raw)); 
                            else return null; 
                            return { title: a.title, value: val };
                        }).filter(d => d !== null);

                        return (
                            <tr key={student.id} className="group hover:bg-indigo-50/30 transition-colors">
                                {/* Sticky Student Name */}
                                <td className="sticky left-0 z-10 bg-white group-hover:bg-indigo-50/30 border-r border-slate-200 p-3 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                            <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${student.avatarSeed}&backgroundColor=e0e7ff`} alt="avatar" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-slate-800 truncate text-sm">{student.name}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{student.id}</p>
                                        </div>
                                    </div>
                                </td>
                                
                                {/* Sticky Profile Column */}
                                <td className="sticky left-[200px] z-10 bg-white group-hover:bg-indigo-50/30 border-r border-slate-200 p-2 transition-colors">
                                    <div className="flex flex-col gap-1.5">
                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border w-fit ${getTierBadgeColor(student.tier)}`}>
                                            {student.tier}
                                        </span>
                                        <div className="text-[10px] font-medium text-slate-500 leading-tight">
                                            GPA: <span className="text-slate-700 font-bold">{student.gpa}</span> • Read: <span className="text-slate-700 font-bold">{student.readingLevel}</span>
                                        </div>
                                        {student.activeInterventions > 0 && (
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                                                <Zap size={10} className="fill-amber-600" /> {student.activeInterventions} Active Plans
                                            </div>
                                        )}
                                    </div>
                                </td>

                                {/* Average & Trend Sparkline - also sticky */}
                                <td className="sticky left-[340px] z-10 border-r border-slate-200 p-0 text-center bg-white group-hover:bg-indigo-50/30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                    <div className="flex flex-col items-center justify-center h-full py-1.5">
                                        <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-1 ${
                                            avg >= 90 ? 'text-emerald-700 bg-emerald-100' : 
                                            avg < 70 ? 'text-rose-700 bg-rose-100' : 
                                            'text-slate-700 bg-slate-200'
                                        }`}>
                                            {avg}%
                                        </div>
                                        <div className="h-6 w-full px-2 opacity-70 relative flex items-center justify-center">
                                            <LineChart width={72} height={24} data={trendData}>
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="value" 
                                                    stroke={avg >= 90 ? '#10b981' : avg < 70 ? '#f43f5e' : '#6366f1'} 
                                                    strokeWidth={2} 
                                                    dot={false} 
                                                />
                                                <YAxis domain={[0, 100]} hide />
                                                <Tooltip 
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg border border-slate-700">
                                                                    <p className="font-bold">{payload[0].payload.title}</p>
                                                                    <p>Score: {payload[0].value}</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                            </LineChart>
                                        </div>
                                    </div>
                                </td>

                                {/* Grade Cells */}
                                {filteredAssignments.map((asn, colIndex) => {
                                    const score = getScore(student.id, asn.id);
                                    const colorClass = getScoreColor(score);
                                    const isFocused = activeCell?.sId === student.id && activeCell?.aId === asn.id;
                                    
                                    return (
                                        <td key={asn.id} className="border-r border-slate-100 p-0 min-w-[100px] group/cell grade-cell h-full z-0">
                                            <div className="relative w-full h-full min-h-[52px] flex items-center justify-center">
                                                <input 
                                                    id={`cell-${rowIndex}-${colIndex}`}
                                                    type="text" 
                                                    value={score === null ? '' : String(score)}
                                                    autoComplete="off"
                                                    onFocus={(e) => { 
                                                        setActiveCell({ sId: student.id, aId: asn.id }); 
                                                        setColumnMenuId(null);
                                                        e.target.select(); // Auto-select content
                                                    }}
                                                    onChange={(e) => handleScoreChange(student.id, asn.id, e.target.value)}
                                                    onPaste={(e) => handlePasteGrades(e, rowIndex, colIndex)}
                                                    onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                    className={`w-full h-full absolute inset-0 text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 outline-none text-sm transition-all ${colorClass} hover:bg-slate-50 cursor-pointer z-0 pr-2 ${
                                                      cellSaveState[toCellKey(student.id, asn.id)] === 'error'
                                                        ? 'ring-2 ring-rose-300'
                                                        : cellSaveState[toCellKey(student.id, asn.id)] === 'saving'
                                                        ? 'ring-2 ring-amber-300'
                                                        : ''
                                                    }`}
                                                    placeholder="-"
                                                />
                                                
                                                {/* Quick Fill Popover */}
                                                {isFocused && (
                                                    <div className="grade-popover absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-2 w-[160px] animate-in fade-in zoom-in-95 duration-100">
                                                        <div className="grid grid-cols-3 gap-1.5 mb-2">
                                                            {[100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 0].map(val => (
                                                                <button
                                                                    key={val}
                                                                    onMouseDown={(e) => { e.preventDefault(); handleScoreChange(student.id, asn.id, val.toString()); }}
                                                                    className={`text-[10px] font-bold py-1 rounded hover:scale-105 transition-transform ${
                                                                        val >= 90 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' :
                                                                        val >= 75 ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' :
                                                                        val >= 60 ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                                                                        'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                                    }`}
                                                                >
                                                                    {val}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100">
                                                             <button 
                                                                onMouseDown={(e) => { e.preventDefault(); handleScoreChange(student.id, asn.id, 'M'); }}
                                                                className="text-[10px] font-bold py-1 rounded bg-rose-100 text-rose-800 hover:bg-rose-200"
                                                            >
                                                                Missing
                                                            </button>
                                                            <button 
                                                                onMouseDown={(e) => { e.preventDefault(); handleScoreChange(student.id, asn.id, 'E'); }}
                                                                className="text-[10px] font-bold py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200"
                                                            >
                                                                Excused
                                                            </button>
                                                            <button 
                                                                onMouseDown={(e) => { e.preventDefault(); handleScoreChange(student.id, asn.id, 'L'); }}
                                                                className="text-[10px] font-bold py-1 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                                            >
                                                                Late
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                                <td></td>
                            </tr>
                        );
                    })}
                    {/* Footer Stats Row */}
                    <tr className="bg-slate-50 sticky bottom-0 z-20 border-t border-slate-200 shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.05)]">
                        <td className="sticky left-0 bg-slate-50 border-r border-slate-200 p-3 z-30">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assignment Avg</span>
                        </td>
                        <td className="sticky left-[200px] bg-slate-50 border-r border-slate-200 p-2 z-30">
                            {/* Spacer for Profile column */}
                        </td>
                        <td className="sticky left-[340px] bg-slate-50 border-r border-slate-200 p-2 text-center z-30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                            <span className="text-xs font-bold text-slate-800">{filteredAverage}%</span>
                        </td>
                        {filteredAssignments.map(asn => {
                            const avg = getAssignmentAverage(asn.id, filteredStudentIds);
                            return (
                                <td key={asn.id} className="text-center py-3 border-r border-slate-200">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                        avg >= 90 ? 'text-emerald-700 bg-emerald-100' : 
                                        avg < 75 ? 'text-rose-700 bg-rose-100' : 
                                        'text-slate-600 bg-slate-200'
                                    }`}>
                                        {avg}%
                                    </span>
                                </td>
                            );
                        })}
                        <td></td>
                    </tr>
                </tbody>
            </table>
         </div>

         {/* Mobile Grade Entry */}
         <div className="md:hidden flex-1 overflow-auto p-3 space-y-3">
            {mobileStudent && mobileAssignment ? (
              <>
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={mobileStudent.id}
                    onChange={(e) => setMobileStudentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium bg-white"
                  >
                    {filteredAndSortedStudents.map((student) => (
                      <option key={student.id} value={student.id}>{student.name}</option>
                    ))}
                  </select>
                  <select
                    value={mobileAssignment.id}
                    onChange={(e) => setMobileAssignmentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium bg-white"
                  >
                    {filteredAssignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      if (mobileStudentIndex <= 0) return;
                      setMobileStudentId(filteredAndSortedStudents[mobileStudentIndex - 1].id);
                    }}
                    disabled={mobileStudentIndex <= 0}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 disabled:opacity-40"
                  >
                    <span className="inline-flex items-center gap-1"><ChevronLeft size={14} /> Prev</span>
                  </button>
                  <span className="text-xs font-semibold text-slate-500">
                    {mobileStudentIndex + 1} / {filteredAndSortedStudents.length}
                  </span>
                  <button
                    onClick={() => {
                      if (mobileStudentIndex >= filteredAndSortedStudents.length - 1) return;
                      setMobileStudentId(filteredAndSortedStudents[mobileStudentIndex + 1].id);
                    }}
                    disabled={mobileStudentIndex >= filteredAndSortedStudents.length - 1}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 disabled:opacity-40"
                  >
                    <span className="inline-flex items-center gap-1">Next <ChevronRight size={14} /></span>
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{mobileStudent.name}</p>
                      <p className="text-xs text-slate-500">{mobileAssignment.title} • {new Date(mobileAssignment.date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${getTierBadgeColor(mobileStudent.tier)}`}>
                      {mobileStudent.tier}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Score</label>
                    <input
                      type="text"
                      value={getScore(mobileStudent.id, mobileAssignment.id) === null ? '' : String(getScore(mobileStudent.id, mobileAssignment.id))}
                      onChange={(e) => handleScoreChange(mobileStudent.id, mobileAssignment.id, e.target.value)}
                      className={`w-full rounded-lg border border-slate-200 px-3 py-3 text-lg font-bold text-center ${getScoreColor(getScore(mobileStudent.id, mobileAssignment.id))}`}
                      placeholder="-"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => applyParsedScore(mobileStudent.id, mobileAssignment.id, 'M')} className="py-2 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold">Missing</button>
                    <button onClick={() => applyParsedScore(mobileStudent.id, mobileAssignment.id, 'E')} className="py-2 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">Excused</button>
                    <button onClick={() => applyParsedScore(mobileStudent.id, mobileAssignment.id, 'L')} className="py-2 rounded-lg bg-yellow-100 text-yellow-700 text-xs font-bold">Late</button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[100, 90, 80, 70].map((value) => (
                      <button
                        key={value}
                        onClick={() => applyParsedScore(mobileStudent.id, mobileAssignment.id, value)}
                        className="py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold"
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No student or assignment available in current filters.
              </div>
            )}
         </div>
         
         {/* Footer Legend */}
         <div className="p-2 bg-slate-50 border-t border-slate-200 flex gap-4 justify-center text-[10px] text-slate-500">
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-rose-100 border border-rose-200 rounded-sm"></span> Missing (M)</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-50 border border-amber-200 rounded-sm"></span> Excused (E)</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-50 border border-yellow-200 rounded-sm"></span> Late (L)</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-50 border border-emerald-200 rounded-sm"></span> Passing (90+)</div>
         </div>
      </div>
    </div>
  );
};
