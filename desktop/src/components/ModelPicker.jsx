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

// Sort / view modes the user can pick. Each entry has a label (shown in the
// dropdown) and a compare function (ascending). 'free' is a special mode
// that filters AND sorts by id within the free set.
const SORT_MODES = {
    provider: {
        label: 'Provider (A–Z)',
        compare: (a, b) => a.id.localeCompare(b.id)
    },
    'cost-asc': {
        label: 'Cost: Low to High',
        // Sort by input+output since the effective cost is both combined.
        // Free models naturally sort first. Null pricing sorts last so
        // unknown-cost models do not masquerade as "cheap".
        compare: (a, b) => effectiveCost(a) - effectiveCost(b) || a.id.localeCompare(b.id)
    },
    'cost-desc': {
        label: 'Cost: High to Low',
        compare: (a, b) => effectiveCost(b) - effectiveCost(a) || a.id.localeCompare(b.id)
    },
    'context-desc': {
        label: 'Context: Largest First',
        // For novelists with long manuscripts: sort by context window
        // desc. Unknown context sorts last.
        compare: (a, b) => (b.contextLength ?? -1) - (a.contextLength ?? -1) || a.id.localeCompare(b.id)
    },
    newest: {
        label: 'Newest First',
        // Uses the `created` unix timestamp from the provider API.
        // Providers that do not supply a date sort last.
        compare: (a, b) => (b.created ?? -1) - (a.created ?? -1) || a.id.localeCompare(b.id)
    },
    free: {
        label: 'Free only',
        // Filter mode: handled specially (see sortedModels logic).
        compare: (a, b) => a.id.localeCompare(b.id)
    }
};

const DEFAULT_SORT = 'provider';
const SORT_STORAGE_KEY = 'fl.modelSort';

// Effective cost for sorting: sum of input + output per-1M. Treat unknown
// pricing as Infinity so these models sort to the bottom of asc views and
// the top of desc views (either way, highlighting their ambiguity).
function effectiveCost(m) {
    const input = m?.pricing?.input;
    const output = m?.pricing?.output;
    if (input == null || output == null) return Infinity;
    return input + output;
}

function formatPrice(p) {
    if (p == null) return '—';
    return `$${p.toFixed(2)}`;
}

// Human-readable context window: 128_000 -> "128k", 2_000_000 -> "2M",
// 1_500_000 -> "1.5M". Returns null when the value is unknown so callers
// can omit the suffix entirely.
function formatContext(tokens) {
    if (tokens == null || !Number.isFinite(tokens) || tokens <= 0) return null;
    if (tokens >= 1_000_000) {
        const m = tokens / 1_000_000;
        // Show one decimal place if not a round number of millions.
        return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
    }
    if (tokens >= 1000) {
        return `${Math.round(tokens / 1000)}k`;
    }
    return String(tokens);
}

// A model is considered free when BOTH input and output are $0. OpenRouter
// labels many previewing/test foundation models at $0/$0 — these are often
// the best available models for the task, so the UI should surface them
// prominently instead of hiding them in a sea of $0.00 / $0.00 rows.
function isFreeModel(m) {
    return m?.pricing?.input === 0 && m?.pricing?.output === 0;
}

function readStoredSort() {
    if (typeof window === 'undefined') return DEFAULT_SORT;
    try {
        const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
        return stored && SORT_MODES[stored] ? stored : DEFAULT_SORT;
    } catch {
        return DEFAULT_SORT;
    }
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
    const [sortMode, setSortMode] = useState(readStoredSort);

    const handleSortChange = (nextMode) => {
        setSortMode(nextMode);
        try {
            window.localStorage.setItem(SORT_STORAGE_KEY, nextMode);
        } catch { /* private mode, quota — non-fatal */ }
    };

    // Apply the active mode's filter + sort. Only 'free' filters; all other
    // modes show every model. 'provider' is the alphabetical default.
    const sortedModels = useMemo(() => {
        const base = [...(models || [])];
        const filtered = sortMode === 'free' ? base.filter(isFreeModel) : base;
        const compare = SORT_MODES[sortMode]?.compare || SORT_MODES[DEFAULT_SORT].compare;
        return filtered.sort(compare);
    }, [models, sortMode]);

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
                <label className="model-picker-sort">
                    <span className="visually-hidden">Sort models by</span>
                    <select
                        className="model-picker-sort-select"
                        value={sortMode}
                        onChange={e => handleSortChange(e.target.value)}
                        aria-label="Sort models by"
                    >
                        {Object.entries(SORT_MODES).map(([value, def]) => {
                            // Decorate the Free option with its count so users
                            // know whether switching to it is worthwhile.
                            const label = value === 'free' && freeCount > 0
                                ? `${def.label} (${freeCount})`
                                : def.label;
                            // Hide the Free option entirely when there are zero
                            // free models — picking it would empty the list.
                            if (value === 'free' && freeCount === 0) return null;
                            return (
                                <option key={value} value={value}>{label}</option>
                            );
                        })}
                    </select>
                </label>
                {loading ? <span className="model-picker-loading">Loading…</span> : null}
                {error ? <span className="model-picker-error">{error}</span> : null}
            </div>

            <div className="model-listbox" role="listbox" aria-label="Model list">
                {sortedModels.length === 0 && !loading && !error ? (
                    <div className="model-listbox-empty">
                        {sortMode === 'free'
                            ? 'No free models available from this provider.'
                            : 'Enter an API key and refresh to load models.'}
                    </div>
                ) : null}
                {sortedModels.map(m => {
                    const isSelected = m.id === selectedModel;
                    const free = isFreeModel(m);
                    const ctx = formatContext(m.contextLength);
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
                            <span className="model-row-id">
                                {m.id}
                                {ctx ? <span className="model-row-ctx"> ({ctx})</span> : null}
                            </span>
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
