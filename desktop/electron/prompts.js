/**
 * Prompt templates for the Fiction Linter AI actions.
 *
 * These templates are intentionally short and opinionated. They assume the
 * receiving model is an OpenAI-compatible chat completions endpoint.
 */

const SYSTEM_EXPLAIN =
    'You are a line editor for literary fiction. A linting tool has flagged a phrase. ' +
    'Explain in 2-3 sentences why the flagged phrase weakens the prose. Be specific and concrete. ' +
    'Do not suggest rewrites. Do not moralize. Do not pad the response with preamble.';

const SYSTEM_REWRITE =
    'You are a line editor for literary fiction. A linting tool has flagged a phrase in a sentence. ' +
    'Return exactly three alternative rewrites of the sentence, each on its own line, ' +
    'prefixed with "1.", "2.", "3.". Preserve the author\'s meaning and voice. ' +
    'Do not add commentary, preamble, or explanations.';

function buildExplainMessages({ finding, snippet }) {
    return [
        { role: 'system', content: SYSTEM_EXPLAIN },
        {
            role: 'user',
            content: [
                `Flagged: ${finding.message}`,
                `Severity: ${finding.severity || 'info'}`,
                '',
                'Surrounding sentence:',
                snippet
            ].join('\n')
        }
    ];
}

function buildRewriteMessages({ finding, snippet }) {
    return [
        { role: 'system', content: SYSTEM_REWRITE },
        {
            role: 'user',
            content: [
                `Flagged: ${finding.message}`,
                '',
                'Original sentence:',
                snippet
            ].join('\n')
        }
    ];
}

module.exports = {
    buildExplainMessages,
    buildRewriteMessages,
    SYSTEM_EXPLAIN,
    SYSTEM_REWRITE
};
