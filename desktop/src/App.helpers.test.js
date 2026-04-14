import { describe, it, expect } from 'vitest';
import { extractFirstRewrite } from './App';

describe('extractFirstRewrite', () => {
    it('extracts the first numbered alternative from a rewrite response', () => {
        const raw = [
            '1. Her shoulders slumped and she turned toward the window.',
            '2. Sadness weighted her, a slow settling of dust.',
            '3. She let the silence answer for her.'
        ].join('\n');
        expect(extractFirstRewrite(raw))
            .toBe('Her shoulders slumped and she turned toward the window.');
    });

    it('strips markdown code fences', () => {
        const raw = '```\n1. Fresh rewrite.\n2. Other.\n3. Third.\n```';
        expect(extractFirstRewrite(raw)).toBe('Fresh rewrite.');
    });

    it('tolerates 1) or 1: prefix variants', () => {
        expect(extractFirstRewrite('1) Alpha.\n2) Beta.')).toBe('Alpha.');
        expect(extractFirstRewrite('1: Alpha.\n2: Beta.')).toBe('Alpha.');
    });

    it('returns null for empty / non-string input', () => {
        expect(extractFirstRewrite('')).toBe(null);
        expect(extractFirstRewrite(null)).toBe(null);
    });

    it('strips surrounding quotes if the model wrapped the rewrite', () => {
        const raw = '1. "A quoted rewrite."\n2. Second.';
        expect(extractFirstRewrite(raw)).toBe('A quoted rewrite.');
    });

    it('falls back to the first paragraph when no numbering is present', () => {
        // Real regression: a free model returned three rewrites as
        // paragraphs separated by blank lines, no "1." prefix. Parser
        // used to give up entirely — now it picks the first paragraph.
        const raw = [
            'warmth coils low in my belly',
            '',
            'a slow heat settles low in my belly',
            '',
            'something tightens, low and warm, in my belly'
        ].join('\n');
        expect(extractFirstRewrite(raw)).toBe('warmth coils low in my belly');
    });

    it('skips a preamble line ("Here are three alternatives:") before paragraphs', () => {
        const raw = [
            'Here are three alternatives:',
            '',
            'warmth coils low in her belly',
            '',
            'a slow heat settles in'
        ].join('\n');
        expect(extractFirstRewrite(raw)).toBe('warmth coils low in her belly');
    });

    it('prefers numbered parsing over paragraph fallback when both could apply', () => {
        // Model returned numbered alternatives but also separated them
        // with blank lines. Numbered strategy should win.
        const raw = '1. First answer.\n\n2. Second answer.\n\n3. Third answer.';
        expect(extractFirstRewrite(raw)).toBe('First answer.');
    });
});
