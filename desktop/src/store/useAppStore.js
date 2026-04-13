import { create } from 'zustand';

const emptySpeData = { cliches: {}, names: {}, places: {}, protocols: {} };

// Themes the user can pick. Order here is the order they appear in the
// picker dropdown. Adding a theme: add the CSS block in styles.css AND
// add an entry here — no other code changes needed.
export const THEMES = [
    { id: 'parchment', label: 'Parchment', description: 'Warm writerly default' },
    { id: 'midnight', label: 'Midnight', description: 'Dark, for late sessions' },
    { id: 'sepia', label: 'Sepia', description: 'Aged-book tan and burgundy' },
    { id: 'high-contrast', label: 'High Contrast', description: 'Maximum legibility' }
];

const THEME_STORAGE_KEY = 'fl.theme';
const DEFAULT_THEME = 'parchment';

function readStoredTheme() {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored && THEMES.some(t => t.id === stored)) return stored;
    } catch { /* private mode — fall through */ }
    return DEFAULT_THEME;
}

// Apply the theme by setting the data-theme attribute on <html>. CSS
// selectors in styles.css match on this attribute to activate the palette.
function applyThemeToDocument(themeId) {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', themeId);
}

export const useAppStore = create((set, get) => ({
    settings: null,
    speData: emptySpeData,
    status: 'Ready',
    rootPath: '',
    tree: [],
    theme: readStoredTheme(),

    setSettings: (settings) => set({ settings }),
    setSpeData: (speData) => set({ speData: speData || emptySpeData }),
    setStatus: (status) => set({ status }),
    setRootPath: (rootPath) => set({ rootPath }),
    setTree: (tree) => set({ tree }),

    setTheme: (themeId) => {
        if (!THEMES.some(t => t.id === themeId)) return;
        applyThemeToDocument(themeId);
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
        } catch { /* non-fatal */ }
        set({ theme: themeId });
    },

    // Called once on mount to paint the document with the persisted theme
    // before the user sees a flash of the default styling.
    hydrateTheme: () => {
        applyThemeToDocument(get().theme);
    },

    updateNode: (nodePath, updater) => {
        const walk = (nodes) => nodes.map(node => {
            if (node.path === nodePath) return updater(node);
            if (node.children) return { ...node, children: walk(node.children) };
            return node;
        });
        set({ tree: walk(get().tree) });
    }
}));
