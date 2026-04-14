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
    'You are a line editor for literary fiction. A specific phrase has been flagged for a ' +
    'stylistic issue. Return exactly THREE alternative phrases that could be dropped in ' +
    'place of the flagged phrase itself.\n\n' +
    'Rules:\n' +
    '- Each alternative replaces ONLY the flagged phrase, not the surrounding sentence.\n' +
    '- Preserve the original syntactic role so the replacement reads naturally inline.\n' +
    '- Preserve the author\'s meaning and voice.\n' +
    '- Format: three lines prefixed "1.", "2.", "3." — just the replacement phrase per line.\n' +
    '- Do not repeat the surrounding context. Do not add commentary, preamble, or explanations.\n' +
    '- Do not wrap lines in quotes or markdown fences.';

// The scan prompt asks the model to find issues the deterministic pattern
// linter cannot — things that need comprehension, not pattern matching.
// Asks for strict JSON so the renderer can parse findings reliably; the
// "text" field has to match EXACTLY so indexOf can locate it in the source.
const SYSTEM_SCAN =
    'You are a line editor for literary fiction. Scan the text below (which may contain ' +
    'one or more paragraphs) for issues that deterministic pattern linters cannot catch: ' +
    'show-don\'t-tell violations, weak phrasing, generic or AI-sounding language, ' +
    'over-explanation, and emotional telling.\n\n' +
    'Return STRICT JSON with this exact shape:\n' +
    '{"findings": [{"text": "<exact substring from the text>", ' +
    '"category": "show-vs-tell|weak-phrasing|generic|over-explanation|emotional-telling", ' +
    '"message": "<one-sentence explanation>"}]}\n\n' +
    'Rules:\n' +
    '- The "text" field MUST be an exact substring of the text (same characters, same case).\n' +
    '- Keep "text" short — a phrase or short clause, not a whole paragraph.\n' +
    '- Include 0 to 15 findings per request. If the prose is strong, return {"findings": []}.\n' +
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

function buildRewriteMessages({ finding, snippet, flagged }) {
    // `flagged` is the exact substring the linter flagged — the phrase
    // the user wants replaced. `snippet` is the wider context (roughly a
    // sentence or two) the model can consult but must NOT rewrite.
    const lines = [];
    if (flagged) {
        lines.push(`Flagged phrase: "${flagged}"`);
    }
    lines.push(`Issue: ${finding.message}`);
    lines.push('');
    lines.push('Context (do NOT rewrite this — only the flagged phrase):');
    lines.push(snippet);
    return [
        { role: 'system', content: SYSTEM_REWRITE },
        { role: 'user', content: lines.join('\n') }
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
