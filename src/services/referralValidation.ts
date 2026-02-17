export type ReferralCategory = 'Behavior' | 'Academic' | 'Attendance' | 'Social-Emotional' | 'Health';
export type ReferralUrgency = 'Low' | 'Medium' | 'High' | 'Critical';

export interface FileLike {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface ReferralValidationInput {
  studentId: string;
  type: ReferralCategory;
  urgency: ReferralUrgency;
  notes: string;
  files: FileLike[];
}

export interface ReferralValidationErrors {
  studentId?: string;
  notes?: string;
  files?: string;
}

const MB = 1024 * 1024;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * MB;
export const REQUIRED_EVIDENCE_TYPES: ReferralCategory[] = ['Behavior', 'Health'];
export const REQUIRED_EVIDENCE_URGENCIES: ReferralUrgency[] = ['High', 'Critical'];

export const ACCEPTED_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ACCEPTED_ATTACHMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.txt', '.doc', '.docx'];

const extensionOf = (fileName: string): string => {
  const extension = fileName.toLowerCase().split('.').pop();
  return extension ? `.${extension}` : '';
};

export const normalizeNotes = (notes: string): string => notes.trim();

export const requiresEvidence = (type: ReferralCategory, urgency: ReferralUrgency): boolean =>
  REQUIRED_EVIDENCE_TYPES.includes(type) || REQUIRED_EVIDENCE_URGENCIES.includes(urgency);

export const evidenceRequirementReason = (type: ReferralCategory, urgency: ReferralUrgency): string | null => {
  const typeRequired = REQUIRED_EVIDENCE_TYPES.includes(type);
  const urgencyRequired = REQUIRED_EVIDENCE_URGENCIES.includes(urgency);
  if (typeRequired && urgencyRequired) return 'Required due to category and urgency.';
  if (typeRequired) return `Required for ${type.toLowerCase()} referrals.`;
  if (urgencyRequired) return `Required for ${urgency.toLowerCase()} urgency referrals.`;
  return null;
};

export const validateAttachment = (file: FileLike, existingFiles: FileLike[]): string | null => {
  const extension = extensionOf(file.name);
  const typeAllowed = ACCEPTED_ATTACHMENT_TYPES.has(file.type);
  const extensionAllowed = ACCEPTED_ATTACHMENT_EXTENSIONS.includes(extension);
  if (!typeAllowed && !extensionAllowed) {
    return 'Unsupported file type. Use PDF, DOC/DOCX, TXT, JPG, PNG, or GIF.';
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return 'File exceeds 10 MB limit.';
  }
  const duplicate = existingFiles.some(
    (existing) =>
      existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified
  );
  if (duplicate) {
    return `Duplicate file skipped: ${file.name}`;
  }
  return null;
};

export const validateReferralInput = (input: ReferralValidationInput): ReferralValidationErrors => {
  const errors: ReferralValidationErrors = {};
  if (!input.studentId) errors.studentId = 'Please select a student.';
  if (!normalizeNotes(input.notes)) errors.notes = 'Please provide a description.';
  if (requiresEvidence(input.type, input.urgency) && input.files.length === 0) {
    errors.files = 'Supporting documentation is required for this referral.';
  }
  return errors;
};

