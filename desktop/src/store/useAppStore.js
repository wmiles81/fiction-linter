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
const LINE_NUMBERS_STORAGE_KEY = 'fl.showLineNumbers';

// Editor font-size bounds. Default 16px matches the prose default; steps
// of 2 feel like "one notch" to the user, smaller steps feel finicky.
// 12-28 covers "too-small-to-draft-comfortably" to "almost presentation
// mode" — if someone needs larger, OS-level zoom handles it.
export const FONT_SIZE_STEP = 2;
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 16;
const FONT_SIZE_STORAGE_KEY = 'fl.editorFontSize';

function readStoredTheme() {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored && THEMES.some(t => t.id === stored)) return stored;
    } catch { /* private mode — fall through */ }
    return DEFAULT_THEME;
}

function readStoredLineNumbers() {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(LINE_NUMBERS_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

function readStoredFontSize() {
    if (typeof window === 'undefined') return DEFAULT_FONT_SIZE;
    try {
        const stored = parseInt(window.localStorage.getItem(FONT_SIZE_STORAGE_KEY), 10);
        if (Number.isFinite(stored) && stored >= MIN_FONT_SIZE && stored <= MAX_FONT_SIZE) {
            return stored;
        }
    } catch { /* private mode — fall through */ }
    return DEFAULT_FONT_SIZE;
}

// Apply the font size by setting --editor-font-size on :root. Both the
// editor surface and the line-number gutter read this var — the surface
// for its prose font-size, the gutter for its line-height (via calc()).
// Paragraph line-height stays at 1.2 so the gutter's line-height formula
// (fontSize * 1.2) keeps the numbers aligned with their paragraphs at
// any size.
function applyFontSizeToDocument(size) {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
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
    showLineNumbers: readStoredLineNumbers(),
    editorFontSize: readStoredFontSize(),

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

    setShowLineNumbers: (value) => {
        const next = !!value;
        try {
            window.localStorage.setItem(LINE_NUMBERS_STORAGE_KEY, next ? 'true' : 'false');
        } catch { /* non-fatal */ }
        set({ showLineNumbers: next });
    },

    // Clamped font-size setter + persist + apply to document. Callers can
    // pass raw increments (e.g., current + FONT_SIZE_STEP) without worrying
    // about bounds — anything outside MIN/MAX is rejected silently so the
    // button can be clicked at the limit without crashing.
    setEditorFontSize: (size) => {
        const n = Number(size);
        if (!Number.isFinite(n)) return;
        const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(n)));
        applyFontSizeToDocument(clamped);
        try {
            window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(clamped));
        } catch { /* non-fatal */ }
        set({ editorFontSize: clamped });
    },

    hydrateFontSize: () => {
        applyFontSizeToDocument(get().editorFontSize);
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
