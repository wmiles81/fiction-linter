/**
 * AI document scanner.
 *
 * Splits plain text into paragraphs, sends each to the AI via window.api.aiScan,
 * parses structured findings from the response, and translates paragraph-local
 * offsets to document-global offsets.
 *
 * Why scan paragraph-by-paragraph instead of the whole document?
 *   1. Progress is observable — users can cancel mid-scan.
 *   2. Each AI request stays small, avoiding context-limit failures on long
 *      manuscripts.
 *   3. Partial results can be rendered incrementally (every returned paragraph
 *      adds findings to the overlay immediately).
 *   4. A single bad response only corrupts one paragraph, not the whole run.
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
 * Translate paragraph-scoped AI findings to document-scoped issues matching
 * the pattern-finding shape expected by the lint overlay.
 *
 *   { start, end, message, severity, category, source: 'ai' }
 */
export function toDocumentIssues(paragraph, findings) {
    const issues = [];
    for (const f of findings) {
        const localIdx = paragraph.text.indexOf(f.text);
        if (localIdx < 0) continue; // AI hallucinated text not in the paragraph
        issues.push({
            start: paragraph.start + localIdx,
            end: paragraph.start + localIdx + f.text.length,
            message: f.message || `AI flagged: ${f.category}`,
            severity: 'info',
            category: f.category,
            source: 'ai'
        });
    }
    return issues;
}

/**
 * Run an AI scan over plain text.
 *
 * @param {object} opts
 * @param {string} opts.text - Plain text to scan (usually from getPlainText()).
 * @param {function} opts.callAi - Async fn that takes a paragraph string and
 *     returns { ok, content, error }. Injected so tests can stub it.
 * @param {AbortSignal} [opts.signal] - Abort signal; when aborted the scan
 *     stops at the next paragraph boundary.
 * @param {function} [opts.onProgress] - Called with { current, total, issues }
 *     after each paragraph completes. `issues` is the accumulated issue list.
 * @returns {Promise<{ ok: boolean, issues: array, error?: string }>}
 */
export async function scanDocument({ text, callAi, signal, onProgress }) {
    const paragraphs = splitParagraphs(text);
    const allIssues = [];
    if (paragraphs.length === 0) {
        return { ok: true, issues: [] };
    }
    for (let i = 0; i < paragraphs.length; i++) {
        if (signal?.aborted) {
            return { ok: false, error: 'Scan cancelled', issues: allIssues };
        }
        const para = paragraphs[i];
        const result = await callAi(para.text);
        if (signal?.aborted) {
            return { ok: false, error: 'Scan cancelled', issues: allIssues };
        }
        if (result?.ok && result.content) {
            const findings = parseScanResponse(result.content);
            const paragraphIssues = toDocumentIssues(para, findings);
            allIssues.push(...paragraphIssues);
        }
        // Progress is reported even for failed paragraphs so the UI keeps moving.
        onProgress?.({ current: i + 1, total: paragraphs.length, issues: allIssues });
    }
    return { ok: true, issues: allIssues };
}
