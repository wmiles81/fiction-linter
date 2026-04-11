import { describe, it, expect } from 'vitest';
import { isFileEligible, getFileKind } from './fileEligibility';

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

    it('returns true for .docx files (imported via mammoth)', () => {
        expect(isFileEligible('manuscript.docx')).toBe(true);
    });

    it('returns true for .gdoc files (opened in browser)', () => {
        expect(isFileEligible('shared-doc.gdoc')).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isFileEligible('MANUSCRIPT.MD')).toBe(true);
        expect(isFileEligible('Chapter1.Md')).toBe(true);
        expect(isFileEligible('Manuscript.DOCX')).toBe(true);
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

describe('getFileKind', () => {
    it('returns "text" for markdown and txt files', () => {
        expect(getFileKind('manuscript.md')).toBe('text');
        expect(getFileKind('notes.markdown')).toBe('text');
        expect(getFileKind('readme.txt')).toBe('text');
    });

    it('returns "docx" for Word documents', () => {
        expect(getFileKind('manuscript.docx')).toBe('docx');
        expect(getFileKind('Chapter1.DOCX')).toBe('docx');
    });

    it('returns "gdoc" for Google Docs pointer files', () => {
        expect(getFileKind('shared.gdoc')).toBe('gdoc');
    });

    it('returns null for ineligible files', () => {
        expect(getFileKind('image.jpg')).toBeNull();
        expect(getFileKind('doc.pdf')).toBeNull();
        expect(getFileKind('README')).toBeNull();
        expect(getFileKind(null)).toBeNull();
        expect(getFileKind('')).toBeNull();
    });
});
