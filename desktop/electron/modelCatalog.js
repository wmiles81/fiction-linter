/**
 * Per-provider model catalog fetchers.
 *
 * Returns a normalized model list regardless of provider API shape:
 *   [{ id, name, pricing: { input, output }, supportedParameters, isThinking }]
 *
 * Pricing is in USD per 1M tokens.
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
            isThinking: Array.isArray(m.supported_parameters) && m.supported_parameters.includes('reasoning')
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
                isThinking: isReasoning
            };
        });
        return { ok: true, models };
    } catch (err) {
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

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
            return {
                id: m.id,
                name: m.display_name || m.id,
                pricing,
                supportedParameters: new Set(['temperature', 'top_p', 'top_k', 'max_tokens', 'thinking']),
                isThinking
            };
        });
        return { ok: true, models };
    } catch (err) {
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

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
            isThinking: false // local models do not typically expose reasoning as a separate param
        }));
        return { ok: true, models };
    } catch (err) {
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

function trim(base) {
    return base.replace(/\/+$/, '');
}

module.exports = { fetchModels };
