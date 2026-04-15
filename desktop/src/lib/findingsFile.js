/**
 * Build a deterministic findings snapshot for a document.
 *
 * The snapshot is written to `<path>.findings.json` when the user saves,
 * so it stays in lockstep with the persisted markdown — offsets in the
 * file always point at real positions in the document on disk. Two runs
 * over the same document with the same findings produce byte-identical
 * JSON (modulo the scannedAt timestamp, which is the only intentional
 * source of variation).
 *
 * Consumers can round-trip this file:
 *   - human reading: "word 3-5 of line 42" is easy to locate
 *   - tooling: char offsets + source + category drive automation
 *   - diffing: sorted findings + stable JSON serialization = useful git diffs
 */

const SCHEMA = 'fiction-linter-findings-v1';

/**
 * Tokenize a single line of text into words with char-offset bounds.
 * Word numbers are 1-indexed. Empty / whitespace-only lines return [].
 */
export function tokenizeWords(lineText) {
    if (!lineText) return [];
    const tokens = [];
    const re = /\S+/g;
    let match;
    while ((match = re.exec(lineText)) !== null) {
        tokens.push({
            text: match[0],
            start: match.index,           // 0-indexed inclusive
            end: match.index + match[0].length, // 0-indexed exclusive
            number: tokens.length + 1      // 1-indexed
        });
    }
    return tokens;
}

/**
 * For a 0-indexed char offset within `lineText`, return the 1-indexed
 * word number that contains it (or the nearest following word if the
 * offset is in leading whitespace). Lines with no words return 1.
 */
export function wordNumberAt(lineText, charOffset) {
    const tokens = tokenizeWords(lineText);
    if (tokens.length === 0) return 1;
    for (const t of tokens) {
        if (charOffset >= t.start && charOffset < t.end) return t.number;
        if (charOffset < t.start) return t.number; // leading whitespace before this word
    }
    // Past the last word — anchor to the last word rather than inventing one.
    return tokens[tokens.length - 1].number;
}

/**
 * Compute { wordStart, wordEnd } for a finding, given the line text it
 * falls on and its 1-indexed column + length (or end column).
 *
 * `startCol` is 1-indexed (the same convention indexToLineCol produces).
 * `length` is the char count of the flagged text; if omitted, `endCol`
 * is used directly. Both bounds clamp to at least 1 so the output is
 * always a valid word number.
 */
export function computeWordBounds(lineText, startCol, length) {
    const tokens = tokenizeWords(lineText);
    if (tokens.length === 0) return { wordStart: 1, wordEnd: 1 };
    const startChar = Math.max(0, (startCol || 1) - 1);
    // endChar is the LAST included char's 0-indexed position. For a
    // 0-length span (defensive: shouldn't happen but don't divide by zero)
    // we point at startChar itself.
    const spanLen = Math.max(0, length || 0);
    const endChar = spanLen > 0 ? startChar + spanLen - 1 : startChar;
    return {
        wordStart: wordNumberAt(lineText, startChar),
        wordEnd: wordNumberAt(lineText, endChar)
    };
}

/**
 * Build the full findings payload to write to disk.
 *
 * @param {object} opts
 * @param {string} opts.path - Absolute path of the source document.
 * @param {string} opts.name - File name (for the document record).
 * @param {string} opts.plainText - Plain-text version of the document
 *     (same representation the linter used — NOT the markdown source).
 *     Used to extract per-line text so word bounds can be computed.
 * @param {Array} opts.findings - In-memory findings (pattern + AI) with
 *     shape { start, end, text, message, severity, category, source,
 *              line, column? }.
 * @param {string} [opts.scannedAt] - ISO timestamp; defaults to now.
 *     Injectable for reproducibility in tests.
 */
export function buildFindingsPayload({ path, name, plainText, findings, scannedAt }) {
    const lines = (plainText || '').split('\n');
    // Convert each finding to the serialized shape.
    const serialized = (findings || []).map(f => serializeFinding(f, lines, plainText));
    // Deterministic ordering — line, then column, then source. Without
    // this the JSON output would vary between runs depending on whether
    // pattern or AI findings happened to land first in the array.
    serialized.sort(compareForOrder);
    return {
        $schema: SCHEMA,
        document: {
            path,
            name,
            byteLength: (plainText || '').length
        },
        scannedAt: scannedAt || new Date().toISOString(),
        counts: computeCounts(serialized),
        findings: serialized
    };
}

function serializeFinding(f, lines, plainText) {
    // Derive line/column if the finding doesn't already carry them.
    // Pattern findings get them from the App.jsx lint effect. AI findings
    // now get them from toDocumentIssues — but older findings might not.
    const line = f.line || lineOfOffset(plainText, f.start);
    const column = f.column || columnOfOffset(plainText, f.start);
    const lineText = lines[line - 1] || '';
    const length = (f.end || f.start) - f.start;
    const { wordStart, wordEnd } = computeWordBounds(lineText, column, length);
    // Prefer the stored `text` field (AI findings carry the exact flagged
    // substring). Pattern findings don't carry it, so slice the plain
    // text at the known offsets.
    const text = f.text || (plainText ? plainText.slice(f.start, f.end) : '');
    return {
        source: f.source || 'pattern',
        category: f.category || 'unknown',
        severity: f.severity || 'info',
        message: f.message || '',
        line,
        column,
        wordStart,
        wordEnd,
        text,
        offset: { start: f.start, end: f.end }
    };
}

function compareForOrder(a, b) {
    if (a.line !== b.line) return a.line - b.line;
    if (a.column !== b.column) return a.column - b.column;
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    return 0;
}

function computeCounts(findings) {
    const bySource = {};
    const byCategory = {};
    const bySeverity = {};
    for (const f of findings) {
        bySource[f.source] = (bySource[f.source] || 0) + 1;
        byCategory[f.category] = (byCategory[f.category] || 0) + 1;
        bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    }
    return {
        total: findings.length,
        bySource,
        byCategory,
        bySeverity
    };
}

// Fallbacks for findings that lack line/column. Mirror the same math
// indexToLineCol in App.jsx uses — 1-indexed.
function lineOfOffset(text, offset) {
    if (!text || offset <= 0) return 1;
    const slice = text.slice(0, offset);
    return slice.split('\n').length;
}

function columnOfOffset(text, offset) {
    if (!text || offset <= 0) return 1;
    const slice = text.slice(0, offset);
    const lines = slice.split('\n');
    return lines[lines.length - 1].length + 1;
}

/**
 * Sibling path for the findings file: `/foo/chapter1.md` →
 * `/foo/chapter1.md.findings.json`. Same double-suffix convention as
 * annotation files — `.findings` names the purpose, `.json` keeps it
 * tool-friendly.
 */
export function findingsPathFor(sourcePath) {
    if (!sourcePath) return null;
    return `${sourcePath}.findings.json`;
}
