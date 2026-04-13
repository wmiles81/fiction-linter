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
    onToggleAiScan
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
                <button
                    type="button"
                    className={`status-bar-toggle ${lintEnabled ? 'on' : 'off'}`}
                    onClick={onToggleLint}
                    title={lintEnabled ? 'Click to disable linting' : 'Click to enable linting'}
                    aria-label={lintEnabled ? 'Lint on' : 'Lint off'}
                >
                    {lintEnabled ? 'Lint on' : 'Lint off'}
                </button>

                <button
                    type="button"
                    className={`status-bar-toggle ${showFindings ? 'on' : 'off'}`}
                    onClick={onToggleFindings}
                    disabled={!lintEnabled}
                    title={showFindings ? 'Hide finding text' : 'Show finding text'}
                    aria-label={`Findings ${showFindings ? 'visible' : 'hidden'}`}
                >
                    {showFindings ? 'Findings' : 'Silent'}
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
                <span className="status-bar-metric">{issueCount} findings</span>
            </div>
        </footer>
    );
}

export default StatusBar;
