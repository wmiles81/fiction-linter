import { useState } from 'react';

function LicenseDialog({ onActivated }) {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleActivate = async () => {
        const trimmed = key.trim();
        if (!trimmed || loading) return;
        setLoading(true);
        setError('');
        try {
            const result = await window.api.validateLicense(trimmed);
            if (result.valid) {
                onActivated({ email: result.email, name: result.name });
            } else {
                setError(result.error || 'Key not recognized.');
            }
        } catch (err) {
            setError(err.message || 'Key not recognized.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleActivate();
        }
    };

    const handleBuy = () => {
        window.api.openExternal('https://ocotilloquillpress.lemonsqueezy.com/buy/fiction-linter');
    };

    return (
        <div className="license-backdrop">
            <div className="license-card">
                <h1 className="license-title">Fiction Linter</h1>
                <p className="license-subtitle">Desktop Studio</p>
                <p className="license-publisher">Ocotillo Quill Press LLC</p>

                <div className="license-form">
                    <label htmlFor="license-key">License Key</label>
                    <input
                        id="license-key"
                        type="text"
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    {error && <p className="license-error">{error}</p>}
                </div>

                <div className="license-actions">
                    <button
                        className="primary-button"
                        onClick={handleActivate}
                        disabled={loading || key.trim() === ''}
                    >
                        {loading ? 'Validating...' : 'Activate'}
                    </button>
                    <button className="ghost-button" onClick={handleBuy}>
                        Buy a License
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LicenseDialog;
