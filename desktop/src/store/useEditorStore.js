import { create } from 'zustand';

let _idCounter = 0;
const makeId = () => `tab-${++_idCounter}-${Date.now()}`;

function pickNewActive(tabs, closingId, currentActiveId) {
    if (currentActiveId !== closingId) return currentActiveId;
    const idx = tabs.findIndex(t => t.id === closingId);
    if (idx === -1) return null;
    // Prefer the previous tab, fall back to the next.
    if (idx > 0) return tabs[idx - 1].id;
    if (tabs.length > 1) return tabs[idx + 1].id;
    return null;
}

// Persistence strategy:
//   - Structural changes (open, close, switch active) → IMMEDIATE write, no
//     debounce. Quick Cmd+Q after opening a tab should still restore that
//     tab on next launch.
//   - Content edits (per-keystroke updateContent) → debounced 400ms, because
//     a write per keystroke is wasteful and noisy.
//   - window beforeunload → flush any pending debounced write.
//
// Each mutation action in the store decides which path to use by passing
// `{ immediate: true }` to the internal schedulePersist helper.
let _persistTimeout = null;
function buildPersistPayload(state) {
    return {
        tabs: state.tabs.map(t => ({
            id: t.id,
            path: t.path,
            name: t.name,
            markdownSource: t.markdownSource,
            dirty: t.dirty
        })),
        activeTabId: state.activeTabId
    };
}
function writeToDisk(state) {
    if (typeof window === 'undefined' || !window.api?.saveTabs) return;
    const payload = buildPersistPayload(state);
    window.api.saveTabs(payload).catch(() => { /* best effort */ });
}
function persistNow(state, { immediate = false } = {}) {
    if (typeof window === 'undefined' || !window.api?.saveTabs) return;
    if (_persistTimeout) {
        clearTimeout(_persistTimeout);
        _persistTimeout = null;
    }
    if (immediate) {
        writeToDisk(state);
        return;
    }
    _persistTimeout = setTimeout(() => {
        _persistTimeout = null;
        writeToDisk(state);
    }, 400);
}
// Synchronous flush: cancels any pending debounce and writes the latest
// state immediately. Used by App.jsx on `beforeunload` so dirty untitled
// tabs do not lose their final 0-400ms of typing if the user quits during
// the debounce window. (Persisted-with-path tabs are safe because hydrate
// re-reads from disk on relaunch.)
function flushPersist() {
    if (_persistTimeout) {
        clearTimeout(_persistTimeout);
        _persistTimeout = null;
    }
    if (typeof window === 'undefined' || !window.api?.saveTabs) return;
    const state = useEditorStore.getState();
    const payload = buildPersistPayload(state);
    try {
        return window.api.saveTabs(payload);
    } catch {
        /* best effort */
    }
}

// Zustand middleware: wraps `set` so every mutation writes to userData/tabs.json.
// Actions can pass a third argument `{ immediate: true }` to skip the
// 400ms debounce — used for structural changes (open, close, switch active
// tab) where a quick quit should still persist the change.
const withPersist = (config) => (set, get, api) => {
    const wrappedSet = (partial, replace, persistOpts) => {
        set(partial, replace);
        persistNow(get(), persistOpts);
    };
    return config(wrappedSet, get, api);
};

