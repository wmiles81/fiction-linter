import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchModels } from './modelCatalog.js';

describe('modelCatalog.fetchModels', () => {
    const realFetch = global.fetch;
    beforeEach(() => { global.fetch = vi.fn(); });
    afterEach(() => { global.fetch = realFetch; });

    it('returns error when apiKey missing', async () => {
        const result = await fetchModels({ provider: 'openrouter', baseUrl: '', apiKey: '' });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/API key required/);
    });

    it('openrouter: converts per-token pricing to per-1M and flags reasoning', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                data: [
                    {
                        id: 'openai/gpt-4.1-mini',
                        name: 'GPT 4.1 Mini',
                        pricing: { prompt: '0.0000004', completion: '0.0000016' },
                        supported_parameters: ['temperature', 'top_p', 'tools']
                    },
                    {
                        id: 'openai/o1',
                        name: 'o1',
                        pricing: { prompt: '0.000015', completion: '0.00006' },
                        supported_parameters: ['reasoning', 'tools']
                    }
                ]
            })
        });
        const result = await fetchModels({
            provider: 'openrouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-test'
        });
        expect(result.ok).toBe(true);
        expect(result.models).toHaveLength(2);
        expect(result.models[0].pricing.input).toBeCloseTo(0.4, 3);
        expect(result.models[0].pricing.output).toBeCloseTo(1.6, 3);
        expect(result.models[0].isThinking).toBe(false);
        expect(result.models[1].isThinking).toBe(true);
    });

    it('openai: enriches list with hardcoded pricing for known models', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                data: [
                    { id: 'gpt-4.1-mini' },
                    { id: 'o1-mini' }
                ]
            })
        });
        const result = await fetchModels({
            provider: 'openai',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'sk-test'
        });
        expect(result.ok).toBe(true);
        expect(result.models[0].pricing.input).toBe(0.4);
        expect(result.models[1].isThinking).toBe(true);
        expect(result.models[1].supportedParameters.has('reasoning_effort')).toBe(true);
        expect(result.models[1].supportedParameters.has('temperature')).toBe(false);
    });

    it('ollama: local models marked with zero pricing', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                models: [{ name: 'llama3:8b' }, { name: 'qwen2.5:32b' }]
            })
        });
        const result = await fetchModels({
            provider: 'ollama',
            baseUrl: 'http://localhost:11434',
            apiKey: 'n/a'
        });
        expect(result.ok).toBe(true);
        expect(result.models).toHaveLength(2);
        expect(result.models[0].pricing.input).toBe(0);
    });

    it('returns error on non-2xx', async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });
        const result = await fetchModels({
            provider: 'openrouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'bad'
        });
        expect(result.ok).toBe(false);
        expect(result.error).toContain('401');
    });
});
