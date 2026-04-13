import { describe, it, expect, vi } from 'vitest';
import {
    splitParagraphs,
    parseScanResponse,
    toDocumentIssues,
    chunkParagraphs,
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

describe('chunkParagraphs', () => {
    const buildParas = (text) => splitParagraphs(text);

    it('returns empty for empty paragraph list', () => {
        expect(chunkParagraphs([], '', 100)).toEqual([]);
    });

    it('groups multiple short paragraphs into a single chunk under target', () => {
        const text = 'one two three.\n\nfour five.\n\nsix seven eight.';
        const paras = buildParas(text);
        const chunks = chunkParagraphs(paras, text, 100);
        expect(chunks).toHaveLength(1);
        expect(chunks[0].paragraphCount).toBe(3);
        expect(chunks[0].start).toBe(0);
        expect(chunks[0].end).toBe(text.length);
    });

    it('starts a new chunk when adding next paragraph would exceed target', () => {
        // Paragraphs of ~5 words each. Target 10 → 2 paras per chunk.
        const text = [
            'a b c d e.',
            'f g h i j.',
            'k l m n o.',
            'p q r s t.'
        ].join('\n\n');
        const chunks = chunkParagraphs(buildParas(text), text, 10);
        // Para 1 (5w) fits → group has 5w. Adding para 2 (5w) → 10w which is
        // NOT greater than 10, so it's added → chunk 1 has 2 paras, 10 words.
        // Adding para 3 (5w) → 15w, exceeds → flush chunk 1, start chunk 2.
        expect(chunks).toHaveLength(2);
        expect(chunks[0].paragraphCount).toBe(2);
        expect(chunks[1].paragraphCount).toBe(2);
    });

    it('keeps a single overlong paragraph as one chunk rather than splitting it', () => {
        const longPara = Array(50).fill('word').join(' ');
        const text = `short.\n\n${longPara}\n\nshort.`;
        const chunks = chunkParagraphs(buildParas(text), text, 10);
        // Splitting mid-paragraph would break offset translation, so the long
        // one occupies its own chunk despite being over the target.
        expect(chunks).toHaveLength(3);
        expect(chunks[1].paragraphCount).toBe(1);
    });

    it('chunk text is the EXACT document slice including inter-paragraph whitespace', () => {
        const text = 'first.\n\nsecond.';
        const chunks = chunkParagraphs(buildParas(text), text, 100);
        expect(chunks[0].text).toBe('first.\n\nsecond.');
    });
});

describe('scanDocument', () => {
    it('groups all paragraphs into a single chunk under default 2K target', async () => {
        const text = 'First sentence.\n\nSecond sentence.';
        const callAi = vi.fn(async (chunk) => ({
            ok: true,
            content: '{"findings":[{"text":"First","category":"ai","message":"bad opener"}]}'
        }));
        const result = await scanDocument({ text, callAi });
        // Both paragraphs combined = ~4 words → fits in one 2K chunk.
        expect(callAi).toHaveBeenCalledTimes(1);
        expect(result.ok).toBe(true);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].start).toBe(0);
        expect(result.issues[0].end).toBe(5);
    });

    it('makes one call per chunk when targetWords forces splits', async () => {
        const text = 'a b c d e.\n\nf g h i j.\n\nk l m n o.\n\np q r s t.';
        const callAi = vi.fn(async () => ({ ok: true, content: '{"findings":[]}' }));
        await scanDocument({ text, callAi, targetWords: 10 });
        expect(callAi).toHaveBeenCalledTimes(2);
    });

    it('reports progress after each chunk', async () => {
        const text = 'a b c d e.\n\nf g h i j.\n\nk l m n o.\n\np q r s t.';
        const callAi = async () => ({ ok: true, content: '{"findings":[]}' });
        const onProgress = vi.fn();
        await scanDocument({ text, callAi, onProgress, targetWords: 10 });
        expect(onProgress).toHaveBeenCalledTimes(2);
        expect(onProgress.mock.calls[0][0]).toMatchObject({ current: 1, total: 2 });
        expect(onProgress.mock.calls[1][0]).toMatchObject({ current: 2, total: 2 });
    });

    it('stops at the next chunk boundary when aborted', async () => {
        const text = 'a b c d e.\n\nf g h i j.\n\nk l m n o.\n\np q r s t.';
        const controller = new AbortController();
        const callAi = vi.fn(async () => {
            controller.abort();
            return { ok: true, content: '{"findings":[]}' };
        });
        const result = await scanDocument({
            text, callAi, signal: controller.signal, targetWords: 10
        });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('Scan cancelled');
        expect(callAi).toHaveBeenCalledTimes(1);
    });

    it('counts failed chunks and returns the last error so the UI can surface it', async () => {
        const text = 'one two three.\n\nfour five six.';
        const callAi = vi.fn(async () => ({ ok: false, error: '429 rate limited' }));
        const result = await scanDocument({ text, callAi, targetWords: 5 });
        expect(result.ok).toBe(true);
        expect(result.issues).toHaveLength(0);
        expect(result.failedChunks).toBe(2);
        expect(result.lastError).toBe('429 rate limited');
    });

    it('treats non-JSON responses as failures, not silent zero-findings', async () => {
        // Simulate a model that ignored the JSON instruction and returned prose.
        const text = 'hello world.';
        const callAi = vi.fn(async () => ({
            ok: true,
            content: 'I think the prose is generally fine, no major issues.'
        }));
        const result = await scanDocument({ text, callAi });
        expect(result.ok).toBe(true);
        expect(result.failedChunks).toBe(1);
        expect(result.lastError).toMatch(/findings JSON/);
    });
});
