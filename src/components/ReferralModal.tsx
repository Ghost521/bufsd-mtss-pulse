import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Upload,
  CheckCircle2,
  Loader2,
  FileText,
  ShieldAlert,
  Trash2,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { DraggableModal } from './DraggableModal';
import {
  evidenceRequirementReason,
  normalizeNotes,
  requiresEvidence,
  validateAttachment,
  validateReferralInput,
  type ReferralCategory,
  type ReferralValidationErrors,
  type ReferralUrgency,
} from '../services/referralValidation';
import type { StudentRosterItem } from '../types';
import { useStudents } from '../hooks/useStudents';
import { useTenantCollection } from '../hooks/useTenantCollection';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStudentId?: string;
  onViewQueue?: (referralId?: string) => void;
}

type ReferralFormData = {
  studentId: string;
  type: ReferralCategory;
  urgency: ReferralUrgency;
  notes: string;
};

type ReferralSubmitResult = {
  referralId: string;
  status: 'Pending Review';
  routedTo: string;
};

type ReferralDraftAttachment = {
  name: string;
  size: number;
  lastModified: number;
  type: string;
};

type ReferralDraftRecord = {
  version: 1;
  updatedAt: string;
  formData: ReferralFormData;
  attachments: ReferralDraftAttachment[];
};

type ReferralRecord = {
  id: string;
  studentId: string;
  studentName: string;
  grade?: string;
  type: ReferralCategory;
  urgency: ReferralUrgency;
  notes: string;
  attachments?: Array<{
    name: string;
    size?: number;
    type?: string;
  }>;
  status: 'Pending Review';
  routedTo: string;
  createdAt: string;
};

type StudentOption = StudentRosterItem & {
  source: 'Class' | 'Master';
};

const STUDENT_LISTBOX_ID = 'referral-student-options';
const REFERRAL_DRAFT_TTL_MS = 8 * 60 * 60 * 1000;
const REFERRAL_DRAFT_SCHEMA_VERSION = 1 as const;
const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_ATTACHMENT_INPUT = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif';

const buildDefaultForm = (studentId = ''): ReferralFormData => ({
  studentId,
  type: 'Behavior',
  urgency: 'Medium',
  notes: '',
});

const formatStudentLabel = (student: StudentOption): string =>
  `${student.name} (Grade ${student.grade} | ID ${student.id})`;

const toDraftAttachment = (file: Pick<File, 'name' | 'size' | 'lastModified' | 'type'>): ReferralDraftAttachment => ({
  name: file.name,
  size: file.size,
  lastModified: file.lastModified,
  type: file.type || '',
});

const formSnapshot = (formData: ReferralFormData, files: File[], draftAttachments: ReferralDraftAttachment[] = []): string =>
  JSON.stringify({
    formData: {
      ...formData,
      notes: normalizeNotes(formData.notes),
    },
    attachments: files.length > 0 ? files.map((file) => toDraftAttachment(file)) : draftAttachments,
  });

const classifySubmitError = (error: unknown): 'network' | 'validation' | 'unknown' => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/network|failed to fetch|timeout|timed out|unavailable|502|503|504/.test(message)) {
    return 'network';
  }
  if (/invalid|required|must|unauthorized|forbidden|400|401|403|422/.test(message)) {
    return 'validation';
  }
  return 'unknown';
};

const parseDraftRecord = (raw: string | null, storageKey: string): ReferralDraftRecord | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ReferralDraftRecord;
    if (parsed.version !== REFERRAL_DRAFT_SCHEMA_VERSION) return null;
    const updatedAtMs = Number(new Date(parsed.updatedAt).getTime());
    if (!Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > REFERRAL_DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }
    if (!parsed.formData || typeof parsed.formData !== 'object') return null;
    if (!Array.isArray(parsed.attachments)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const trackReferralEvent = (event: string, details: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('referral:ux', {
      detail: {
        event,
        timestamp: new Date().toISOString(),
        ...details,
      },
    })
  );
};

