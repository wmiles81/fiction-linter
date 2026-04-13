import React, { useEffect, useRef, useState } from 'react';
import { THEMES, useAppStore } from '../store/useAppStore';

// A small dropdown button in the top bar that lets users pick a theme.
// Shows the current theme name as the button label. Clicking opens a panel
// listing all themes with a small color swatch so users can preview the
// palette without committing.
function ThemePicker() {
    const theme = useAppStore(state => state.theme);
    const setTheme = useAppStore(state => state.setTheme);
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    const current = THEMES.find(t => t.id === theme) || THEMES[0];

    // Close on outside click. Attaching to window rather than document so
    // we don't conflict with React's synthetic event system.
    useEffect(() => {
        if (!open) return;
        const handler = (event) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target)) return;
            setOpen(false);
        };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [open]);

    // Also close on Escape for keyboard users.
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    const handlePick = (id) => {
        setTheme(id);
        setOpen(false);
    };

    return (
        <div className="theme-picker" ref={containerRef}>
            <button
                type="button"
                className="theme-picker-toggle"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Theme: ${current.label}. Click to change`}
                onClick={() => setOpen(v => !v)}
                title={`Theme: ${current.label}`}
            >
                <ThemeSwatch themeId={current.id} />
                <span className="theme-picker-label">{current.label}</span>
                <svg viewBox="0 0 12 12" aria-hidden="true" className="theme-picker-chevron">
                    <path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {open ? (
                <ul className="theme-picker-menu" role="listbox" aria-label="Theme">
                    {THEMES.map(t => {
                        const isSelected = t.id === theme;
                        return (
                            <li key={t.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`theme-picker-option ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handlePick(t.id)}
                                    data-theme-id={t.id}
                                >
                                    <ThemeSwatch themeId={t.id} />
                                    <span className="theme-picker-option-text">
                                        <span className="theme-picker-option-label">{t.label}</span>
                                        <span className="theme-picker-option-desc">{t.description}</span>
                                    </span>
                                    {isSelected ? (
                                        <svg viewBox="0 0 12 12" aria-hidden="true" className="theme-picker-check">
                                            <path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}

// A tiny two-tone swatch that previews a theme. Renders the theme's
// background-ish color on one half and its accent on the other so users
// can tell themes apart at a glance before clicking.
function ThemeSwatch({ themeId }) {
    // Hardcoded preview pairs — intentionally decoupled from the live CSS
    // variables so the swatch shows the THAT theme's colors regardless of
    // which theme is currently active on <html>.
    const preview = THEME_PREVIEW[themeId] || THEME_PREVIEW.parchment;
    return (
        <span
            className="theme-swatch"
            aria-hidden="true"
            style={{
                background: `linear-gradient(135deg, ${preview.bg} 0 50%, ${preview.accent} 50% 100%)`
            }}
        />
    );
}

const THEME_PREVIEW = {
    parchment:       { bg: '#f6f1eb', accent: '#d05b41' },
    midnight:        { bg: '#0f1419', accent: '#e8a252' },
    sepia:           { bg: '#f2e9d8', accent: '#8b2e2e' },
    'high-contrast': { bg: '#ffffff', accent: '#0052cc' }
};

export default ThemePicker;
