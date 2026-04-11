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

function persistNow(state) {
    if (typeof window === 'undefined' || !window.api?.saveTabs) return;
    // Save a trimmed version: only the fields we want to persist.
    const payload = {
        tabs: state.tabs.map(t => ({
            id: t.id,
            path: t.path,
            name: t.name,
            markdownSource: t.markdownSource,
            dirty: t.dirty
        })),
        activeTabId: state.activeTabId
    };
    window.api.saveTabs(payload).catch(() => { /* best effort */ });
}

// Zustand middleware: wraps `set` so every mutation writes to userData/tabs.json.
// The raw `set` from Zustand is replaced with a wrapper that calls persistNow
// with the post-mutation state — obtained via `get()` which always reads live.
const withPersist = (config) => (set, get, api) => {
    const wrappedSet = (partial, replace) => {
        set(partial, replace);
        persistNow(get());
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
            }));
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
        }));
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
        }));
        return newTab.id;
    },

    setActiveTab: (id) => set({ activeTabId: id }),

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
        set({ tabs: newTabs, activeTabId: newActive });
    },

    closeAllTabs: () => set({ tabs: [], activeTabId: null }),

    getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find(t => t.id === activeTabId) ?? null;
    },

    hydrate: async () => {
        if (typeof window === 'undefined' || !window.api?.loadTabs) return;
        try {
            const persisted = await window.api.loadTabs();
            if (persisted?.tabs?.length) {
                // Re-read files from disk to get current content — the persisted
                // markdownSource may be stale if the user edited the file externally.
                const rehydrated = [];
                for (const t of persisted.tabs) {
                    if (!t.path) {
                        rehydrated.push(t);
                        continue;
                    }
                    const r = await window.api.readFile(t.path);
                    if (r.ok) {
                        rehydrated.push({ ...t, markdownSource: r.contents, dirty: false });
                    }
                }
                // Use raw setState (not wrapped) to avoid persisting a rehydration
                // as a new write.
                useEditorStore.setState({
                    tabs: rehydrated,
                    activeTabId: rehydrated.some(t => t.id === persisted.activeTabId)
                        ? persisted.activeTabId
                        : (rehydrated[0]?.id ?? null)
                });
            }
        } catch (err) {
            console.error('Tab hydration failed:', err);
        }
    }
})));