export const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  onClose,
  defaultStudentId = '',
  onViewQueue,
}) => {
  const masterStudentsApi = useStudents('master', { enabled: isOpen });
  const classStudentsApi = useStudents('class', { enabled: isOpen });
  const referralCollection = useTenantCollection<ReferralRecord>('referrals', { enabled: isOpen });
  const [formData, setFormData] = useState<ReferralFormData>(buildDefaultForm(defaultStudentId));
  const [studentQuery, setStudentQuery] = useState('');
  const [isStudentMenuOpen, setIsStudentMenuOpen] = useState(false);
  const [highlightedStudentIndex, setHighlightedStudentIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [draftAttachmentMetadata, setDraftAttachmentMetadata] = useState<ReferralDraftAttachment[]>([]);
  const [attachmentMessages, setAttachmentMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<ReferralSubmitResult | null>(null);
  const [errors, setErrors] = useState<ReferralValidationErrors>({});
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState<string | null>(null);
  const [showDraftRestoredBanner, setShowDraftRestoredBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentInputRef = useRef<HTMLInputElement>(null);
  const studentComboboxRef = useRef<HTMLDivElement>(null);
  const studentListboxRef = useRef<HTMLUListElement>(null);
  const baselineFormRef = useRef<ReferralFormData>(buildDefaultForm(defaultStudentId));
  const draftStorageKey = useMemo(
    () => `mtss:referralDraft:${defaultStudentId || 'global'}`,
    [defaultStudentId]
  );
  const students = useMemo<StudentOption[]>(() => {
    const merged: StudentOption[] = [
      ...(classStudentsApi.studentsQuery.data?.rows ?? []).map((row) => ({ ...row, source: 'Class' as const })),
      ...(masterStudentsApi.studentsQuery.data?.rows ?? []).map((row) => ({ ...row, source: 'Master' as const })),
    ];
    const seen = new Set<string>();
    const deduped = merged.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return deduped.sort((left, right) => left.name.localeCompare(right.name));
  }, [classStudentsApi.studentsQuery.data?.rows, masterStudentsApi.studentsQuery.data?.rows]);

  const filteredStudents = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      `${student.name} ${student.grade} ${student.id} ${student.tier} ${student.source}`.toLowerCase().includes(query)
    );
  }, [studentQuery, students]);
  const areStudentsLoading =
    classStudentsApi.studentsQuery.isLoading || masterStudentsApi.studentsQuery.isLoading;
  const studentSourceError = classStudentsApi.studentsQuery.error ?? masterStudentsApi.studentsQuery.error;
  const studentRosterUnavailable = Boolean(studentSourceError) && students.length === 0;
  const highlightedStudent = filteredStudents[highlightedStudentIndex] ?? null;
  const activeStudentOptionId = highlightedStudent ? `${STUDENT_LISTBOX_ID}-${highlightedStudent.id}` : undefined;

  const evidenceIsRequired = requiresEvidence(formData.type, formData.urgency);
  const evidenceReason = evidenceRequirementReason(formData.type, formData.urgency);
  const normalizedNotes = normalizeNotes(formData.notes);
  const submitDisabledReason = useMemo(() => {
    if (studentRosterUnavailable && !formData.studentId) return 'Student roster unavailable. Retry loading students.';
    if (!formData.studentId) return 'Select a student to continue.';
    if (!normalizedNotes) return 'Add referral notes to continue.';
    if (evidenceIsRequired && files.length === 0) {
      return evidenceReason ?? 'Upload supporting documentation to continue.';
    }
    return null;
  }, [evidenceIsRequired, evidenceReason, files.length, formData.studentId, normalizedNotes, studentRosterUnavailable]);
  const isSubmitDisabled = isSubmitting || Boolean(submitDisabledReason);

  const isDirty = useMemo(() => {
    const baseline = baselineFormRef.current;
    return (
      formData.studentId !== baseline.studentId ||
      formData.type !== baseline.type ||
      formData.urgency !== baseline.urgency ||
      normalizeNotes(formData.notes) !== normalizeNotes(baseline.notes) ||
      files.length > 0 ||
      draftAttachmentMetadata.length > 0
    );
  }, [draftAttachmentMetadata.length, files.length, formData]);

  const clearStoredDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(draftStorageKey);
  }, [draftStorageKey]);

  const persistDraft = useCallback(
    (
      nextFormData: ReferralFormData = formData,
      nextFiles: File[] = files,
      nextDraftAttachments: ReferralDraftAttachment[] = draftAttachmentMetadata
    ) => {
      if (typeof window === 'undefined') return;
      const draftRecord: ReferralDraftRecord = {
        version: REFERRAL_DRAFT_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        formData: {
          ...nextFormData,
          notes: normalizeNotes(nextFormData.notes),
        },
        attachments: nextFiles.length > 0 ? nextFiles.map((file) => toDraftAttachment(file)) : nextDraftAttachments,
      };
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draftRecord));
      setSavedDraftSnapshot(formSnapshot(draftRecord.formData, [], draftRecord.attachments));
      setHasSavedDraft(true);
    },
    [draftAttachmentMetadata, draftStorageKey, files, formData]
  );

  const resetForm = useCallback((nextStudentId = defaultStudentId) => {
    const nextForm = buildDefaultForm(nextStudentId);
    baselineFormRef.current = nextForm;
    setFormData(nextForm);
    setStudentQuery(nextStudentId || '');
    setSubmitError(null);
    setFiles([]);
    setDraftAttachmentMetadata([]);
    setErrors({});
    setAttachmentMessages([]);
    setIsStudentMenuOpen(false);
    setHighlightedStudentIndex(0);
    setShowClosePrompt(false);
  }, [defaultStudentId]);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setAttachmentMessages([]);
    setSubmitError(null);
    setShowClosePrompt(false);
    setIsStudentMenuOpen(false);
    setHighlightedStudentIndex(0);
    setIsSuccess(false);
    setSubmitResult(null);

    if (typeof window !== 'undefined') {
      const restoredDraft = parseDraftRecord(window.sessionStorage.getItem(draftStorageKey), draftStorageKey);
      if (restoredDraft) {
        const restoredFormData: ReferralFormData = {
          ...restoredDraft.formData,
          studentId: restoredDraft.formData.studentId || defaultStudentId,
        };
        setFormData(restoredFormData);
        setStudentQuery(restoredFormData.studentId);
        setFiles([]);
        setDraftAttachmentMetadata(restoredDraft.attachments);
        setHasSavedDraft(true);
        setSavedDraftSnapshot(formSnapshot(restoredFormData, [], restoredDraft.attachments));
        setShowDraftRestoredBanner(true);
        trackReferralEvent('referral_modal_opened', {
          restoredDraft: true,
          draftSource: 'session',
          defaultStudentProvided: Boolean(defaultStudentId),
        });
        return;
      }
    }

    setHasSavedDraft(false);
    setSavedDraftSnapshot(null);
    setShowDraftRestoredBanner(false);
    resetForm(defaultStudentId);
    trackReferralEvent('referral_modal_opened', {
      restoredDraft: false,
      draftSource: 'none',
      defaultStudentProvided: Boolean(defaultStudentId),
    });
  }, [defaultStudentId, draftStorageKey, isOpen, resetForm]);

  useEffect(() => {
    if (highlightedStudentIndex < filteredStudents.length) return;
    setHighlightedStudentIndex(Math.max(0, filteredStudents.length - 1));
  }, [filteredStudents.length, highlightedStudentIndex]);

  useEffect(() => {
    if (!isOpen) return;
    if (!formData.studentId) return;
    const selected = students.find((student) => student.id === formData.studentId);
    if (!selected) return;
    const nextLabel = formatStudentLabel(selected);
    if (!isStudentMenuOpen && studentQuery !== nextLabel) {
      setStudentQuery(nextLabel);
    }
  }, [formData.studentId, isOpen, isStudentMenuOpen, studentQuery, students]);

  useEffect(() => {
    if (!isStudentMenuOpen || !activeStudentOptionId || !studentListboxRef.current) return;
    const nextOption = studentListboxRef.current.querySelector<HTMLElement>(`#${activeStudentOptionId}`);
    if (nextOption && typeof nextOption.scrollIntoView === 'function') {
      nextOption.scrollIntoView({ block: 'nearest' });
    }
  }, [activeStudentOptionId, isStudentMenuOpen]);

  useEffect(() => {
    if (!isOpen || !isStudentMenuOpen) return;
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && studentComboboxRef.current?.contains(target)) return;
      setIsStudentMenuOpen(false);
    };
    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [isOpen, isStudentMenuOpen]);

  useEffect(() => {
    if (!errors.files) return;
    if (!evidenceIsRequired || files.length > 0) {
      setErrors((previous) => ({ ...previous, files: '' }));
    }
  }, [errors.files, evidenceIsRequired, files.length]);

  const selectStudent = (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;
    setFormData((previous) => ({ ...previous, studentId: student.id }));
    setStudentQuery(formatStudentLabel(student));
    setSubmitError(null);
    setIsStudentMenuOpen(false);
    setHighlightedStudentIndex(0);
    setErrors((previous) => ({ ...previous, studentId: '' }));
  };

  const handleStudentQueryChange = (value: string) => {
    setStudentQuery(value);
    setIsStudentMenuOpen(true);
    setHighlightedStudentIndex(0);
    setSubmitError(null);
    if (formData.studentId) {
      setFormData((previous) => ({ ...previous, studentId: '' }));
    }
    if (errors.studentId) {
      setErrors((previous) => ({ ...previous, studentId: '' }));
    }
  };

  const handleStudentInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsStudentMenuOpen(true);
      setHighlightedStudentIndex((previous) => {
        if (filteredStudents.length === 0) return 0;
        if (!isStudentMenuOpen) return 0;
        return Math.min(previous + 1, filteredStudents.length - 1);
      });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsStudentMenuOpen(true);
      setHighlightedStudentIndex((previous) => {
        if (filteredStudents.length === 0) return 0;
        if (!isStudentMenuOpen) return filteredStudents.length - 1;
        return Math.max(previous - 1, 0);
      });
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setIsStudentMenuOpen(true);
      setHighlightedStudentIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setIsStudentMenuOpen(true);
      setHighlightedStudentIndex(Math.max(0, filteredStudents.length - 1));
      return;
    }
    if (event.key === 'Enter' && isStudentMenuOpen && filteredStudents.length > 0) {
      event.preventDefault();
      const target = filteredStudents[highlightedStudentIndex] ?? filteredStudents[0];
      if (target) selectStudent(target.id);
      return;
    }
    if (event.key === 'Escape') {
      setIsStudentMenuOpen(false);
      return;
    }
    if (event.key === 'Tab') {
      setIsStudentMenuOpen(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles: File[] = event.target.files ? Array.from(event.target.files) : [];
    if (incomingFiles.length === 0) return;

    const nextFiles = [...files];
    const nextMessages: string[] = [];
    let addedCount = 0;

    incomingFiles.forEach((file) => {
      const error = validateAttachment(file, nextFiles);
      if (error) {
        nextMessages.push(error);
        return;
      }
      nextFiles.push(file);
      addedCount += 1;
    });

    setFiles(nextFiles);
    setAttachmentMessages((previous) => {
      const deduped = Array.from(new Set([...previous, ...nextMessages]));
      return deduped.slice(-4);
    });
    if (nextMessages.length > 0) {
      trackReferralEvent('referral_attachment_validation_failed', { count: nextMessages.length });
    }
    if (addedCount > 0) {
      setDraftAttachmentMetadata([]);
    }
    if (addedCount > 0 && errors.files) {
      setErrors((previous) => ({ ...previous, files: '' }));
    }
    setSubmitError(null);
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleRetryStudentLoad = () => {
    void classStudentsApi.studentsQuery.refetch();
    void masterStudentsApi.studentsQuery.refetch();
  };

  const handleSubmit = () => {
    setSubmitError(null);
    const normalized = normalizeNotes(formData.notes);
    const validationErrors = validateReferralInput({
      ...formData,
      notes: normalized,
      files,
    });

    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      trackReferralEvent('referral_validation_failed', { fields: Object.keys(validationErrors) });
      return;
    }

    setFormData((previous) => ({ ...previous, notes: normalized }));
    setIsSubmitting(true);
    trackReferralEvent('referral_submit_started', {
      category: formData.type,
      urgency: formData.urgency,
      hasAttachments: files.length > 0,
      attachmentCount: files.length,
      studentSelected: Boolean(formData.studentId),
    });

    const selectedStudent = students.find((student) => student.id === formData.studentId);
    const routedTo = formData.urgency === 'Critical' ? 'Immediate Response Team' : 'Principal Review Team';

    referralCollection.createMutation.mutate(
      {
        studentId: formData.studentId,
        studentName: selectedStudent?.name ?? 'Unknown Student',
        grade: selectedStudent?.grade,
        type: formData.type,
        urgency: formData.urgency,
        notes: normalized,
        attachments: files.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type || undefined,
        })),
        status: 'Pending Review',
        routedTo,
        createdAt: new Date().toISOString(),
      } as unknown as ReferralRecord,
      {
        onSuccess: (created) => {
          const createdReferralId = created.id ?? 'RF-UNKNOWN';
          setSubmitResult({
            referralId: createdReferralId,
            status: created.status,
            routedTo: created.routedTo,
          });
          setHasSavedDraft(false);
          setSavedDraftSnapshot(null);
          setShowDraftRestoredBanner(false);
          clearStoredDraft();
          setDraftAttachmentMetadata([]);
          setIsSuccess(true);
          trackReferralEvent('referral_submit_success', {
            category: formData.type,
            urgency: formData.urgency,
            referralId: createdReferralId,
            routedTo: created.routedTo,
          });
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Unable to submit referral.';
          setSubmitError(message);
          trackReferralEvent('referral_submit_failed', {
            errorType: classifySubmitError(error),
          });
        },
        onSettled: () => {
          setIsSubmitting(false);
        },
      }
    );
  };

  const closeAndReset = () => {
    setHasSavedDraft(false);
    setSavedDraftSnapshot(null);
    setShowDraftRestoredBanner(false);
    clearStoredDraft();
    setSubmitError(null);
    setIsSuccess(false);
    setSubmitResult(null);
    resetForm(defaultStudentId);
    onClose();
  };

  const handleCloseWithSavedDraft = () => {
    persistDraft(formData, files, draftAttachmentMetadata);
    setShowClosePrompt(false);
    setShowDraftRestoredBanner(false);
    trackReferralEvent('referral_draft_kept');
    onClose();
  };

  const handleDiscardDraftAndClose = () => {
    trackReferralEvent('referral_draft_discarded');
    closeAndReset();
  };

  const handleRequestClose = () => {
    if (isSubmitting) return;
    if (isSuccess) {
      closeAndReset();
      return;
    }

    const currentSnapshot = formSnapshot(formData, files, draftAttachmentMetadata);
    if (hasSavedDraft && savedDraftSnapshot === currentSnapshot) {
      onClose();
      return;
    }

    if (!isDirty) {
      onClose();
      return;
    }

    setShowClosePrompt(true);
  };

  const handleCreateAnother = () => {
    setIsSuccess(false);
    setSubmitResult(null);
    resetForm(defaultStudentId);
    setHasSavedDraft(false);
    setSavedDraftSnapshot(null);
    setShowDraftRestoredBanner(false);
    clearStoredDraft();
    trackReferralEvent('referral_create_another');
    window.setTimeout(() => {
      studentInputRef.current?.focus();
    }, 0);
  };

  const handleViewQueue = () => {
    onViewQueue?.(submitResult?.referralId);
    closeAndReset();
  };

  const footer = isSuccess
    ? undefined
    : showClosePrompt
      ? (
          <div className="flex flex-wrap gap-2 justify-end w-full">
            <button
              type="button"
              onClick={() => setShowClosePrompt(false)}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Continue Editing
            </button>
            <button
              type="button"
              onClick={handleCloseWithSavedDraft}
              className="px-4 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              Keep Draft
            </button>
            <button
              type="button"
              onClick={handleDiscardDraftAndClose}
              className="px-4 py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors"
            >
              Discard Draft
            </button>
          </div>
        )
      : (
          <div className="flex w-full flex-col items-end gap-2">
            {submitDisabledReason ? (
              <p className="text-xs font-medium text-amber-700" aria-live="polite">
                {submitDisabledReason}
              </p>
            ) : null}
            <div className="flex gap-3 justify-end w-full">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              title={submitDisabledReason ?? undefined}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <ShieldAlert size={18} /> Submit Referral
                </>
              )}
            </button>
            </div>
          </div>
        );

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={handleRequestClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
            <AlertCircle size={20} />
          </div>
          <span className="text-xl font-bold text-slate-900">New Referral</span>
        </div>
      }
      initialWidth={640}
      initialHeight={720}
      footer={footer}
      showResizeHandle={false}
      mobileMode="sheet"
    >
      {isSuccess && submitResult ? (
        <div className="p-8 flex flex-col items-center justify-center text-center h-full">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Referral Submitted</h3>
          <p className="text-slate-500 text-sm">The referral has been routed and is ready for review.</p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Referral ID</p>
              <p className="text-sm font-bold text-slate-800">{submitResult.referralId}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
              <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Status</p>
              <p className="text-sm font-bold text-amber-800">{submitResult.status}</p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-left">
              <p className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">Routed To</p>
              <p className="text-sm font-bold text-indigo-800">{submitResult.routedTo}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {onViewQueue ? (
              <button
                type="button"
                onClick={handleViewQueue}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                View Referral Queue
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCreateAnother}
              className={`px-4 py-2 text-sm font-semibold rounded-lg border ${
                onViewQueue
                  ? 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50'
                  : 'text-white bg-indigo-600 border-indigo-600 hover:bg-indigo-700'
              }`}
            >
              Create Another Referral
            </button>
            <button
              type="button"
              onClick={closeAndReset}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-transparent rounded-lg hover:text-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form
          className="p-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          {showDraftRestoredBanner ? (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start justify-between gap-3 text-xs text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <p>Draft restored. Continue editing, or discard if you want to start fresh.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  trackReferralEvent('referral_draft_discarded');
                  clearStoredDraft();
                  setHasSavedDraft(false);
                  setSavedDraftSnapshot(null);
                  setShowDraftRestoredBanner(false);
                  resetForm(defaultStudentId);
                }}
                className="font-semibold underline underline-offset-2 hover:text-amber-900"
              >
                Discard draft
              </button>
            </div>
          ) : null}

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3 text-xs text-blue-700">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <p>Include specific details and evidence so the support team can act quickly.</p>
          </div>

          {submitError ? (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-sm text-rose-700"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{submitError}</p>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="referral-student-search"
              className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide"
            >
              Student <span className="text-rose-500">*</span>
            </label>
            <div ref={studentComboboxRef} className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="referral-student-search"
                ref={studentInputRef}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-controls={STUDENT_LISTBOX_ID}
                aria-expanded={isStudentMenuOpen}
                aria-activedescendant={isStudentMenuOpen ? activeStudentOptionId : undefined}
                aria-invalid={Boolean(errors.studentId)}
                placeholder="Search by student name or ID..."
                value={studentQuery}
                onFocus={() => setIsStudentMenuOpen(true)}
                onBlur={(event) => {
                  const nextFocused = event.relatedTarget as Node | null;
                  if (nextFocused && studentComboboxRef.current?.contains(nextFocused)) return;
                  setIsStudentMenuOpen(false);
                }}
                onChange={(event) => handleStudentQueryChange(event.target.value)}
                onKeyDown={handleStudentInputKeyDown}
                className={`w-full pl-9 pr-3 py-3 border rounded-xl text-sm focus:ring-2 outline-none transition-all ${
                  errors.studentId
                    ? 'bg-rose-50 border-rose-300 focus:ring-rose-200 text-rose-900'
                    : 'bg-slate-50 border-slate-200 focus:ring-indigo-500 focus:bg-white'
                }`}
                data-autofocus="true"
              />
              {isStudentMenuOpen ? (
                <ul
                  id={STUDENT_LISTBOX_ID}
                  ref={studentListboxRef}
                  role="listbox"
                  className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                >
                  {areStudentsLoading && students.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-slate-500">Loading students...</li>
                  ) : studentRosterUnavailable ? (
                    <li className="px-3 py-2 text-xs text-rose-700">
                      <p>Student roster is unavailable right now.</p>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={handleRetryStudentLoad}
                        className="mt-1 font-semibold text-indigo-700 hover:text-indigo-800"
                      >
                        Retry loading roster
                      </button>
                    </li>
                  ) : filteredStudents.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-slate-500">No students found.</li>
                  ) : (
                    filteredStudents.map((student, index) => (
                      <li
                        key={student.id}
                        id={`${STUDENT_LISTBOX_ID}-${student.id}`}
                        role="option"
                        aria-selected={index === highlightedStudentIndex}
                        tabIndex={-1}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectStudent(student.id);
                        }}
                        onMouseEnter={() => setHighlightedStudentIndex(index)}
                        className={`cursor-pointer rounded-md px-3 py-2 ${
                          index === highlightedStudentIndex ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{student.name}</p>
                          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {student.source}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">ID {student.id} | Grade {student.grade} | {student.tier}</p>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
            {errors.studentId ? <p className="text-xs text-rose-500 mt-1 font-medium">{errors.studentId}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label htmlFor="referral-category" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">
                Category
              </label>
              <select
                id="referral-category"
                value={formData.type}
                onChange={(event) => {
                  setFormData((previous) => ({ ...previous, type: event.target.value as ReferralCategory }));
                  setSubmitError(null);
                }}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="Behavior">Behavioral Issue</option>
                <option value="Academic">Academic Concern</option>
                <option value="Attendance">Attendance</option>
                <option value="Social-Emotional">Social/Emotional</option>
                <option value="Health">Health/Medical</option>
              </select>
            </div>
            <div>
              <label htmlFor="referral-urgency" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">
                Urgency
              </label>
              <select
                id="referral-urgency"
                value={formData.urgency}
                onChange={(event) => {
                  setFormData((previous) => ({ ...previous, urgency: event.target.value as ReferralUrgency }));
                  setSubmitError(null);
                }}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="Low">Low (Monitor)</option>
                <option value="Medium">Medium (Review)</option>
                <option value="High">High (Urgent)</option>
                <option value="Critical">Critical (Immediate)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="referral-notes" className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">
              Description & Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="referral-notes"
              rows={4}
              placeholder="Describe the incident, prior interventions, and current concern..."
              value={formData.notes}
              onChange={(event) => {
                setFormData((previous) => ({ ...previous, notes: event.target.value }));
                setSubmitError(null);
                if (errors.notes) setErrors((previous) => ({ ...previous, notes: '' }));
              }}
              aria-invalid={Boolean(errors.notes)}
              className={`w-full p-3 border rounded-xl text-sm focus:ring-2 outline-none resize-none transition-all ${
                errors.notes
                  ? 'bg-rose-50 border-rose-300 focus:ring-rose-200 placeholder:text-rose-300'
                  : 'bg-slate-50 border-slate-200 focus:ring-indigo-500 focus:bg-white'
              }`}
            />
            {errors.notes ? <p className="text-xs text-rose-500 mt-1 font-medium">{errors.notes}</p> : null}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Supporting Documentation</label>
              <div className="text-[11px] font-semibold">
                {evidenceIsRequired ? (
                  <span className="text-rose-600">{evidenceReason ?? 'Required for this referral.'}</span>
                ) : (
                  <span className="text-slate-400">Optional for this referral.</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-slate-500">Accepted: PDF, DOC/DOCX, TXT, JPG, PNG, GIF (max {MAX_FILE_SIZE_MB} MB each)</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <Upload size={12} /> Upload File
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept={ACCEPTED_ATTACHMENT_INPUT}
              onChange={handleFileChange}
            />

            {files.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  errors.files ? 'border-rose-300 bg-rose-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs text-slate-400">Click to attach logs, work samples, or images.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={16} className="text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-700 truncate">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50"
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {draftAttachmentMetadata.length > 0 && files.length === 0 ? (
              <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs text-amber-800">
                <p className="font-medium">Draft restored with previous attachments metadata. Reattach files before submitting.</p>
                <p className="mt-1 text-amber-700 truncate">
                  {draftAttachmentMetadata.map((attachment) => attachment.name).join(', ')}
                </p>
              </div>
            ) : null}
            {errors.files ? <p className="text-xs text-rose-500 mt-1 font-medium">{errors.files}</p> : null}
            {attachmentMessages.length > 0 ? (
              <div className="mt-2 space-y-1" aria-live="polite">
                {attachmentMessages.map((message, index) => (
                  <p key={`${message}-${index}`} className="text-xs text-amber-700">
                    {message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </form>
      )}
    </DraggableModal>
  );
};

