/**
 * Per-provider model catalog fetchers.
 *
 * Returns a normalized model list regardless of provider API shape:
 *   [{ id, name, pricing: { input, output }, supportedParameters,
 *      isThinking, contextLength, created }]
 *
 * - pricing: USD per 1M tokens
 * - contextLength: number of tokens, or null if unknown
 * - created: unix timestamp (seconds) of when the model was published, or null
 */

async function fetchModels({ provider, baseUrl, apiKey }) {
    if (!apiKey) {
        return { ok: false, error: 'API key required.' };
    }
    switch (provider) {
        case 'openrouter':
            return fetchOpenRouterModels({ baseUrl: baseUrl || 'https://openrouter.ai/api/v1', apiKey });
        case 'openai':
            return fetchOpenAIModels({ baseUrl: baseUrl || 'https://api.openai.com/v1', apiKey });
        case 'anthropic':
            return fetchAnthropicModels({ baseUrl: baseUrl || 'https://api.anthropic.com/v1', apiKey });
        case 'ollama':
            return fetchOllamaModels({ baseUrl: baseUrl || 'http://localhost:11434' });
        default:
            return { ok: false, error: `Unknown provider: ${provider}` };
    }
}

async function fetchOpenRouterModels({ baseUrl, apiKey }) {
    try {
        const response = await fetch(`${trim(baseUrl)}/models`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) {
            return { ok: false, error: `${response.status} ${response.statusText}` };
        }
        const payload = await response.json();
        const models = (payload.data || []).map(m => ({
            id: m.id,
            name: m.name || m.id,
            pricing: {
                // OpenRouter pricing is per-token as a string; convert to per-1M.
                input: Number(m.pricing?.prompt ?? 0) * 1_000_000,
                output: Number(m.pricing?.completion ?? 0) * 1_000_000
            },
            supportedParameters: new Set(m.supported_parameters || []),
            isThinking: Array.isArray(m.supported_parameters) && m.supported_parameters.includes('reasoning'),
            contextLength: toFiniteNumber(m.context_length ?? m.top_provider?.context_length),
            // OpenRouter sometimes returns created as a number, sometimes as a
            // numeric string. Accept both; anything that coerces to NaN -> null.
            created: toFiniteNumber(m.created)
        }));
        return { ok: true, models };
    } catch (err) {
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

async function fetchOpenAIModels({ baseUrl, apiKey }) {
    try {
        const response = await fetch(`${trim(baseUrl)}/models`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) {
            return { ok: false, error: `${response.status} ${response.statusText}` };
        }
        const payload = await response.json();
        // OpenAI /models does NOT return pricing. We have a small hardcoded
        // pricing table for well-known models.
        const models = (payload.data || []).map(m => {
            const pricing = OPENAI_PRICING[m.id] || { input: null, output: null };
            const isReasoning = /^o\d/.test(m.id) || m.id.includes('reasoning');
            return {
                id: m.id,
                name: m.id,
                pricing,
                supportedParameters: inferOpenAIParameters(m.id),
                isThinking: isReasoning,
                contextLength: OPENAI_CONTEXT[m.id] || null,
                created: toFiniteNumber(m.created)
            };
        });
        return { ok: true, models };
    } catch (err) {
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

// OpenAI /models does NOT return context length. Hardcoded for well-known models.
const OPENAI_CONTEXT = {
    'gpt-4.1': 1_047_576,
    'gpt-4.1-mini': 1_047_576,
    'gpt-4o': 128_000,
    'gpt-4o-mini': 128_000,
    'o1': 200_000,
    'o1-mini': 128_000,
    'o3': 200_000,
    'o3-mini': 200_000
};

// OpenAI per-1M token pricing (USD). Update periodically.
const OPENAI_PRICING = {
    'gpt-4.1': { input: 2.5, output: 10 },
    'gpt-4.1-mini': { input: 0.4, output: 1.6 },
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'o1': { input: 15, output: 60 },
    'o1-mini': { input: 1.1, output: 4.4 },
    'o3': { input: 2, output: 8 },
    'o3-mini': { input: 1.1, output: 4.4 }
};

function inferOpenAIParameters(modelId) {
    const base = new Set(['temperature', 'top_p', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed']);
    if (/^o\d/.test(modelId)) {
        base.add('reasoning_effort');
        base.delete('temperature');  // reasoning models ignore temperature
        base.delete('top_p');
        base.delete('frequency_penalty');
        base.delete('presence_penalty');
    }
    return base;
}

async function fetchAnthropicModels({ baseUrl, apiKey }) {
    try {
        const response = await fetch(`${trim(baseUrl)}/models`, {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        });
        if (!response.ok) {
            return { ok: false, error: `${response.status} ${response.statusText}` };
        }
        const payload = await response.json();
        const models = (payload.data || []).map(m => {
            const pricing = ANTHROPIC_PRICING[m.id] || { input: null, output: null };
            const isThinking = m.id.includes('claude-opus') || m.id.includes('claude-sonnet');
            // Anthropic /models gives created_at as an ISO string; convert
            // to unix seconds so it sorts consistently with other providers.
            let created = null;
            if (m.created_at) {
                const parsed = Date.parse(m.created_at);
                if (!Number.isNaN(parsed)) created = Math.floor(parsed / 1000);
            }
            return {
                id: m.id,
                name: m.display_name || m.id,
                pricing,
                supportedParameters: new Set(['temperature', 'top_p', 'top_k', 'max_tokens', 'thinking']),
                isThinking,
                contextLength: ANTHROPIC_CONTEXT[m.id] || 200_000,
                created
            };
        });
        return { ok: true, models };
    } catch (err) {
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

const ANTHROPIC_CONTEXT = {
    'claude-opus-4-5-20251001': 200_000,
    'claude-sonnet-4-5-20250514': 200_000,
    'claude-haiku-4-5-20251001': 200_000
};

const ANTHROPIC_PRICING = {
    'claude-opus-4-5-20251001': { input: 15, output: 75 },
    'claude-sonnet-4-5-20250514': { input: 3, output: 15 },
    'claude-haiku-4-5-20251001': { input: 0.8, output: 4 }
};

async function fetchOllamaModels({ baseUrl }) {
    try {
        const response = await fetch(`${trim(baseUrl)}/api/tags`);
        if (!response.ok) {
            return { ok: false, error: `${response.status} ${response.statusText}` };
        }
        const payload = await response.json();
        const models = (payload.models || []).map(m => ({
            id: m.name,
            name: m.name,
            pricing: { input: 0, output: 0 }, // local
            supportedParameters: new Set(['temperature', 'top_p', 'top_k', 'max_tokens', 'seed']),
            isThinking: false, // local models do not typically expose reasoning as a separate param
            contextLength: m.details?.parameter_size ? null : null, // Ollama API doesn't expose context length reliably
            created: typeof m.modified_at === 'string' ? Math.floor(Date.parse(m.modified_at) / 1000) : null
        }));
        return { ok: true, models };
    } catch (err) {
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

function trim(base) {
    return base.replace(/\/+$/, '');
}

// Coerce value to a finite number. Accepts numbers and numeric strings.
// Returns null for null, undefined, NaN, Infinity, empty string, or anything
// non-numeric. Used to normalize provider API fields that may arrive as either
// int or decimal string (OpenRouter flips between the two for pricing vs
// created vs context_length).
function toFiniteNumber(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

module.exports = { fetchModels };
