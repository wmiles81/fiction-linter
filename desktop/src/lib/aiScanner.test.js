import { describe, it, expect, vi } from 'vitest';
import {
    splitParagraphs,
    parseScanResponse,
    toDocumentIssues,
    chunkParagraphs,
    scanDocument,
    findNextIssue,
    AI_CATEGORY_SEVERITY,
    isRateLimitError,
    callChunkWithRetry
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

    it('maps AI categories to severities', () => {
        const paragraph = { text: 'She felt sad and she was very generic.', start: 0, end: 38 };
        const findings = [
            { text: 'felt sad', category: 'emotional-telling', message: 'x' },
            { text: 'very generic', category: 'generic', message: 'y' },
            { text: 'was', category: 'over-explanation', message: 'z' }
        ];
        const issues = toDocumentIssues(paragraph, findings);
        expect(issues[0].severity).toBe('error');   // emotional-telling → error
        expect(issues[1].severity).toBe('warning'); // generic → warning
        expect(issues[2].severity).toBe('info');    // over-explanation → info
    });

    it('AI_CATEGORY_SEVERITY exposes the full mapping', () => {
        expect(AI_CATEGORY_SEVERITY).toMatchObject({
            'show-vs-tell': 'error',
            'emotional-telling': 'error',
            'weak-phrasing': 'warning',
            'generic': 'warning',
            'over-explanation': 'info'
        });
    });
});

describe('isRateLimitError', () => {
    it('matches 429 anywhere in the error string', () => {
        expect(isRateLimitError('429 Provider returned error')).toBe(true);
        expect(isRateLimitError('Request failed: 429')).toBe(true);
        expect(isRateLimitError('429 Too Many Requests')).toBe(true);
    });
    it('does not match unrelated errors', () => {
        expect(isRateLimitError('401 Unauthorized')).toBe(false);
        expect(isRateLimitError('Network error')).toBe(false);
        expect(isRateLimitError('')).toBe(false);
        expect(isRateLimitError(null)).toBe(false);
    });
});

describe('callChunkWithRetry', () => {
    it('returns immediately on success with retryCount 0', async () => {
        const callAi = vi.fn(async () => ({ ok: true, content: '{"findings":[]}' }));
        const result = await callChunkWithRetry({ callAi, chunkText: 'x', baseDelayMs: 1 });
        expect(result.ok).toBe(true);
        expect(result.retryCount).toBe(0);
        expect(callAi).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 then succeeds', async () => {
        const callAi = vi.fn()
            .mockResolvedValueOnce({ ok: false, error: '429 Too Many Requests' })
            .mockResolvedValueOnce({ ok: true, content: '{"findings":[]}' });
        const onRetry = vi.fn();
        const result = await callChunkWithRetry({
            callAi,
            chunkText: 'x',
            baseDelayMs: 1,
            maxRetries: 3,
            onRetry
        });
        expect(result.ok).toBe(true);
        expect(result.retryCount).toBe(1);
        expect(callAi).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('gives up after maxRetries and returns the last 429 result', async () => {
        const callAi = vi.fn(async () => ({ ok: false, error: '429 rate limited' }));
        const result = await callChunkWithRetry({
            callAi,
            chunkText: 'x',
            baseDelayMs: 1,
            maxRetries: 2
        });
        expect(result.ok).toBe(false);
        expect(result.retryCount).toBe(2);
        expect(callAi).toHaveBeenCalledTimes(3); // original + 2 retries
    });

    it('does not retry non-429 errors', async () => {
        const callAi = vi.fn(async () => ({ ok: false, error: '401 Unauthorized' }));
        const result = await callChunkWithRetry({ callAi, chunkText: 'x', baseDelayMs: 1 });
        expect(result.ok).toBe(false);
        expect(result.retryCount).toBe(0);
        expect(callAi).toHaveBeenCalledTimes(1);
    });

    it('aborts mid-backoff if the signal fires', async () => {
        const controller = new AbortController();
        const callAi = vi.fn(async () => ({ ok: false, error: '429 rate limited' }));
        const onRetry = vi.fn(() => controller.abort());
        const result = await callChunkWithRetry({
            callAi,
            chunkText: 'x',
            baseDelayMs: 100,
            maxRetries: 3,
            signal: controller.signal,
            onRetry
        });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('Scan cancelled');
    });
});

describe('findNextIssue', () => {
    const issues = [
        { start: 10,  end: 15,  severity: 'info'    }, // A
        { start: 40,  end: 50,  severity: 'error'   }, // B — most severe
        { start: 80,  end: 90,  severity: 'warning' }, // C
        { start: 120, end: 125, severity: 'error'   }  // D — error later in doc
    ];

    it('picks the most severe issue after the cursor', () => {
        // Cursor at 20: after = [B,C,D]. Most severe = B (error at 40).
        const next = findNextIssue(issues, 20);
        expect(next.start).toBe(40);
    });

    it('breaks severity ties by document position', () => {
        // Cursor at 60: after = [C,D]. C is warning, D is error → D wins.
        const next = findNextIssue(issues, 60);
        expect(next.start).toBe(120);
        // Cursor at 130: after = []. Wraps — most severe overall = B or D (both error).
        // D is already been passed, but wrap picks by rank then position, so B wins.
        const wrapped = findNextIssue(issues, 130);
        expect(wrapped.start).toBe(40);
    });

    it('returns null for empty issues list', () => {
        expect(findNextIssue([], 0)).toBe(null);
        expect(findNextIssue(null, 0)).toBe(null);
    });

    it('wraps to the most severe issue when past the last one', () => {
        const next = findNextIssue(issues, 999);
        // Wraps — B (error at 40) outranks D (error at 120) by position.
        expect(next.start).toBe(40);
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
        // Uses a non-retryable error (500) so the retry machinery does not
        // turn each chunk into a 21s backoff sequence — the intent here is
        // "terminal failures get counted", not "retry works".
        const text = 'one two three.\n\nfour five six.';
        const callAi = vi.fn(async () => ({ ok: false, error: '500 server error' }));
        const result = await scanDocument({ text, callAi, targetWords: 5 });
        expect(result.ok).toBe(true);
        expect(result.issues).toHaveLength(0);
        expect(result.failedChunks).toBe(2);
        expect(result.lastError).toBe('500 server error');
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

    it('returns totalRetries field (always present, even when zero)', async () => {
        const text = 'hi.';
        const callAi = async () => ({ ok: true, content: '{"findings":[]}' });
        const result = await scanDocument({ text, callAi });
        expect(result.totalRetries).toBe(0);
    });
});
