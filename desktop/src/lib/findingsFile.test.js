import { describe, it, expect } from 'vitest';
import {
    tokenizeWords,
    wordNumberAt,
    computeWordBounds,
    buildFindingsPayload,
    findingsPathFor
} from './findingsFile';

describe('tokenizeWords', () => {
    it('returns empty for empty / whitespace-only input', () => {
        expect(tokenizeWords('')).toEqual([]);
        expect(tokenizeWords('   \t   ')).toEqual([]);
    });

    it('tokenizes a simple line with offsets and 1-indexed word numbers', () => {
        const tokens = tokenizeWords('She felt sad.');
        expect(tokens).toHaveLength(3);
        expect(tokens[0]).toMatchObject({ text: 'She', start: 0, end: 3, number: 1 });
        expect(tokens[1]).toMatchObject({ text: 'felt', start: 4, end: 8, number: 2 });
        expect(tokens[2]).toMatchObject({ text: 'sad.', start: 9, end: 13, number: 3 });
    });

    it('treats runs of whitespace as single separators', () => {
        const tokens = tokenizeWords('one   two\t\tthree');
        expect(tokens.map(t => t.text)).toEqual(['one', 'two', 'three']);
        expect(tokens.map(t => t.number)).toEqual([1, 2, 3]);
    });
});

describe('wordNumberAt', () => {
    const line = 'The quick brown fox';

    it('returns 1 for the first word', () => {
        expect(wordNumberAt(line, 0)).toBe(1);
        expect(wordNumberAt(line, 2)).toBe(1); // "e" of "The"
    });

    it('returns the word containing the offset', () => {
        expect(wordNumberAt(line, 4)).toBe(2);  // start of "quick"
        expect(wordNumberAt(line, 8)).toBe(2);  // end of "quick"
        expect(wordNumberAt(line, 10)).toBe(3); // start of "brown"
    });

    it('returns the next word when the offset is in leading whitespace', () => {
        // The space between "quick" and "brown" is at offset 9
        expect(wordNumberAt(line, 9)).toBe(3);
    });

    it('returns 1 for lines with no words', () => {
        expect(wordNumberAt('', 0)).toBe(1);
        expect(wordNumberAt('   ', 0)).toBe(1);
    });
});

describe('computeWordBounds', () => {
    const line = 'She felt sad about something.';
    // words: She=1, felt=2, sad=3, about=4, something.=5

    it('finds the word range for a multi-word finding', () => {
        // "felt sad" → cols 5..13 (1-indexed start), length 8
        const bounds = computeWordBounds(line, 5, 8);
        expect(bounds).toEqual({ wordStart: 2, wordEnd: 3 });
    });

    it('handles a single-word finding', () => {
        // "about" → col 14, length 5
        expect(computeWordBounds(line, 14, 5)).toEqual({ wordStart: 4, wordEnd: 4 });
    });

    it('clamps startCol < 1 to the first word', () => {
        expect(computeWordBounds(line, 0, 3)).toEqual({ wordStart: 1, wordEnd: 1 });
    });

    it('returns {1, 1} for an empty line', () => {
        expect(computeWordBounds('', 1, 0)).toEqual({ wordStart: 1, wordEnd: 1 });
    });
});

