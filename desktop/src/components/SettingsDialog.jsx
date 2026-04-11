import React, { useEffect, useState } from 'react';
import ModelPicker from './ModelPicker';

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
                    <input
                        id="spePath"
                        type="text"
                        value={localSettings.spePath}
                        onChange={event =>
                            setLocalSettings(prev => ({ ...prev, spePath: event.target.value }))
                        }
                        placeholder="/path/to/spe_defaults"
                    />
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
