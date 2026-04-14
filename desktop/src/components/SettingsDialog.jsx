import React, { useEffect, useState } from 'react';
import ModelPicker from './ModelPicker';

function countEntries(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    return Object.keys(obj).length;
}

function SettingsDialog({ settings, onCancel, onSave }) {
    const [localSettings, setLocalSettings] = useState({
        ...settings,
        ai: {
            ...settings.ai,
            apiKey: settings.ai?.apiKey || '',
            hyperparameters: settings.ai?.hyperparameters || {}
        }
    });
    const [models, setModels] = useState([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelError, setModelError] = useState(null);
    // Live preview of the SPE rule counts for the currently-entered path,
    // so users know they picked a valid SPE-Config dir before clicking Save.
    // null = haven't tried loading yet; {} = loaded empty; { counts, ... } = loaded.
    const [speSummary, setSpeSummary] = useState(null);

    const { provider, baseUrl, apiKey, model, hyperparameters } = localSettings.ai;

    const loadModels = async () => {
        if (!apiKey) return;
        setLoadingModels(true);
        setModelError(null);
        try {
            const result = await window.api.fetchModels({ provider, baseUrl, apiKey });
            if (result.ok) {
                setModels(result.models);
            } else {
                setModelError(result.error);
                setModels([]);
            }
        } catch (err) {
            setModelError(err.message);
            setModels([]);
        } finally {
            setLoadingModels(false);
        }
    };

    useEffect(() => {
        // Auto-load models when the dialog opens if credentials are already set
        if (apiKey && provider) {
            loadModels();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Preview-load the SPE rule counts whenever spePath changes. Debounced
    // so typing a path doesn't fire a load per keystroke. loadSpeData is
    // idempotent and cheap — it just reads YAML from disk — so calling it
    // purely for UI feedback is fine.
    useEffect(() => {
        const path = localSettings.spePath;
        if (!path) {
            setSpeSummary(null);
            return;
        }
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                const data = await window.api.loadSpeData(path);
                if (cancelled) return;
                setSpeSummary({
                    cliches: countEntries(data?.cliches),
                    names: countEntries(data?.names),
                    places: countEntries(data?.places),
                    protocols: countEntries(data?.protocols)
                });
            } catch {
                if (!cancelled) setSpeSummary({ error: true });
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(handle); };
    }, [localSettings.spePath]);

    const updateAi = (field, value) => {
        setLocalSettings(prev => ({
            ...prev,
            ai: { ...prev.ai, [field]: value }
        }));
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-card modal-card-wide">
                <header>
                    <h2>Studio Settings</h2>
                    <p>Configure your SPE rules and AI connection details.</p>
                </header>

                <div className="modal-section">
                    <label htmlFor="spePath">SPE Rules Path</label>
                    <div className="inline-input-row">
                        <input
                            id="spePath"
                            type="text"
                            value={localSettings.spePath || ''}
                            onChange={event =>
                                setLocalSettings(prev => ({ ...prev, spePath: event.target.value }))
                            }
                            placeholder="Leave blank to use bundled defaults"
                        />
                        <button
                            type="button"
                            className="ghost-button"
                            onClick={async () => {
                                const picked = await window.api.chooseFolder();
                                if (picked) {
                                    setLocalSettings(prev => ({ ...prev, spePath: picked }));
                                }
                            }}
                        >
                            Browse…
                        </button>
                    </div>
                    <p className="modal-hint">
                        Point at your local <code>SPE-Config</code> directory (with
                        {' '}<code>cliche_collider.yaml</code>, <code>name_collider.yaml</code>, etc.)
                        to use rules you maintain yourself. Changes reload on save.
                        Leave blank to fall back to the bundled defaults shipped with the app.
                    </p>
                    {speSummary ? (
                        speSummary.error ? (
                            <p className="modal-hint spe-summary error">
                                Could not read SPE data from this path.
                            </p>
                        ) : (
                            <p className="modal-hint spe-summary">
                                Loaded:
                                {' '}<strong>{speSummary.cliches}</strong> cliche rules,
                                {' '}<strong>{speSummary.names}</strong> name rules,
                                {' '}<strong>{speSummary.places}</strong> place rules,
                                {' '}<strong>{speSummary.protocols}</strong> protocol entries.
                                {speSummary.cliches + speSummary.names + speSummary.places + speSummary.protocols === 0 ? (
                                    <> — <em>empty; check the folder contains the expected YAML files.</em></>
                                ) : null}
                            </p>
                        )
                    ) : null}
                </div>

                <div className="modal-section">
                    <label htmlFor="provider">Provider</label>
                    <select
                        id="provider"
                        value={provider}
                        onChange={e => updateAi('provider', e.target.value)}
                    >
                        <option value="openrouter">OpenRouter</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="ollama">Ollama (local)</option>
                    </select>

                    <label htmlFor="baseUrl">Base URL</label>
                    <input
                        id="baseUrl"
                        type="text"
                        value={baseUrl}
                        onChange={event => updateAi('baseUrl', event.target.value)}
                        placeholder="https://openrouter.ai/api/v1"
                    />

                    <label htmlFor="apiKey">API Key</label>
                    <input
                        id="apiKey"
                        type="password"
                        value={apiKey}
                        onChange={event => updateAi('apiKey', event.target.value)}
                        onBlur={loadModels}
                        placeholder="sk-..."
                    />

                    <button
                        type="button"
                        className="ghost-button"
                        onClick={loadModels}
                        disabled={!apiKey || loadingModels}
                    >
                        {loadingModels ? 'Loading…' : 'Refresh models'}
                    </button>
                </div>

                <div className="modal-section">
                    <ModelPicker
                        models={models}
                        selectedModel={model}
                        hyperparameters={hyperparameters}
                        onSelectModel={(id) => updateAi('model', id)}
                        onChangeHyperparameters={(h) => updateAi('hyperparameters', h)}
                        loading={loadingModels}
                        error={modelError}
                    />
                </div>

                <footer className="modal-actions">
                    <button className="ghost-button" onClick={onCancel}>Cancel</button>
                    <button className="primary-button" onClick={() => onSave(localSettings)}>
                        Save Settings
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default SettingsDialog;
