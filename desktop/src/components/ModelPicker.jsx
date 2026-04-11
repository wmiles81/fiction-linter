import React, { useMemo } from 'react';

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

function ModelPicker({
    models,
    selectedModel,
    hyperparameters,
    onSelectModel,
    onChangeHyperparameters,
    loading,
    error
}) {
    const selected = useMemo(
        () => models.find(m => m.id === selectedModel),
        [models, selectedModel]
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
                {loading ? <span className="model-picker-loading">Loading…</span> : null}
                {error ? <span className="model-picker-error">{error}</span> : null}
            </div>

            <div className="model-listbox" role="listbox" aria-label="Model list">
                {models.length === 0 && !loading && !error ? (
                    <div className="model-listbox-empty">Enter an API key and refresh to load models.</div>
                ) : null}
                {models.map(m => {
                    const isSelected = m.id === selectedModel;
                    const classes = [
                        'model-row',
                        isSelected ? 'selected' : '',
                        m.isThinking ? 'thinking' : ''
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
                            <span className="model-row-price">
                                {formatPrice(m.pricing?.input)} / {formatPrice(m.pricing?.output)}
                            </span>
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
