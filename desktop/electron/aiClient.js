/**
 * Thin OpenAI-compatible chat completions client.
 *
 * Uses Node's built-in fetch (Electron 31 bundles a recent Node).
 * Intentionally dependency-free so it's trivially unit-testable.
 */

async function callChatCompletion({ baseUrl, apiKey, model, messages, hyperparameters }) {
    // Distinguish the two errors — they have different user remedies.
    // "Set a base URL" vs "paste an API key in Settings → AI".
    if (!baseUrl) return { ok: false, error: 'Missing baseUrl (no default configured for this provider).' };
    if (!apiKey)  return { ok: false, error: 'Missing API key — open Settings → AI to paste one.' };

    const trimmedBase = baseUrl.replace(/\/+$/, '');
    const url = `${trimmedBase}/chat/completions`;
    const body = { model, messages, ...(hyperparameters || {}) };

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(60000)
        });
    } catch (err) {
        return { ok: false, error: `Network error: ${err.message}` };
    }

    if (!response.ok) {
        let detail = '';
        try {
            const payload = await response.json();
            detail = payload?.error?.message || JSON.stringify(payload).slice(0, 300);
        } catch {
            detail = await response.text().catch(() => '');
        }
        return { ok: false, error: `${response.status} ${detail}`.trim() };
    }

    try {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content ?? '';
        return { ok: true, content };
    } catch (err) {
        return { ok: false, error: `Invalid response: ${err.message}` };
    }
}

module.exports = { callChatCompletion };