describe('buildFindingsPayload', () => {
    const plainText = 'Line one has words.\nLine two has more words too.\nLine three.';
    // Line 1 offsets: 0..19 (\n at 19)
    // Line 2 offsets: 20..49 (\n at 49)
    // Line 3 offsets: 50..60

    const findings = [
        // "more" in line 2 — global offset 33..37, line 2 col 14
        {
            source: 'ai',
            category: 'weak-phrasing',
            severity: 'warning',
            message: 'vague',
            start: 33,
            end: 37,
            text: 'more',
            line: 2,
            column: 14
        },
        // "Line" at start of line 1
        {
            source: 'pattern',
            category: 'generic',
            severity: 'info',
            message: 'flagged',
            start: 0,
            end: 4,
            text: 'Line',
            line: 1,
            column: 1
        }
    ];

    it('produces a deterministic payload with schema version', () => {
        const payload = buildFindingsPayload({
            path: '/tmp/story.md',
            name: 'story.md',
            plainText,
            findings,
            scannedAt: '2026-04-15T00:00:00.000Z'
        });
        expect(payload.$schema).toBe('fiction-linter-findings-v1');
        expect(payload.document).toEqual({
            path: '/tmp/story.md',
            name: 'story.md',
            byteLength: plainText.length
        });
        expect(payload.scannedAt).toBe('2026-04-15T00:00:00.000Z');
    });

    it('sorts findings by line then column then source', () => {
        const payload = buildFindingsPayload({
            path: '/tmp/story.md', name: 'story.md', plainText, findings,
            scannedAt: '2026-04-15T00:00:00.000Z'
        });
        // Line 1 finding first, then line 2
        expect(payload.findings.map(f => f.line)).toEqual([1, 2]);
    });

    it('computes wordStart / wordEnd from the line text', () => {
        const payload = buildFindingsPayload({
            path: '/tmp/story.md', name: 'story.md', plainText, findings,
            scannedAt: '2026-04-15T00:00:00.000Z'
        });
        // Line 2 is "Line two has more words too." — words: Line=1, two=2, has=3, more=4, words=5, too.=6
        // Our "more" finding at column 18 with length 4 should land on word 4.
        const moreFinding = payload.findings.find(f => f.text === 'more');
        expect(moreFinding.wordStart).toBe(4);
        expect(moreFinding.wordEnd).toBe(4);
        // Line 1 "Line" is word 1.
        const lineFinding = payload.findings.find(f => f.text === 'Line');
        expect(lineFinding.wordStart).toBe(1);
        expect(lineFinding.wordEnd).toBe(1);
    });

    it('includes counts grouped by source, category, and severity', () => {
        const payload = buildFindingsPayload({
            path: '/tmp/story.md', name: 'story.md', plainText, findings,
            scannedAt: '2026-04-15T00:00:00.000Z'
        });
        expect(payload.counts.total).toBe(2);
        expect(payload.counts.bySource).toEqual({ ai: 1, pattern: 1 });
        expect(payload.counts.byCategory).toEqual({ 'weak-phrasing': 1, generic: 1 });
        expect(payload.counts.bySeverity).toEqual({ warning: 1, info: 1 });
    });

    it('same findings produce byte-identical JSON across runs (excluding timestamp)', () => {
        const shuffled = [...findings].reverse();
        const a = JSON.stringify(buildFindingsPayload({
            path: '/x', name: 'x', plainText, findings,
            scannedAt: '2026-04-15T00:00:00.000Z'
        }), null, 2);
        const b = JSON.stringify(buildFindingsPayload({
            path: '/x', name: 'x', plainText, findings: shuffled,
            scannedAt: '2026-04-15T00:00:00.000Z'
        }), null, 2);
        expect(a).toBe(b);
    });

    it('falls back to slicing plainText when finding.text is missing', () => {
        const payload = buildFindingsPayload({
            path: '/tmp/x.md', name: 'x.md', plainText, scannedAt: '2026-04-15T00:00:00.000Z',
            findings: [{
                source: 'pattern', category: 'x', severity: 'info', message: 'y',
                start: 5, end: 8, line: 1, column: 6
                // no text field
            }]
        });
        expect(payload.findings[0].text).toBe('one'); // plainText[5..8]
    });

    it('handles empty findings gracefully', () => {
        const payload = buildFindingsPayload({
            path: '/a.md', name: 'a.md', plainText: 'hello.', findings: [],
            scannedAt: '2026-04-15T00:00:00.000Z'
        });
        expect(payload.findings).toEqual([]);
        expect(payload.counts.total).toBe(0);
    });
});

describe('findingsPathFor', () => {
    it('appends .findings.json to the source path', () => {
        expect(findingsPathFor('/foo/chapter1.md')).toBe('/foo/chapter1.md.findings.json');
    });

    it('returns null for empty input', () => {
        expect(findingsPathFor('')).toBe(null);
        expect(findingsPathFor(undefined)).toBe(null);
    });
});
