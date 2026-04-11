import React from 'react';

const severityLabels = {
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
};

function IssueList({ issues, onJump }) {
    if (!issues.length) {
        return (
            <section className="issues-panel empty">
                <h3>Lint Report</h3>
                <p>No lint findings yet. Load a file to see feedback.</p>
            </section>
        );
    }

    return (
        <section className="issues-panel">
            <h3>Lint Report</h3>
            <div className="issues-list">
                {issues.map((issue, index) => (
                    <div className={`issue-card ${issue.severity}`} key={`${issue.start}-${index}`}>
                        <div className="issue-meta">
                            <span className="issue-severity">{severityLabels[issue.severity] || 'Info'}</span>
                            <span className="issue-location">Line {issue.line}, Col {issue.column}</span>
                        </div>
                        <div className="issue-message">{issue.message}</div>
                        <div className="issue-actions">
                            <button
                                type="button"
                                className="ghost-button"
                                onClick={() => onJump?.(issue)}
                                aria-label={`Jump to line ${issue.line}, column ${issue.column}`}
                            >
                                Jump to {issue.line}:{issue.column}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default IssueList;