export const useEditorStore = create(withPersist((set, get) => ({
    tabs: [],
    activeTabId: null,

    openFile: ({ path, name, markdownSource }) => {
        const existing = get().tabs.find(t => t.path === path);
        if (existing) {
            // Replace content on re-open so a fresh readFile propagates to the
            // editor. Matches the Phase 0-6 handleSelectFile behavior the
            // debounce test relies on (reload same path -> new content).
            set(state => ({
                tabs: state.tabs.map(t =>
                    t.id === existing.id
                        ? { ...t, markdownSource, name, dirty: false }
                        : t
                ),
                activeTabId: existing.id
            }), false, { immediate: true });
            return existing.id;
        }
        const newTab = {
            id: makeId(),
            path,
            name,
            markdownSource,
            dirty: false
        };
        set(state => ({
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id
        }), false, { immediate: true });
        return newTab.id;
    },

    newEmptyTab: () => {
        const untitledCount = get().tabs.filter(t => !t.path).length;
        const newTab = {
            id: makeId(),
            path: null,
            name: `Untitled${untitledCount ? ` ${untitledCount + 1}` : ''}.md`,
            markdownSource: '',
            dirty: true
        };
        set(state => ({
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id
        }), false, { immediate: true });
        return newTab.id;
    },

    setActiveTab: (id) => set({ activeTabId: id }, false, { immediate: true }),

    updateContent: (markdownSource) => {
        const activeId = get().activeTabId;
        if (!activeId) return;
        set(state => ({
            tabs: state.tabs.map(t =>
                t.id === activeId
                    ? { ...t, markdownSource, dirty: true }
                    : t
            )
        }));
    },

    markSaved: (newPath, newName) => {
        const activeId = get().activeTabId;
        if (!activeId) return;
        set(state => ({
            tabs: state.tabs.map(t =>
                t.id === activeId
                    ? {
                        ...t,
                        dirty: false,
                        path: newPath ?? t.path,
                        name: newName ?? t.name
                    }
                    : t
            )
        }));
    },

    closeTab: (id) => {
        const { tabs, activeTabId } = get();
        const newActive = pickNewActive(tabs, id, activeTabId);
        const newTabs = tabs.filter(t => t.id !== id);
        set({ tabs: newTabs, activeTabId: newActive }, false, { immediate: true });
    },

    closeAllTabs: () => set({ tabs: [], activeTabId: null }, false, { immediate: true }),

    getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find(t => t.id === activeTabId) ?? null;
    },

    flushPersist,

    hydrate: async () => {
        if (typeof window === 'undefined' || !window.api?.loadTabs) return;
        try {
            const persisted = await window.api.loadTabs();
            if (!persisted?.tabs?.length) return;

            // Three rehydration paths:
            //   1. No path (untitled draft) → keep persisted content, dirty.
            //   2. Path + file exists → re-read fresh content, clean tab.
            //   3. Path + file missing (deleted, moved, or a synthetic
            //      sibling .md from a gdoc/docx import that was never
            //      saved) → keep persisted content, mark dirty so the
            //      user knows Save will create the file.
            const rehydrated = [];
            const drops = [];
            for (const t of persisted.tabs) {
                if (!t.path) {
                    rehydrated.push(t);
                    continue;
                }
                const r = await window.api.readFile(t.path);
                if (r.ok) {
                    rehydrated.push({ ...t, markdownSource: r.contents, dirty: false });
                } else if (typeof t.markdownSource === 'string' && t.markdownSource.length > 0) {
                    // File is missing but we have content from last session.
                    // Keep the tab and its intended path — Save will create
                    // the file. This is the .gdoc/.docx import recovery path.
                    rehydrated.push({ ...t, dirty: true });
                } else {
                    // Truly nothing to restore — drop the tab and tell the
                    // user (via console). Keeping it with empty content
                    // would be more confusing than dropping it.
                    drops.push(t.path);
                }
            }
            if (drops.length > 0) {
                // eslint-disable-next-line no-console
                console.warn('[tabs] dropped on hydrate (missing file, no cached content):', drops);
            }

            // Use raw setState (not wrapped) to avoid persisting a rehydration
            // as a new write.
            useEditorStore.setState({
                tabs: rehydrated,
                activeTabId: rehydrated.some(t => t.id === persisted.activeTabId)
                    ? persisted.activeTabId
                    : (rehydrated[0]?.id ?? null)
            });
        } catch (err) {
            console.error('Tab hydration failed:', err);
        }
    }
})));
