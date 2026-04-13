import { describe, it, expect, vi } from 'vitest';
import {
    splitParagraphs,
    parseScanResponse,
    toDocumentIssues,
    scanDocument
} from './aiScanner';

describe('splitParagraphs', () => {
    it('returns empty for empty/whitespace input', () => {
        expect(splitParagraphs('')).toEqual([]);
        expect(splitParagraphs('   \n\n   \n')).toEqual([]);
    });

    it('extracts a single paragraph with correct offsets', () => {
        const text = 'Hello world.';
        const paragraphs = splitParagraphs(text);
        expect(paragraphs).toHaveLength(1);
        expect(paragraphs[0].text).toBe('Hello world.');
        expect(paragraphs[0].start).toBe(0);
        expect(paragraphs[0].end).toBe(12);
    });

    it('splits on blank lines and records cumulative offsets', () => {
        const text = 'First paragraph.\n\nSecond paragraph.\n\nThird.';
        const paragraphs = splitParagraphs(text);
        expect(paragraphs).toHaveLength(3);
        expect(paragraphs[0].text).toBe('First paragraph.');
        expect(paragraphs[0].start).toBe(0);
        expect(paragraphs[1].text).toBe('Second paragraph.');
        // 'First paragraph.\n\n' is 18 chars -> start of Second is 18
        expect(paragraphs[1].start).toBe(18);
        expect(paragraphs[2].text).toBe('Third.');
    });

    it('handles multi-line paragraphs (soft wraps)', () => {
        const text = 'Line one\nLine two\n\nNew paragraph.';
        const paragraphs = splitParagraphs(text);
        expect(paragraphs).toHaveLength(2);
        expect(paragraphs[0].text).toBe('Line one\nLine two');
        expect(paragraphs[1].text).toBe('New paragraph.');
    });
});

describe('parseScanResponse', () => {
    it('parses clean JSON', () => {
        const raw = '{"findings":[{"text":"foo","category":"weak-phrasing","message":"Too vague."}]}';
        expect(parseScanResponse(raw)).toEqual([
            { text: 'foo', category: 'weak-phrasing', message: 'Too vague.' }
        ]);
    });

    it('strips ```json fences', () => {
        const raw = '```json\n{"findings":[{"text":"bar","category":"ai","message":"x"}]}\n```';
        expect(parseScanResponse(raw)).toEqual([
            { text: 'bar', category: 'ai', message: 'x' }
        ]);
    });

    it('survives preamble before the JSON object', () => {
        const raw = 'Here is the analysis:\n{"findings":[{"text":"baz","category":"ai","message":"y"}]}';
        expect(parseScanResponse(raw)).toEqual([
            { text: 'baz', category: 'ai', message: 'y' }
        ]);
    });

    it('returns [] for invalid JSON rather than throwing', () => {
        expect(parseScanResponse('not valid json at all')).toEqual([]);
        expect(parseScanResponse('{"broken":')).toEqual([]);
    });

    it('returns [] when findings is missing or not an array', () => {
        expect(parseScanResponse('{"ok":true}')).toEqual([]);
        expect(parseScanResponse('{"findings":"not an array"}')).toEqual([]);
    });

    it('drops entries without a text field', () => {
        const raw = '{"findings":[{"text":"good"},{"category":"bad","message":"no text"}]}';
        expect(parseScanResponse(raw)).toEqual([
            { text: 'good', category: 'ai', message: '' }
        ]);
    });
});

describe('toDocumentIssues', () => {
    it('translates paragraph-local text to document offsets', () => {
        const paragraph = { text: 'She felt sad.', start: 100, end: 113 };
        const findings = [{ text: 'felt sad', category: 'emotional-telling', message: 'Show it.' }];
        const issues = toDocumentIssues(paragraph, findings);
        expect(issues).toHaveLength(1);
        expect(issues[0].start).toBe(104); // 100 + 4 ('She ' is 4 chars)
        expect(issues[0].end).toBe(112);
        expect(issues[0].source).toBe('ai');
        expect(issues[0].category).toBe('emotional-telling');
    });

    it('skips findings whose text does not exist in the paragraph', () => {
        // Model hallucinated a phrase the paragraph does not contain.
        const paragraph = { text: 'The sky was blue.', start: 0, end: 17 };
        const findings = [{ text: 'beige unicorn', category: 'x', message: 'hallucinated' }];
        expect(toDocumentIssues(paragraph, findings)).toEqual([]);
    });
});

describe('scanDocument', () => {
    it('invokes callAi once per paragraph and accumulates issues', async () => {
        const text = 'First sentence.\n\nSecond sentence.';
        const callAi = vi.fn(async (para) => {
            if (para === 'First sentence.') {
                return {
                    ok: true,
                    content: '{"findings":[{"text":"First","category":"ai","message":"bad opener"}]}'
                };
            }
            return { ok: true, content: '{"findings":[]}' };
        });
        const result = await scanDocument({ text, callAi });
        expect(callAi).toHaveBeenCalledTimes(2);
        expect(result.ok).toBe(true);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].start).toBe(0);
        expect(result.issues[0].end).toBe(5);
    });

    it('reports progress after each paragraph', async () => {
        const text = 'P1.\n\nP2.\n\nP3.';
        const callAi = async () => ({ ok: true, content: '{"findings":[]}' });
        const onProgress = vi.fn();
        await scanDocument({ text, callAi, onProgress });
        expect(onProgress).toHaveBeenCalledTimes(3);
        expect(onProgress.mock.calls[0][0]).toEqual({ current: 1, total: 3, issues: [] });
        expect(onProgress.mock.calls[2][0]).toEqual({ current: 3, total: 3, issues: [] });
    });

    it('stops at the next paragraph boundary when aborted', async () => {
        const text = 'P1.\n\nP2.\n\nP3.';
        const controller = new AbortController();
        const callAi = vi.fn(async () => {
            // Abort after the first paragraph completes.
            controller.abort();
            return { ok: true, content: '{"findings":[]}' };
        });
        const result = await scanDocument({ text, callAi, signal: controller.signal });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('Scan cancelled');
        // First paragraph was processed, second+third skipped.
        expect(callAi).toHaveBeenCalledTimes(1);
    });

    it('continues through individual AI failures without aborting the whole scan', async () => {
        const text = 'P1.\n\nP2.';
        const callAi = vi.fn()
            .mockResolvedValueOnce({ ok: false, error: 'rate limit' })
            .mockResolvedValueOnce({ ok: true, content: '{"findings":[{"text":"P2","category":"ai","message":"x"}]}' });
        const result = await scanDocument({ text, callAi });
        expect(result.ok).toBe(true);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].message).toBe('x');
    });
});
