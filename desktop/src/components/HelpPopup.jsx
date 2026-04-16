import { useEffect, useRef, useState } from 'react';

function HelpPopup({ topic, position, onClose, onMore }) {
    const popupRef = useRef(null);
    const [flipped, setFlipped] = useState(false);

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

    // Flip below the anchor when the popup would clip the top of the
    // viewport. Measured after first render via the ref.
    useEffect(() => {
        if (!popupRef.current) return;
        const rect = popupRef.current.getBoundingClientRect();
        setFlipped(rect.top < 0);
    }, [position, topic]);

    if (!topic) return null;

    return (
        <div
            ref={popupRef}
            className={`help-popup ${flipped ? 'flipped' : ''}`}
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
