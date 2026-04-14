import React, { useMemo } from 'react';

function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function StatusBar({
    status,
    content,
    cursorLine,
    cursorColumn,
    selection,
    dirty,
    issueCount,
    lintEnabled,
    showFindings,
    onToggleLint,
    onToggleFindings,
    scanProgress,
    onToggleAiScan,
    onJumpNextFinding
}) {
    const wordCount = useMemo(() => countWords(content), [content]);
    const charCount = content?.length ?? 0;

    // Treat a selection with zero characters as "no real selection" — this
    // happens briefly during some selection transitions and we do not want
    // to flash "0 words selected" in the UI.
    const hasSelection = !!selection && selection.chars > 0;

    // AI scan button state. scanProgress is either null (idle) or
    // { current, total } while a scan is running. Label reflects both.
    const scanning = !!scanProgress;
    const scanPercent = scanning && scanProgress.total > 0
        ? Math.round((scanProgress.current / scanProgress.total) * 100)
        : 0;
    const scanLabel = scanning
        ? `AI Scan: ${scanPercent}%`
        : 'AI Scan';
    const scanTitle = scanning
        ? `Scanning paragraph ${scanProgress.current} of ${scanProgress.total} — click to cancel`
        : 'Run AI scan on the current document';

    return (
        <footer className="status-bar">
            <div className="status-bar-left">
                {onToggleAiScan ? (
                    <button
                        type="button"
                        className={`status-bar-scan ${scanning ? 'running' : ''}`}
                        onClick={onToggleAiScan}
                        title={scanTitle}
                        aria-label={scanLabel}
                    >
                        <span className="status-bar-scan-icon" aria-hidden="true">
                            {scanning ? '\u21bb' : '\u2728'}
                        </span>
                        <span>{scanLabel}</span>
                    </button>
                ) : null}
                <span className="status-bar-text">{status}</span>
                {dirty ? (
                    <span className="status-bar-dirty" title="Unsaved changes">
                        {'\u25CF'}
                    </span>
                ) : null}
            </div>

            <div className="status-bar-right">
                {/*
                 * Toggle buttons show the FUTURE state — what happens when
                 * you click — not the current state. This matches the
                 * "button labels are verbs, not nouns" UX convention and
                 * makes it obvious that clicking changes things rather
                 * than reaffirms them.
                 */}
                <button
                    type="button"
                    className={`status-bar-toggle ${lintEnabled ? 'on' : 'off'}`}
                    onClick={onToggleLint}
                    title={lintEnabled ? 'Disable linting' : 'Enable linting'}
                    aria-label={lintEnabled ? 'Click to turn lint off' : 'Click to turn lint on'}
                >
                    {lintEnabled ? 'Lint off' : 'Lint on'}
                </button>

                <button
                    type="button"
                    className={`status-bar-toggle ${showFindings ? 'on' : 'off'}`}
                    onClick={onToggleFindings}
                    disabled={!lintEnabled}
                    title={showFindings ? 'Hide findings' : 'Show findings'}
                    aria-label={`Click to ${showFindings ? 'hide' : 'show'} findings`}
                >
                    {showFindings ? 'Hide findings' : 'Show findings'}
                </button>

                <span className="status-bar-metric">{wordCount} words</span>
                <span className="status-bar-metric">{charCount} chars</span>
                {hasSelection ? (
                    <span className="status-bar-metric status-bar-selection">
                        {selection.words} words selected {'\u00B7'} {selection.chars} chars selected
                    </span>
                ) : null}
                {cursorLine && cursorColumn ? (
                    <span className="status-bar-metric">Ln {cursorLine}:{cursorColumn}</span>
                ) : null}
                <button
                    type="button"
                    className="status-bar-toggle"
                    onClick={onJumpNextFinding}
                    disabled={!issueCount}
                    title="Jump to the next finding (by severity, then position)"
                    aria-label="Next finding"
                >
                    Next {'\u203A'}
                </button>
                <span className="status-bar-metric">{issueCount} findings</span>
            </div>
        </footer>
    );
}

export default StatusBar;
