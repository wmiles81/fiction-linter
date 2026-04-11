/**
 * Thin OpenAI-compatible chat completions client.
 *
 * Uses Node's built-in fetch (Electron 31 bundles a recent Node).
 * Intentionally dependency-free so it's trivially unit-testable.
 */

async function callChatCompletion({ baseUrl, apiKey, model, messages, temperature }) {
    if (!baseUrl || !apiKey) {
        return { ok: false, error: 'Missing baseUrl or apiKey.' };
    }

    const trimmedBase = baseUrl.replace(/\/+$/, '');
    const url = `${trimmedBase}/chat/completions`;

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: typeof temperature === 'number' ? temperature : 0.7
            })
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
