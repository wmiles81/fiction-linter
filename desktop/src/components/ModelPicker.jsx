import React, { useMemo, useState } from 'react';

const PARAM_CONFIGS = {
    temperature: { label: 'Temperature', type: 'number', step: 0.01, min: 0, max: 2 },
    top_p: { label: 'Top P', type: 'number', step: 0.01, min: 0, max: 1 },
    top_k: { label: 'Top K', type: 'number', step: 1, min: 0 },
    max_tokens: { label: 'Max Output Tokens', type: 'number', step: 1, min: 1 },
    frequency_penalty: { label: 'Frequency Penalty', type: 'number', step: 0.1, min: -2, max: 2 },
    presence_penalty: { label: 'Presence Penalty', type: 'number', step: 0.1, min: -2, max: 2 },
    seed: { label: 'Seed', type: 'number', step: 1 },
    reasoning_effort: { label: 'Reasoning Effort', type: 'select', options: ['low', 'medium', 'high'] },
    thinking: { label: 'Thinking Budget Tokens', type: 'number', step: 100, min: 0, max: 32000 }
};

function formatPrice(p) {
    if (p == null) return '—';
    return `$${p.toFixed(2)}`;
}

// A model is considered free when BOTH input and output are $0. OpenRouter
// labels many previewing/test foundation models at $0/$0 — these are often
// the best available models for the task, so the UI should surface them
// prominently instead of hiding them in a sea of $0.00 / $0.00 rows.
function isFreeModel(m) {
    return m?.pricing?.input === 0 && m?.pricing?.output === 0;
}

function ModelPicker({
    models,
    selectedModel,
    hyperparameters,
    onSelectModel,
    onChangeHyperparameters,
    loading,
    error
}) {
    const [freeOnly, setFreeOnly] = useState(false);

    // Sort models by full ID. For OpenRouter-style "provider/model" IDs this
    // groups models by provider AND sorts within each provider in one pass
    // (because the slash-prefix sorts alphabetically). For direct OpenAI /
    // Anthropic / Ollama fetches the IDs are unprefixed model names so the
    // sort gives a flat alphabetical list — also what users expect.
    //
    // When freeOnly is on, filter to $0/$0 models. When OFF, free models
    // still bubble to the top via a secondary sort so a user scanning the
    // list spots them without having to scroll past paid ones first.
    const sortedModels = useMemo(() => {
        const base = [...(models || [])];
        const filtered = freeOnly ? base.filter(isFreeModel) : base;
        return filtered.sort((a, b) => {
            const aFree = isFreeModel(a);
            const bFree = isFreeModel(b);
            if (aFree !== bFree) return aFree ? -1 : 1;
            return a.id.localeCompare(b.id);
        });
    }, [models, freeOnly]);

    const freeCount = useMemo(
        () => (models || []).filter(isFreeModel).length,
        [models]
    );

    const selected = useMemo(
        () => sortedModels.find(m => m.id === selectedModel),
        [sortedModels, selectedModel]
    );

    const handleParamChange = (key, rawValue) => {
        const config = PARAM_CONFIGS[key];
        const parsed = config?.type === 'number' ? Number(rawValue) : rawValue;
        onChangeHyperparameters({ ...hyperparameters, [key]: parsed });
    };

    return (
        <div className="model-picker">
            <div className="model-picker-header">
                <span>Model</span>
                {freeCount > 0 ? (
                    <label className="model-picker-filter" title="Show only models with $0 prompt and $0 completion pricing">
                        <input
                            type="checkbox"
                            checked={freeOnly}
                            onChange={e => setFreeOnly(e.target.checked)}
                        />
                        <span>Free only ({freeCount})</span>
                    </label>
                ) : null}
                {loading ? <span className="model-picker-loading">Loading…</span> : null}
                {error ? <span className="model-picker-error">{error}</span> : null}
            </div>

            <div className="model-listbox" role="listbox" aria-label="Model list">
                {sortedModels.length === 0 && !loading && !error ? (
                    <div className="model-listbox-empty">
                        {freeOnly
                            ? 'No free models available from this provider.'
                            : 'Enter an API key and refresh to load models.'}
                    </div>
                ) : null}
                {sortedModels.map(m => {
                    const isSelected = m.id === selectedModel;
                    const free = isFreeModel(m);
                    const classes = [
                        'model-row',
                        isSelected ? 'selected' : '',
                        m.isThinking ? 'thinking' : '',
                        free ? 'free' : ''
                    ].filter(Boolean).join(' ');
                    return (
                        <div
                            key={m.id}
                            className={classes}
                            role="option"
                            aria-selected={isSelected}
                            data-model-id={m.id}
                            onClick={() => onSelectModel(m.id)}
                        >
                            <span className="model-row-id">{m.id}</span>
                            {free ? (
                                <span className="model-row-badge free-badge">FREE</span>
                            ) : (
                                <span className="model-row-price">
                                    {formatPrice(m.pricing?.input)} / {formatPrice(m.pricing?.output)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {selected ? (
                <div className="hyperparameter-panel">
                    <div className="hyperparameter-panel-header">Hyperparameters</div>
                    <div className="hyperparameter-grid">
                        {Object.entries(PARAM_CONFIGS).map(([key, config]) => {
                            if (!selected.supportedParameters.has(key)) return null;
                            const value = hyperparameters?.[key] ?? '';
                            if (config.type === 'select') {
                                return (
                                    <label key={key} className="hyperparameter-field">
                                        <span>{config.label}</span>
                                        <select
                                            value={value}
                                            onChange={e => handleParamChange(key, e.target.value)}
                                        >
                                            <option value="">(default)</option>
                                            {config.options.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </label>
                                );
                            }
                            return (
                                <label key={key} className="hyperparameter-field">
                                    <span>{config.label}</span>
                                    <input
                                        type="number"
                                        step={config.step}
                                        min={config.min}
                                        max={config.max}
                                        value={value}
                                        onChange={e => handleParamChange(key, e.target.value)}
                                    />
                                </label>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default ModelPicker;
