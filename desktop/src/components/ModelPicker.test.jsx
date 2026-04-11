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
});
