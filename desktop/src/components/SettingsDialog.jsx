import React, { useState } from 'react';

function SettingsDialog({ settings, onCancel, onSave }) {
    const [localSettings, setLocalSettings] = useState(settings);

    const updateAi = (field, value) => {
        setLocalSettings(prev => ({
            ...prev,
            ai: {
                ...prev.ai,
                [field]: value
            }
        }));
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-card">
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
                    <input
                        id="provider"
                        type="text"
                        value={localSettings.ai.provider}
                        onChange={event => updateAi('provider', event.target.value)}
                        placeholder="openrouter"
                    />

                    <label htmlFor="model">Model</label>
                    <input
                        id="model"
                        type="text"
                        value={localSettings.ai.model}
                        onChange={event => updateAi('model', event.target.value)}
                        placeholder="openai/gpt-4.1-mini"
                    />

                    <label htmlFor="baseUrl">Base URL</label>
                    <input
                        id="baseUrl"
                        type="text"
                        value={localSettings.ai.baseUrl}
                        onChange={event => updateAi('baseUrl', event.target.value)}
                        placeholder="https://api.openrouter.ai/v1"
                    />

                    <label htmlFor="apiKey">API Key</label>
                    <input
                        id="apiKey"
                        type="password"
                        value={localSettings.ai.apiKey}
                        onChange={event => updateAi('apiKey', event.target.value)}
                        placeholder="sk-..."
                    />
                </div>

                <footer className="modal-actions">
                    <button className="ghost-button" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="primary-button" onClick={() => onSave(localSettings)}>
                        Save Settings
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default SettingsDialog;
