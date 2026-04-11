import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callChatCompletion } from './aiClient.js';

describe('callChatCompletion', () => {
    const realFetch = global.fetch;

    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = realFetch;
    });

    it('POSTs to {baseUrl}/chat/completions with a bearer token', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                choices: [{ message: { role: 'assistant', content: 'hello' } }]
            })
        });

        const result = await callChatCompletion({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'sk-test-abc',
            model: 'openai/gpt-4.1-mini',
            messages: [{ role: 'user', content: 'hi' }]
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://api.example.com/v1/chat/completions');
        expect(options.method).toBe('POST');
        expect(options.headers['Authorization']).toBe('Bearer sk-test-abc');
        expect(options.headers['Content-Type']).toBe('application/json');
        const body = JSON.parse(options.body);
        expect(body.model).toBe('openai/gpt-4.1-mini');
        expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);

        expect(result).toEqual({ ok: true, content: 'hello' });
    });

    it('trims trailing slash on baseUrl', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: 'x' } }] })
        });

        await callChatCompletion({
            baseUrl: 'https://api.example.com/v1/',
            apiKey: 'k',
            model: 'm',
            messages: []
        });

        expect(global.fetch.mock.calls[0][0]).toBe('https://api.example.com/v1/chat/completions');
    });

    it('returns { ok: false, error } on non-2xx', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: { message: 'unauthorized' } })
        });

        const result = await callChatCompletion({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'bad',
            model: 'm',
            messages: []
        });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('401');
    });

    it('returns { ok: false, error } on network failure', async () => {
        global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

        const result = await callChatCompletion({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'k',
            model: 'm',
            messages: []
        });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('ECONNREFUSED');
    });

    it('returns { ok: false } when baseUrl or apiKey is missing', async () => {
        const result = await callChatCompletion({
            baseUrl: '',
            apiKey: '',
            model: 'm',
            messages: []
        });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/missing/i);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
