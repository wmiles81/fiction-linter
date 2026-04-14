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

    it('returns null when no numbered line is found', () => {
        expect(extractFirstRewrite('The AI just wrote prose instead.')).toBe(null);
        expect(extractFirstRewrite('')).toBe(null);
        expect(extractFirstRewrite(null)).toBe(null);
    });

    it('strips surrounding quotes if the model wrapped the rewrite', () => {
        const raw = '1. "A quoted rewrite."\n2. Second.';
        expect(extractFirstRewrite(raw)).toBe('A quoted rewrite.');
    });
});
