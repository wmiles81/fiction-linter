/**
 * AI document scanner.
 *
 * Splits plain text into paragraphs, groups them into ~2K-word chunks
 * (paragraph-aligned), sends each chunk to the AI via window.api.aiScan,
 * parses structured findings from the response, and translates chunk-local
 * offsets to document-global offsets.
 *
 * Why chunk by word count instead of one-paragraph-at-a-time?
 *   1. Free OpenRouter endpoints rate-limit aggressively (~10–20 RPM). A
 *      50-paragraph chapter at 1 request per paragraph trips the limit;
 *      grouping into 2K-word chunks cuts request count by ~10x.
 *   2. Modern context windows (128K+) easily hold 2K-word chunks.
 *   3. The model sees more surrounding flow per call, which helps it judge
 *      what's actually weak vs. just unusual.
 *   4. Cancellation is still granular — checked between chunks.
 */

/**
 * Split plain text into paragraphs with their start/end offsets.
 * Paragraphs are runs of non-empty lines separated by blank lines.
 * Returns [{ text, start, end }] where start and end are positions in `text`.
 */
export function splitParagraphs(text) {
    if (!text) return [];
    const paragraphs = [];
    const lines = text.split('\n');
    let cursor = 0;
    let currentStart = null;
    let currentLines = [];

    const flush = (endOffset) => {
        if (currentStart === null) return;
        const paraText = currentLines.join('\n');
        if (paraText.trim().length > 0) {
            paragraphs.push({
                text: paraText,
                start: currentStart,
                end: currentStart + paraText.length
            });
        }
        currentStart = null;
        currentLines = [];
    };

    for (const line of lines) {
        if (line.trim() === '') {
            flush(cursor);
            cursor += line.length + 1; // +1 for the \n
            continue;
        }
        if (currentStart === null) {
            currentStart = cursor;
        }
        currentLines.push(line);
        cursor += line.length + 1;
    }
    flush(cursor);
    return paragraphs;
}

/**
 * Parse a raw AI response into a findings array. Strips common formatting
 * mistakes (markdown fences, preamble) and degrades gracefully — a malformed
 * response returns [] rather than throwing.
 */
export function parseScanResponse(raw) {
    if (!raw || typeof raw !== 'string') return [];
    // Strip ```json fences and leading/trailing whitespace.
    const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
    // Some models emit preamble text before the JSON. Try to locate the first
    // `{` and parse from there.
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace < 0) return [];
    const jsonSlice = cleaned.slice(firstBrace);
    let parsed;
    try {
        parsed = JSON.parse(jsonSlice);
    } catch {
        return [];
    }
    if (!parsed || !Array.isArray(parsed.findings)) return [];
    // Normalize each finding; drop entries missing required fields.
    return parsed.findings
        .map(f => ({
            text: typeof f?.text === 'string' ? f.text : null,
            category: typeof f?.category === 'string' ? f.category : 'ai',
            message: typeof f?.message === 'string' ? f.message : ''
        }))
        .filter(f => f.text && f.text.length > 0);
}

/**
 * Translate chunk-scoped AI findings to document-scoped issues matching
 * the pattern-finding shape expected by the lint overlay.
 *
 *   { start, end, message, severity, category, source: 'ai' }
 *
 * `chunk` shape: { text, start, end } — same as a paragraph, but covering
 * possibly multiple paragraphs joined by their original separators.
 */
export function toDocumentIssues(chunk, findings) {
    const issues = [];
    for (const f of findings) {
        const localIdx = chunk.text.indexOf(f.text);
        if (localIdx < 0) continue; // AI hallucinated text not in the chunk
        issues.push({
            start: chunk.start + localIdx,
            end: chunk.start + localIdx + f.text.length,
            message: f.message || `AI flagged: ${f.category}`,
            severity: 'info',
            category: f.category,
            source: 'ai'
        });
    }
    return issues;
}

/**
 * Approximate word count — splits on whitespace runs. Cheap; only used
 * to decide chunk boundaries, so exactness doesn't matter.
 */
function wordCount(text) {
    if (!text) return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
}

/**
 * Group paragraphs into chunks of roughly `targetWords` words each, never
 * splitting a paragraph. Chunks include the original document text from
 * the first paragraph's start to the last paragraph's end (preserving
 * inter-paragraph whitespace), so AI findings can use indexOf against the
 * exact substring that the AI saw.
 *
 * @param {Array<{text,start,end}>} paragraphs - From splitParagraphs().
 * @param {string} sourceText - The original document plain text. Needed to
 *     reconstruct chunks with their inter-paragraph whitespace intact.
 * @param {number} targetWords - Soft target per chunk (default 2000). A
 *     chunk may exceed this by one paragraph since we never split mid-para.
 * @returns {Array<{text, start, end, paragraphCount}>}
 */
