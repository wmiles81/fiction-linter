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
 *
 * Defensive against offset/coordinate-system mismatches: clamps both the
 * global offsets (to the map's overall text range) AND the local offsets
 * (to each entry's node length) so a Range is always valid even if the
 * caller is using a different coordinate system than the map was built
 * from. Without the local clamp, an offset that fell into a synthetic
 * separator region (between text-node entries) would land on the wrong
 * entry and produce a negative local offset, which the DOM Range API
 * silently coerces to a huge unsigned int and then rejects.
 */
export function rangeFromOffsets(map, start, end) {
    if (map.length === 0) return null;

    // Global clamp: keep offsets inside the map's overall text range.
    const lastEnd = map[map.length - 1].endInText;
    start = Math.max(0, Math.min(start, lastEnd));
    end = Math.max(start, Math.min(end, lastEnd));

    const startEntry = findNearestEntry(map, start);
    const endEntry = findNearestEntry(map, end);
    if (!startEntry || !endEntry) return null;

    // Local clamp: pin the offset within each entry's text node length.
    // node.textContent.length is the canonical "valid offset upper bound"
    // for a Text node. Negative values get clamped to 0; values past the
    // end get clamped to the node length.
    const startNodeLen = startEntry.node.textContent?.length ?? 0;
    const endNodeLen = endEntry.node.textContent?.length ?? 0;
    const startLocal = Math.max(0, Math.min(start - startEntry.startInText, startNodeLen));
    const endLocal = Math.max(0, Math.min(end - endEntry.startInText, endNodeLen));

    try {
        const range = document.createRange();
        range.setStart(startEntry.node, startLocal);
        range.setEnd(endEntry.node, endLocal);
        return range;
    } catch {
        // If the Range API still rejects (e.g., end before start across nodes),
        // return null rather than crashing the whole highlight pass.
        return null;
    }
}

/**
 * Find the entry whose text-node range contains the given offset, falling
 * back to the entry whose range is nearest the offset (by absolute distance).
 *
 * The fallback matters when the offset lands in a "synthetic" text region
 * — the `\n\n` separators inserted between block elements, or the `---`
 * synthesized for an HR — because those regions don't have backing text
 * nodes. Returning the nearest text node (and letting rangeFromOffsets
 * locally clamp the offset) gives a valid Range at the right approximate
 * position rather than throwing.
 */
function findNearestEntry(map, offset) {
    let containing = null;
    let nearest = null;
    let nearestDist = Infinity;

    for (const entry of map) {
        if (entry.isSynthetic) continue;
        if (offset >= entry.startInText && offset <= entry.endInText) {
            containing = entry;
            break;
        }
        const dist = offset < entry.startInText
            ? entry.startInText - offset
            : offset - entry.endInText;
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = entry;
        }
    }

    return containing || nearest;
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
