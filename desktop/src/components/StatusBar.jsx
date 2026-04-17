import { useMemo } from 'react';

function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
}

// Status bar is now purely informational: status text, dirty indicator,
// and document statistics (word/char counts, selection metrics, cursor
// position, findings total). All action buttons live in the top bar so
// the footer stays quiet and easy to read.
function StatusBar({
    status,
    content,
    cursorLine,
    cursorColumn,
    selection,
    dirty,
    issueCount
}) {
    const wordCount = useMemo(() => countWords(content), [content]);
    const charCount = content?.length ?? 0;

    // Treat a selection with zero characters as "no real selection" — this
    // happens briefly during some selection transitions and we do not want
    // to flash "0 words selected" in the UI.
    const hasSelection = !!selection && selection.chars > 0;

    return (
        <footer className="status-bar">
            <div className="status-bar-left">
                <span className="status-bar-text">{status}</span>
                {dirty ? (
                    <span className="status-bar-dirty" title="Unsaved changes">
                        {'\u25CF'}
                    </span>
                ) : null}
            </div>

            <div className="status-bar-right">
                <span className="status-bar-metric" data-help-id="status-word-char-counts">{wordCount} words</span>
                <span className="status-bar-metric" data-help-id="status-word-char-counts">{charCount} chars</span>
                {hasSelection ? (
                    <span className="status-bar-metric status-bar-selection">
                        {selection.words} words selected {'\u00B7'} {selection.chars} chars selected
                    </span>
                ) : null}
                {cursorLine && cursorColumn ? (
                    <span className="status-bar-metric" data-help-id="status-cursor-position">Ln {cursorLine}:{cursorColumn}</span>
                ) : null}
                <span className="status-bar-metric" data-help-id="status-findings-count">{issueCount} findings</span>
            </div>
        </footer>
    );
}

export default StatusBar;
