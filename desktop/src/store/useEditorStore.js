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

export const useEditorStore = create((set, get) => ({
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
    }
}));
