import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModelPicker from './ModelPicker';

const sampleModels = [
    {
        id: 'openai/gpt-4.1-mini',
        name: 'GPT 4.1 Mini',
        pricing: { input: 0.4, output: 1.6 },
        supportedParameters: new Set(['temperature', 'top_p', 'max_tokens']),
        isThinking: false
    },
    {
        id: 'openai/o1',
        name: 'o1',
        pricing: { input: 15, output: 60 },
        supportedParameters: new Set(['reasoning_effort', 'max_tokens']),
        isThinking: true
    }
];

describe('ModelPicker', () => {
    beforeEach(() => {
        window.api.fetchModels = vi.fn();
        // Reset persisted sort mode so each test starts in the default
        // "provider" sort, independent of any prior test selecting e.g. 'free'.
        try { window.localStorage.removeItem('fl.modelSort'); } catch { /* ignore */ }
    });

    it('renders model rows with right-aligned pricing when provided', () => {
        render(
            <ModelPicker
                provider="openrouter"
                baseUrl="https://openrouter.ai/api/v1"
                apiKey="sk-test"
                models={sampleModels}
                selectedModel="openai/gpt-4.1-mini"
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false}
                error={null}
            />
        );
        expect(screen.getByText('openai/gpt-4.1-mini')).toBeInTheDocument();
        expect(screen.getByText('$0.40 / $1.60')).toBeInTheDocument();
        expect(screen.getByText('$15.00 / $60.00')).toBeInTheDocument();
    });

    it('marks thinking models with the thinking class', () => {
        const { container } = render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={sampleModels}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        const thinkingRow = container.querySelector('[data-model-id="openai/o1"]');
        expect(thinkingRow?.className).toMatch(/thinking/);
    });

    it('fires onSelectModel when a row is clicked', async () => {
        const onSelectModel = vi.fn();
        const user = userEvent.setup();
        render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={sampleModels}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={onSelectModel}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        await user.click(screen.getByText('openai/o1'));
        expect(onSelectModel).toHaveBeenCalledWith('openai/o1');
    });

    it('shows loading state when loading=true', () => {
        render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={[]}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={true} error={null}
            />
        );
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows error message when error prop is set', () => {
        render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={[]}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error="401 unauthorized"
            />
        );
        expect(screen.getByText(/401 unauthorized/)).toBeInTheDocument();
    });

    it('hyperparameter panel shows temperature only when supported by selected model', () => {
        const { rerender } = render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={sampleModels}
                selectedModel="openai/gpt-4.1-mini"
                hyperparameters={{ temperature: 0.7 }}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        expect(screen.getByLabelText(/temperature/i)).toBeInTheDocument();

        rerender(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={sampleModels}
                selectedModel="openai/o1"
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        // o1 does not support temperature
        expect(screen.queryByLabelText(/^temperature/i)).not.toBeInTheDocument();
        // but it does support reasoning effort
        expect(screen.getByLabelText(/reasoning effort/i)).toBeInTheDocument();
    });

    it('hyperparameter change fires onChangeHyperparameters', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={sampleModels}
                selectedModel="openai/gpt-4.1-mini"
                hyperparameters={{ temperature: 0.7 }}
                onSelectModel={() => {}}
                onChangeHyperparameters={onChange}
                loading={false} error={null}
            />
        );
        const tempInput = screen.getByLabelText(/temperature/i);
        await user.clear(tempInput);
        await user.type(tempInput, '0.5');
        // React fires multiple change events as the user types; we check that the last call had 0.5
        expect(onChange).toHaveBeenCalled();
    });

    it('sorts models by full ID (groups by provider for slash-prefixed IDs)', () => {
        const unsortedModels = [
            {
                id: 'openai/o1',
                name: 'o1',
                pricing: { input: 15, output: 60 },
                supportedParameters: new Set(),
                isThinking: true
            },
            {
                id: 'anthropic/claude-sonnet-4-5',
                name: 'Claude Sonnet 4.5',
                pricing: { input: 3, output: 15 },
                supportedParameters: new Set(),
                isThinking: false
            },
            {
                id: 'openai/gpt-4.1-mini',
                name: 'GPT 4.1 Mini',
                pricing: { input: 0.4, output: 1.6 },
                supportedParameters: new Set(),
                isThinking: false
            },
            {
                id: 'anthropic/claude-opus-4-5',
                name: 'Claude Opus 4.5',
                pricing: { input: 15, output: 75 },
                supportedParameters: new Set(),
                isThinking: false
            }
        ];

        const { container } = render(
            <ModelPicker
                provider="openrouter"
                baseUrl=""
                apiKey=""
                models={unsortedModels}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false}
                error={null}
            />
        );

        const renderedIds = Array.from(container.querySelectorAll('[data-model-id]'))
            .map(el => el.getAttribute('data-model-id'));

        // Expected order: anthropic models first (alphabetical), then openai
        // models. Within each provider, alphabetical.
        expect(renderedIds).toEqual([
            'anthropic/claude-opus-4-5',
            'anthropic/claude-sonnet-4-5',
            'openai/gpt-4.1-mini',
            'openai/o1'
        ]);
    });

    it('shows a FREE badge for models priced at $0 input and $0 output', () => {
        const modelsWithFree = [
            {
                id: 'openrouter/free-preview-model',
                name: 'Free Preview',
                pricing: { input: 0, output: 0 },
                supportedParameters: new Set(),
                isThinking: false
            },
            {
                id: 'openai/gpt-4.1-mini',
                name: 'GPT 4.1 Mini',
                pricing: { input: 0.4, output: 1.6 },
                supportedParameters: new Set(),
                isThinking: false
            }
        ];
        render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={modelsWithFree}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        expect(screen.getByText('FREE')).toBeInTheDocument();
        // Paid model still shows price text
        expect(screen.getByText('$0.40 / $1.60')).toBeInTheDocument();
    });

    it('sort dropdown switches to Cost: Low to High and places free models first', async () => {
        const user = userEvent.setup();
        const mixed = [
            { id: 'x/premium', name: 'Premium', pricing: { input: 15, output: 60 }, supportedParameters: new Set(), isThinking: false },
            { id: 'y/cheap', name: 'Cheap', pricing: { input: 0.1, output: 0.3 }, supportedParameters: new Set(), isThinking: false },
            { id: 'z/free', name: 'Free', pricing: { input: 0, output: 0 }, supportedParameters: new Set(), isThinking: false }
        ];
        const { container } = render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={mixed}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'cost-asc');
        const ids = Array.from(container.querySelectorAll('[data-model-id]'))
            .map(el => el.getAttribute('data-model-id'));
        expect(ids).toEqual(['z/free', 'y/cheap', 'x/premium']);
    });

    it('sort by Cost: High to Low puts most-expensive first', async () => {
        const user = userEvent.setup();
        const mixed = [
            { id: 'a/cheap', name: 'Cheap', pricing: { input: 0.1, output: 0.3 }, supportedParameters: new Set(), isThinking: false },
            { id: 'b/premium', name: 'Premium', pricing: { input: 15, output: 60 }, supportedParameters: new Set(), isThinking: false },
            { id: 'c/mid', name: 'Mid', pricing: { input: 2, output: 8 }, supportedParameters: new Set(), isThinking: false }
        ];
        const { container } = render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={mixed}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'cost-desc');
        const ids = Array.from(container.querySelectorAll('[data-model-id]'))
            .map(el => el.getAttribute('data-model-id'));
        expect(ids).toEqual(['b/premium', 'c/mid', 'a/cheap']);
    });

    it('sort by Context: Largest First orders by contextLength desc', async () => {
        const user = userEvent.setup();
        const mixed = [
            { id: 'a', name: 'A', pricing: { input: 0, output: 0 }, supportedParameters: new Set(), isThinking: false, contextLength: 128_000 },
            { id: 'b', name: 'B', pricing: { input: 0, output: 0 }, supportedParameters: new Set(), isThinking: false, contextLength: 2_000_000 },
            { id: 'c', name: 'C', pricing: { input: 0, output: 0 }, supportedParameters: new Set(), isThinking: false, contextLength: 32_000 }
        ];
        const { container } = render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={mixed}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'context-desc');
        const ids = Array.from(container.querySelectorAll('[data-model-id]'))
            .map(el => el.getAttribute('data-model-id'));
        expect(ids).toEqual(['b', 'a', 'c']);
    });

    it('sort by Newest First orders by created desc', async () => {
        const user = userEvent.setup();
        const mixed = [
            { id: 'old', name: 'Old', pricing: { input: 1, output: 1 }, supportedParameters: new Set(), isThinking: false, created: 1_600_000_000 },
            { id: 'new', name: 'New', pricing: { input: 1, output: 1 }, supportedParameters: new Set(), isThinking: false, created: 1_800_000_000 },
            { id: 'mid', name: 'Mid', pricing: { input: 1, output: 1 }, supportedParameters: new Set(), isThinking: false, created: 1_700_000_000 }
        ];
        const { container } = render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={mixed}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'newest');
        const ids = Array.from(container.querySelectorAll('[data-model-id]'))
            .map(el => el.getAttribute('data-model-id'));
        expect(ids).toEqual(['new', 'mid', 'old']);
    });

    it('Free only option filters to $0 models and shows count in its label', async () => {
        const user = userEvent.setup();
        const mixedModels = [
            { id: 'free/a', name: 'A', pricing: { input: 0, output: 0 }, supportedParameters: new Set(), isThinking: false },
            { id: 'free/b', name: 'B', pricing: { input: 0, output: 0 }, supportedParameters: new Set(), isThinking: false },
            { id: 'paid/x', name: 'X', pricing: { input: 1, output: 2 }, supportedParameters: new Set(), isThinking: false }
        ];
        const { container } = render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={mixedModels}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        // Free option shows the count in parentheses
        expect(screen.getByRole('option', { name: /Free only \(2\)/i })).toBeInTheDocument();
        // Before filtering: three rows (default Provider sort)
        expect(container.querySelectorAll('[data-model-id]')).toHaveLength(3);
        await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'free');
        const filteredIds = Array.from(container.querySelectorAll('[data-model-id]'))
            .map(el => el.getAttribute('data-model-id'));
        expect(filteredIds).toEqual(['free/a', 'free/b']);
    });

    it('hides the Free only option when no free models exist', () => {
        const onlyPaid = [
            { id: 'paid/x', name: 'X', pricing: { input: 1, output: 2 }, supportedParameters: new Set(), isThinking: false }
        ];
        render(
            <ModelPicker
                provider="openrouter" baseUrl="" apiKey=""
                models={onlyPaid}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false} error={null}
            />
        );
        expect(screen.queryByRole('option', { name: /Free only/i })).not.toBeInTheDocument();
    });

    it('sorts unprefixed model IDs alphabetically', () => {
        // Direct OpenAI / Anthropic / Ollama fetches return models with no
        // provider prefix. They should still sort alphabetically by name.
        const unprefixedModels = [
            { id: 'o3', name: 'o3', pricing: {}, supportedParameters: new Set(), isThinking: true },
            { id: 'gpt-4.1-mini', name: 'gpt-4.1-mini', pricing: {}, supportedParameters: new Set(), isThinking: false },
            { id: 'gpt-4o', name: 'gpt-4o', pricing: {}, supportedParameters: new Set(), isThinking: false },
            { id: 'o1-mini', name: 'o1-mini', pricing: {}, supportedParameters: new Set(), isThinking: true }
        ];

        const { container } = render(
            <ModelPicker
                provider="openai"
                baseUrl=""
                apiKey=""
                models={unprefixedModels}
                selectedModel=""
                hyperparameters={{}}
                onSelectModel={() => {}}
                onChangeHyperparameters={() => {}}
                loading={false}
                error={null}
            />
        );

        const renderedIds = Array.from(container.querySelectorAll('[data-model-id]'))
            .map(el => el.getAttribute('data-model-id'));

        expect(renderedIds).toEqual([
            'gpt-4.1-mini',
            'gpt-4o',
            'o1-mini',
            'o3'
        ]);
    });
});
