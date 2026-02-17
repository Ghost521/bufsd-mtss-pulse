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
import { CLASS_ROSTER_DATA } from '../constants';
import { DraggableModal } from './DraggableModal';
import {
  evidenceRequirementReason,
  normalizeNotes,
  requiresEvidence,
  validateAttachment,
  validateReferralInput,
  type ReferralCategory,
  type ReferralUrgency,
} from '../services/referralValidation';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStudentId?: string;
  onViewQueue?: () => void;
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

const STUDENT_LISTBOX_ID = 'referral-student-options';
const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_ATTACHMENT_INPUT = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif';

const buildDefaultForm = (studentId = ''): ReferralFormData => ({
  studentId,
  type: 'Behavior',
  urgency: 'Medium',
  notes: '',
});

const formatStudentLabel = (student: (typeof CLASS_ROSTER_DATA)[number]): string => `${student.name} (Grade ${student.grade})`;

const formSnapshot = (formData: ReferralFormData, files: File[]): string =>
  JSON.stringify({
    formData: {
      ...formData,
      notes: normalizeNotes(formData.notes),
    },
    files: files.map((file) => ({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      type: file.type,
    })),
  });

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
  const [formData, setFormData] = useState<ReferralFormData>(buildDefaultForm(defaultStudentId));
  const [studentQuery, setStudentQuery] = useState('');
  const [isStudentMenuOpen, setIsStudentMenuOpen] = useState(false);
  const [highlightedStudentIndex, setHighlightedStudentIndex] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [attachmentMessages, setAttachmentMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<ReferralSubmitResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState<string | null>(null);
  const [showDraftRestoredBanner, setShowDraftRestoredBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentInputRef = useRef<HTMLInputElement>(null);
  const baselineFormRef = useRef<ReferralFormData>(buildDefaultForm(defaultStudentId));

  const filteredStudents = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) return CLASS_ROSTER_DATA;
    return CLASS_ROSTER_DATA.filter((student) =>
      `${student.name} ${student.grade} ${student.id} ${student.tier}`.toLowerCase().includes(query)
    );
  }, [studentQuery]);

  const evidenceIsRequired = requiresEvidence(formData.type, formData.urgency);
  const evidenceReason = evidenceRequirementReason(formData.type, formData.urgency);

  const isDirty = useMemo(() => {
    const baseline = baselineFormRef.current;
    return (
      formData.studentId !== baseline.studentId ||
      formData.type !== baseline.type ||
      formData.urgency !== baseline.urgency ||
      normalizeNotes(formData.notes) !== normalizeNotes(baseline.notes) ||
      files.length > 0
    );
  }, [files.length, formData]);

  const resetForm = useCallback((nextStudentId = defaultStudentId) => {
    const nextForm = buildDefaultForm(nextStudentId);
    baselineFormRef.current = nextForm;
    setFormData(nextForm);
    const nextStudent = CLASS_ROSTER_DATA.find((student) => student.id === nextStudentId);
    setStudentQuery(nextStudent ? formatStudentLabel(nextStudent) : '');
    setFiles([]);
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
    setShowClosePrompt(false);
    setIsStudentMenuOpen(false);
    setHighlightedStudentIndex(0);
    setIsSuccess(false);
    setSubmitResult(null);

    if (hasSavedDraft) {
      setShowDraftRestoredBanner(true);
      trackReferralEvent('referral_modal_opened', { restoredDraft: true });
      return;
    }

    resetForm(defaultStudentId);
    setShowDraftRestoredBanner(false);
    trackReferralEvent('referral_modal_opened', { restoredDraft: false });
  }, [defaultStudentId, hasSavedDraft, isOpen, resetForm]);

  useEffect(() => {
    if (highlightedStudentIndex < filteredStudents.length) return;
    setHighlightedStudentIndex(Math.max(0, filteredStudents.length - 1));
  }, [filteredStudents.length, highlightedStudentIndex]);

  const selectStudent = (studentId: string) => {
    const student = CLASS_ROSTER_DATA.find((item) => item.id === studentId);
    if (!student) return;
    setFormData((previous) => ({ ...previous, studentId: student.id }));
    setStudentQuery(formatStudentLabel(student));
    setIsStudentMenuOpen(false);
    setHighlightedStudentIndex(0);
    setErrors((previous) => ({ ...previous, studentId: '' }));
  };

  const handleStudentQueryChange = (value: string) => {
    setStudentQuery(value);
    setIsStudentMenuOpen(true);
    setHighlightedStudentIndex(0);
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
        return Math.min(previous + 1, filteredStudents.length - 1);
      });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsStudentMenuOpen(true);
      setHighlightedStudentIndex((previous) => Math.max(previous - 1, 0));
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
    setAttachmentMessages((previous) => [...previous, ...nextMessages]);
    if (nextMessages.length > 0) {
      trackReferralEvent('referral_attachment_validation_failed', { count: nextMessages.length });
    }
    if (addedCount > 0 && errors.files) {
      setErrors((previous) => ({ ...previous, files: '' }));
    }
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  };

  const createReferralId = (): string => `RF-${Date.now().toString().slice(-6)}`;

  const handleSubmit = () => {
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
    });

    window.setTimeout(() => {
      const routedTo = formData.urgency === 'Critical' ? 'Immediate Response Team' : 'Principal Review Team';
      setSubmitResult({
        referralId: createReferralId(),
        status: 'Pending Review',
        routedTo,
      });
      setHasSavedDraft(false);
      setSavedDraftSnapshot(null);
      setShowDraftRestoredBanner(false);
      setIsSubmitting(false);
      setIsSuccess(true);
      trackReferralEvent('referral_submit_success', {
        category: formData.type,
        urgency: formData.urgency,
      });
    }, 900);
  };

  const closeAndReset = () => {
    setHasSavedDraft(false);
    setSavedDraftSnapshot(null);
    setShowDraftRestoredBanner(false);
    setIsSuccess(false);
    setSubmitResult(null);
    resetForm(defaultStudentId);
    onClose();
  };

  const handleCloseWithSavedDraft = () => {
    setHasSavedDraft(true);
    setSavedDraftSnapshot(formSnapshot(formData, files));
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

    const currentSnapshot = formSnapshot(formData, files);
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
    trackReferralEvent('referral_create_another');
    window.setTimeout(() => {
      studentInputRef.current?.focus();
    }, 0);
  };

  const handleViewQueue = () => {
    onViewQueue?.();
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
          <div className="flex gap-3 justify-end w-full">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
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
            <button
              type="button"
              onClick={handleViewQueue}
              disabled={!onViewQueue}
              className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              View Referral Queue
            </button>
            <button
              type="button"
              onClick={handleCreateAnother}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Create Another Referral
            </button>
            <button
              type="button"
              onClick={closeAndReset}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
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

          <div>
            <label
              htmlFor="referral-student-search"
              className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide"
            >
              Student <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="referral-student-search"
                ref={studentInputRef}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-controls={STUDENT_LISTBOX_ID}
                aria-expanded={isStudentMenuOpen}
                aria-invalid={Boolean(errors.studentId)}
                placeholder="Search by student name or ID..."
                value={studentQuery}
                onFocus={() => setIsStudentMenuOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsStudentMenuOpen(false), 120);
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
                  role="listbox"
                  className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                >
                  {filteredStudents.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-slate-500">No students found.</li>
                  ) : (
                    filteredStudents.map((student, index) => (
                      <li
                        key={student.id}
                        role="option"
                        aria-selected={index === highlightedStudentIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectStudent(student.id);
                        }}
                        className={`cursor-pointer rounded-md px-3 py-2 ${
                          index === highlightedStudentIndex ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-semibold">{student.name}</p>
                        <p className="text-xs text-slate-500">ID {student.id} • Grade {student.grade} • {student.tier}</p>
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
                onChange={(event) => setFormData((previous) => ({ ...previous, type: event.target.value as ReferralCategory }))}
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
                onChange={(event) => setFormData((previous) => ({ ...previous, urgency: event.target.value as ReferralUrgency }))}
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
