import { describe, it, expect } from 'vitest';
import { isFileEligible } from './fileEligibility';

describe('isFileEligible', () => {
    it('returns true for .md files', () => {
        expect(isFileEligible('manuscript.md')).toBe(true);
    });

    it('returns true for .markdown files', () => {
        expect(isFileEligible('notes.markdown')).toBe(true);
    });

    it('returns true for .txt files', () => {
        expect(isFileEligible('readme.txt')).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isFileEligible('MANUSCRIPT.MD')).toBe(true);
        expect(isFileEligible('Chapter1.Md')).toBe(true);
    });

    it('returns false for .docx (Phase 7 baseline excludes it)', () => {
        expect(isFileEligible('manuscript.docx')).toBe(false);
    });

    it('returns false for .pdf, .jpg, binaries', () => {
        expect(isFileEligible('image.jpg')).toBe(false);
        expect(isFileEligible('doc.pdf')).toBe(false);
        expect(isFileEligible('bin.dat')).toBe(false);
    });

    it('returns false for files with no extension', () => {
        expect(isFileEligible('README')).toBe(false);
        expect(isFileEligible('.gitignore')).toBe(false);
    });

    it('returns false for empty or nullish input', () => {
        expect(isFileEligible('')).toBe(false);
        expect(isFileEligible(null)).toBe(false);
        expect(isFileEligible(undefined)).toBe(false);
    });
});