export function chunkParagraphs(paragraphs, sourceText, targetWords = 2000) {
    if (!paragraphs || paragraphs.length === 0) return [];
    const chunks = [];
    let groupStart = paragraphs[0].start;
    let groupEnd = paragraphs[0].end;
    let groupWords = wordCount(paragraphs[0].text);
    let groupCount = 1;

    const flush = () => {
        chunks.push({
            text: sourceText.slice(groupStart, groupEnd),
            start: groupStart,
            end: groupEnd,
            paragraphCount: groupCount
        });
    };

    for (let i = 1; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        const paraWords = wordCount(para.text);
        // Start a new chunk if adding this paragraph would push us over the
        // target. Keep at least one paragraph per chunk even if it alone
        // exceeds the target — splitting mid-paragraph is worse than going over.
        if (groupWords + paraWords > targetWords && groupCount > 0) {
            flush();
            groupStart = para.start;
            groupEnd = para.end;
            groupWords = paraWords;
            groupCount = 1;
        } else {
            groupEnd = para.end;
            groupWords += paraWords;
            groupCount += 1;
        }
    }
    flush();
    return chunks;
}

/**
 * Run an AI scan over plain text.
 *
 * @param {object} opts
 * @param {string} opts.text - Plain text to scan (usually from getPlainText()).
 * @param {function} opts.callAi - Async fn that takes a chunk string and
 *     returns { ok, content, error }. Injected so tests can stub it.
 * @param {AbortSignal} [opts.signal] - Abort signal; checked between chunks.
 * @param {function} [opts.onProgress] - Called with { current, total, issues }
 *     after each chunk. `issues` is the accumulated issue list.
 * @param {number} [opts.targetWords] - Soft chunk size in words. Default 2000.
 * @returns {Promise<{ ok, issues, failedChunks, lastError, error? }>}
 *     `failedChunks` is the count of chunks where the AI call failed OR the
 *     response failed to parse. `lastError` is the most recent error string,
 *     useful for surfacing diagnostic info when the scan completed but
 *     produced no findings.
 */
export async function scanDocument({ text, callAi, signal, onProgress, targetWords = 2000 }) {
    const paragraphs = splitParagraphs(text);
    const chunks = chunkParagraphs(paragraphs, text, targetWords);
    const allIssues = [];
    let failedChunks = 0;
    let lastError = null;
    let lastSampleResponse = null; // first content body, for debugging

    if (chunks.length === 0) {
        return {
            ok: true,
            issues: [],
            failedChunks: 0,
            lastError: null,
            chunkCount: 0,
            lastSampleResponse: null
        };
    }

    for (let i = 0; i < chunks.length; i++) {
        if (signal?.aborted) {
            return { ok: false, error: 'Scan cancelled', issues: allIssues, failedChunks, lastError };
        }
        const chunk = chunks[i];
        const result = await callAi(chunk.text);
        if (signal?.aborted) {
            return { ok: false, error: 'Scan cancelled', issues: allIssues, failedChunks, lastError };
        }
        if (!result?.ok) {
            // Network/auth/rate-limit failure. Track it but keep going so a
            // mid-document 429 doesn't kill the whole scan.
            failedChunks += 1;
            lastError = result?.error || 'unknown error';
        } else if (!result.content) {
            failedChunks += 1;
            lastError = 'empty response';
        } else {
            // Save the first content body so the UI can show a sample when
            // the scan returns 0 findings — helps tell "model behaving" from
            // "model misbehaving" without opening DevTools.
            if (lastSampleResponse === null) {
                lastSampleResponse = result.content.slice(0, 200);
            }
            const findings = parseScanResponse(result.content);
            if (findings.length === 0 && result.content.trim().length > 0 && !result.content.includes('"findings"')) {
                // The model returned text but no parseable findings array —
                // count it as a failure so the user knows the model misbehaved.
                failedChunks += 1;
                lastError = 'response was not valid findings JSON';
            }
            const chunkIssues = toDocumentIssues(chunk, findings);
            allIssues.push(...chunkIssues);
        }
        onProgress?.({ current: i + 1, total: chunks.length, issues: allIssues });
    }
    return {
        ok: true,
        issues: allIssues,
        failedChunks,
        lastError,
        chunkCount: chunks.length,
        lastSampleResponse
    };
}
