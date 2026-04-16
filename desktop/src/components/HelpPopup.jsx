import { useEffect } from 'react';

function HelpPopup({ topic, position, onClose, onMore }) {
    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Close on click outside
    useEffect(() => {
        const handler = (e) => {
            if (!e.target.closest('.help-popup')) onClose();
        };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [onClose]);

    if (!topic) return null;

    return (
        <div
            className="help-popup"
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            <div className="help-popup-title">{topic.title}</div>
            <div className="help-popup-summary">{topic.summary}</div>
            <button
                type="button"
                className="help-popup-more"
                onClick={() => onMore(topic.id)}
            >
                More... {'\u203A'}
            </button>
        </div>
    );
}

export default HelpPopup;
