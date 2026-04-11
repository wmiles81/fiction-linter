/**
 * Lint overlay: maps linter character offsets (into the plain-text
 * representation of the DOM) to DOM Range objects, then applies
 * highlights via the CSS Custom Highlight API.
 *
 * The Custom Highlight API is supported in Chromium 105+ (Electron 25+),
 * so Electron 31 has it. It lets us highlight ranges without mutating
 * the DOM — critical for contenteditable where span injection would
 * corrupt selection and undo.
 */

const BLOCK_TAGS = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE'
]);

/**
 * Walks the DOM tree and returns:
 * - text: the plain-text representation (what the linter sees)
 * - map: an array of { node, startInText, endInText } entries for each
 *        text node encountered (element-level entries are omitted — only
 *        real Text nodes are mappable to DOM Range anchors).
 */
export function buildOffsetMap(root) {
    let text = '';
    const map = [];

    function ensureBlockSeparator() {
        if (text.length === 0) return;
        if (text.endsWith('\n\n')) return;
        text += '\n\n';
    }

    function visit(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const start = text.length;
            text += node.textContent;
            map.push({
                node,
                startInText: start,
                endInText: text.length,
                isSynthetic: false
            });
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const el = node;
        const tag = el.tagName;

        // HR → synthesized "\n\n---\n\n"
        if (tag === 'HR') {
            ensureBlockSeparator();
            text += '---';
            text += '\n\n';
            return;
        }

        const isBlock = BLOCK_TAGS.has(tag);

        // Block start: insert separator if previous content exists and
        // does not already end with a block separator.
        if (isBlock) {
            ensureBlockSeparator();
        }

        // Visit children
        for (const child of el.childNodes) {
            visit(child);
        }
    }

    for (const child of root.childNodes) {
        visit(child);
    }

    // Trim a trailing "\n\n" that an HR at the end leaves behind (only if
    // nothing followed). This matches the expectation that "A\n\n---\n\nB"
    // has no trailing separator.
    // We intentionally do NOT trim mid-stream separators.

    return { text, map };
}

/**
 * Build a DOM Range from a pair of plain-text offsets using the map.
 * Returns null if the map is empty or no textual content exists.
 */
export function rangeFromOffsets(map, start, end) {
    if (map.length === 0) return null;

    // Clamp
    const lastEnd = map[map.length - 1].endInText;
    start = Math.max(0, Math.min(start, lastEnd));
    end = Math.max(start, Math.min(end, lastEnd));

    const startEntry = findEntryContaining(map, start);
    const endEntry = findEntryContaining(map, end);
    if (!startEntry || !endEntry) return null;

    const range = document.createRange();
    range.setStart(startEntry.node, start - startEntry.startInText);
    range.setEnd(endEntry.node, end - endEntry.startInText);
    return range;
}

function findEntryContaining(map, offset) {
    for (const entry of map) {
        if (entry.isSynthetic) continue;
        if (offset >= entry.startInText && offset <= entry.endInText) {
            return entry;
        }
    }
    // If we fell off the end, return the last non-synthetic entry
    for (let i = map.length - 1; i >= 0; i--) {
        if (!map[i].isSynthetic) return map[i];
    }
    return null;
}

/**
 * Apply lint findings as CSS Custom Highlights.
 *
 * The Highlight API creates three registered highlights (error/warning/info)
 * that CSS styles via ::highlight(lint-error) etc. No DOM mutation.
 *
 * Returns a cleanup function that clears the highlights.
 */
export function applyLintHighlights(root, findings, showText) {
    if (typeof CSS === 'undefined' || !CSS.highlights) {
        // Fallback: do nothing. Older browsers without Highlight API.
        return () => {};
    }

    const { map } = buildOffsetMap(root);
    const byType = { error: [], warning: [], info: [] };

    for (const finding of findings || []) {
        const range = rangeFromOffsets(map, finding.start, finding.end);
        if (!range) continue;
        const severity = finding.severity || 'info';
        if (byType[severity]) byType[severity].push(range);
    }

    // Clear old highlights
    CSS.highlights.delete('lint-error');
    CSS.highlights.delete('lint-warning');
    CSS.highlights.delete('lint-info');

    if (!showText || (findings || []).length === 0) {
        return () => {};
    }

    // Register new highlights
    if (byType.error.length) CSS.highlights.set('lint-error', new Highlight(...byType.error));
    if (byType.warning.length) CSS.highlights.set('lint-warning', new Highlight(...byType.warning));
    if (byType.info.length) CSS.highlights.set('lint-info', new Highlight(...byType.info));

    return () => {
        CSS.highlights.delete('lint-error');
        CSS.highlights.delete('lint-warning');
        CSS.highlights.delete('lint-info');
    };
}
