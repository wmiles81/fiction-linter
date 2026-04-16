function WelcomeScreen({ onOpenFolder }) {
    return (
        <div className="welcome-screen">
            <h2>Welcome to Fiction Linter</h2>
            <p>Open a folder to start exploring your manuscript.</p>
            <ul className="welcome-features">
                <li>Deterministic pattern linting for cliches, weak phrasing, and AI tells</li>
                <li>AI-powered scan for show-vs-tell and emotional telling</li>
                <li>Fix now or fix later with annotation logging</li>
                <li>Import .docx and .gdoc files directly</li>
            </ul>
            <button type="button" className="primary-button" onClick={onOpenFolder}>
                Open Folder
            </button>
        </div>
    );
}

export default WelcomeScreen;
