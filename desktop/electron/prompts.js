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

// The scan prompt asks the model to find issues the deterministic pattern
// linter cannot — things that need comprehension, not pattern matching.
// Asks for strict JSON so the renderer can parse findings reliably; the
// "text" field has to match EXACTLY so indexOf can locate it in the source.
const SYSTEM_SCAN =
    'You are a line editor for literary fiction. Scan the paragraph below for issues ' +
    'that deterministic pattern linters cannot catch: show-don\'t-tell violations, ' +
    'weak phrasing, generic or AI-sounding language, over-explanation, and emotional telling. ' +
    '\n\n' +
    'Return STRICT JSON with this exact shape:\n' +
    '{"findings": [{"text": "<exact substring from the paragraph>", ' +
    '"category": "show-vs-tell|weak-phrasing|generic|over-explanation|emotional-telling", ' +
    '"message": "<one-sentence explanation>"}]}\n\n' +
    'Rules:\n' +
    '- The "text" field MUST be an exact substring of the paragraph (same characters, same case).\n' +
    '- Include 0 to 5 findings per paragraph. If the prose is strong, return {"findings": []}.\n' +
    '- Do not flag stylistic choices that are working. Flag only clear weaknesses.\n' +
    '- Return ONLY the JSON object, no preamble, no markdown fences, no commentary.';

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

function buildScanMessages({ paragraph }) {
    return [
        { role: 'system', content: SYSTEM_SCAN },
        { role: 'user', content: paragraph }
    ];
}

module.exports = {
    buildExplainMessages,
    buildRewriteMessages,
    buildScanMessages,
    SYSTEM_EXPLAIN,
    SYSTEM_REWRITE,
    SYSTEM_SCAN
};
