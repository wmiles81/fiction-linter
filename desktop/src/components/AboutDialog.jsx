function AboutDialog({ onClose, licenseInfo, version }) {
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="about-card" onClick={e => e.stopPropagation()}>
                <h2 className="about-title">Fiction Linter Desktop</h2>
                <p className="about-version">v{version || '1.0.0'}</p>
                <p className="about-licensee">
                    {licenseInfo?.name
                        ? `Licensed to: ${licenseInfo.name}`
                        : 'Unlicensed'}
                </p>
                <p className="about-publisher">Ocotillo Quill Press LLC</p>
                <p className="about-copyright">Copyright 2025 Ocotillo Quill Press LLC. All rights reserved.</p>
                <button type="button" className="ghost-button" onClick={onClose}>Close</button>
            </div>
        </div>
    );
}

export default AboutDialog;
