import { describe, expect, it } from 'vitest';
import {
  normalizeNotes,
  requiresEvidence,
  validateAttachment,
  validateReferralInput,
} from '../src/services/referralValidation';

describe('referral validation', () => {
  it('trims notes before validation logic', () => {
    expect(normalizeNotes('  details here  ')).toBe('details here');
    expect(normalizeNotes('   ')).toBe('');
  });

  it('requires evidence for high-risk combinations', () => {
    expect(requiresEvidence('Behavior', 'Low')).toBe(true);
    expect(requiresEvidence('Academic', 'High')).toBe(true);
    expect(requiresEvidence('Academic', 'Low')).toBe(false);
  });

  it('rejects unsupported, oversize, and duplicate attachments', () => {
    const baseFile = {
      name: 'notes.pdf',
      size: 10,
      lastModified: 1,
      type: 'application/pdf',
    };
    expect(validateAttachment(baseFile, [])).toBeNull();
    expect(validateAttachment({ ...baseFile, name: 'script.exe', type: 'application/x-msdownload' }, [])).toContain(
      'Unsupported file type'
    );
    expect(validateAttachment({ ...baseFile, size: 11 * 1024 * 1024 }, [])).toContain('10 MB');
    expect(validateAttachment(baseFile, [baseFile])).toContain('Duplicate file');
  });

  it('validates student, notes, and conditional evidence requirements', () => {
    expect(
      validateReferralInput({
        studentId: '',
        type: 'Behavior',
        urgency: 'High',
        notes: '   ',
        files: [],
      })
    ).toEqual({
      studentId: 'Please select a student.',
      notes: 'Please provide a description.',
      files: 'Supporting documentation is required for this referral.',
    });

    expect(
      validateReferralInput({
        studentId: '1001',
        type: 'Academic',
        urgency: 'Low',
        notes: 'Needs reading intervention review',
        files: [],
      })
    ).toEqual({});
  });
});

