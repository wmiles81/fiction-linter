import React, { useState } from 'react';

const severityLabels = {
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
};

function IssueList({ issues, onJump, getSnippet }) {
    const [responses, setResponses] = useState({});

    const callAi = async (issue, kind) => {
        const key = `${issue.start}-${issue.end}-${kind}`;
        setResponses(prev => ({ ...prev, [key]: { loading: true } }));

        try {
            const snippet = getSnippet?.(issue) ?? issue.message;
            const result = await window.api.aiComplete({ kind, finding: issue, snippet });
            setResponses(prev => ({
                ...prev,
                [key]: result.ok
                    ? { content: result.content }
                    : { error: result.error || 'Request failed.' }
            }));
        } catch (err) {
            setResponses(prev => ({
                ...prev,
                [key]: { error: err.message }
            }));
        }
    };

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
                {issues.map((issue, index) => {
                    const explainKey = `${issue.start}-${issue.end}-explain`;
                    const rewriteKey = `${issue.start}-${issue.end}-rewrite`;
                    const explain = responses[explainKey];
                    const rewrite = responses[rewriteKey];

                    return (
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
                                <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => callAi(issue, 'explain')}
                                    disabled={explain?.loading}
                                >
                                    {explain?.loading ? 'Thinking…' : 'Explain'}
                                </button>
                                <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => callAi(issue, 'rewrite')}
                                    disabled={rewrite?.loading}
                                >
                                    {rewrite?.loading ? 'Thinking…' : 'Suggest rewrite'}
                                </button>
                            </div>
                            {explain && !explain.loading ? (
                                <div className="issue-ai-response">
                                    <div className="ai-label">Explanation</div>
                                    <div className="ai-body">{explain.content || explain.error}</div>
                                </div>
                            ) : null}
                            {rewrite && !rewrite.loading ? (
                                <div className="issue-ai-response">
                                    <div className="ai-label">Suggested rewrites</div>
                                    <pre className="ai-body">{rewrite.content || rewrite.error}</pre>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default IssueList;
