import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './useEditorStore';

function resetStore() {
    useEditorStore.setState({ tabs: [], activeTabId: null });
}

describe('useEditorStore', () => {
    beforeEach(() => resetStore());

    it('opens a file as a new tab and makes it active', () => {
        const { openFile } = useEditorStore.getState();
        openFile({ path: '/tmp/story.md', name: 'story.md', markdownSource: '# Hello' });
        const { tabs, activeTabId } = useEditorStore.getState();
        expect(tabs).toHaveLength(1);
        expect(tabs[0].path).toBe('/tmp/story.md');
        expect(tabs[0].markdownSource).toBe('# Hello');
        expect(tabs[0].dirty).toBe(false);
        expect(activeTabId).toBe(tabs[0].id);
    });

    it('opening an already-open file switches to the existing tab, not a new one', () => {
        const { openFile } = useEditorStore.getState();
        openFile({ path: '/tmp/a.md', name: 'a.md', markdownSource: 'A' });
        openFile({ path: '/tmp/b.md', name: 'b.md', markdownSource: 'B' });
        openFile({ path: '/tmp/a.md', name: 'a.md', markdownSource: 'A' });
        const { tabs, activeTabId } = useEditorStore.getState();
        expect(tabs).toHaveLength(2);
        expect(activeTabId).toBe(tabs[0].id);
    });

    it('newEmptyTab creates an untitled tab marked dirty', () => {
        const { newEmptyTab } = useEditorStore.getState();
        newEmptyTab();
        const { tabs, activeTabId } = useEditorStore.getState();
        expect(tabs).toHaveLength(1);
        expect(tabs[0].name).toMatch(/untitled/i);
        expect(tabs[0].path).toBeNull();
        expect(tabs[0].dirty).toBe(true);
        expect(activeTabId).toBe(tabs[0].id);
    });

    it('updateContent marks the active tab dirty and stores the new markdown', () => {
        const { openFile, updateContent } = useEditorStore.getState();
        openFile({ path: '/tmp/a.md', name: 'a.md', markdownSource: 'old' });
        updateContent('new');
        const tab = useEditorStore.getState().tabs[0];
        expect(tab.markdownSource).toBe('new');
        expect(tab.dirty).toBe(true);
    });

    it('markSaved clears the dirty flag on the active tab', () => {
        const { openFile, updateContent, markSaved } = useEditorStore.getState();
        openFile({ path: '/tmp/a.md', name: 'a.md', markdownSource: 'x' });
        updateContent('y');
        markSaved();
        expect(useEditorStore.getState().tabs[0].dirty).toBe(false);
    });

    it('closeTab removes the tab and picks a neighbor as active', () => {
        const { openFile, closeTab } = useEditorStore.getState();
        openFile({ path: '/a', name: 'a', markdownSource: '' });
        openFile({ path: '/b', name: 'b', markdownSource: '' });
        openFile({ path: '/c', name: 'c', markdownSource: '' });
        const bId = useEditorStore.getState().tabs[1].id;
        closeTab(bId);
        const { tabs, activeTabId } = useEditorStore.getState();
        expect(tabs).toHaveLength(2);
        expect(tabs.find(t => t.id === bId)).toBeUndefined();
        // Active tab remains 'c' because it was active before b was closed.
        expect(activeTabId).toBe(tabs[1].id);
    });

    it('closing the active tab picks the previous tab as new active', () => {
        const { openFile, closeTab, setActiveTab } = useEditorStore.getState();
        openFile({ path: '/a', name: 'a', markdownSource: '' });
        openFile({ path: '/b', name: 'b', markdownSource: '' });
        openFile({ path: '/c', name: 'c', markdownSource: '' });
        const bId = useEditorStore.getState().tabs[1].id;
        setActiveTab(bId);
        closeTab(bId);
        const { tabs, activeTabId } = useEditorStore.getState();
        expect(activeTabId).toBe(tabs[0].id); // 'a' — the one before 'b'
    });

    it('closeAllTabs empties the store', () => {
        const { openFile, closeAllTabs } = useEditorStore.getState();
        openFile({ path: '/a', name: 'a', markdownSource: '' });
        openFile({ path: '/b', name: 'b', markdownSource: '' });
        closeAllTabs();
        const { tabs, activeTabId } = useEditorStore.getState();
        expect(tabs).toEqual([]);
        expect(activeTabId).toBeNull();
    });

    it('hydrate populates tabs from window.api.loadTabs and re-reads file contents', async () => {
        const fakePersisted = {
            tabs: [
                { id: 'tab-1', path: '/tmp/a.md', name: 'a.md', markdownSource: 'stale', dirty: true }
            ],
            activeTabId: 'tab-1'
        };
        const originalLoadTabs = window.api.loadTabs;
        const originalReadFile = window.api.readFile;
        window.api.loadTabs = async () => fakePersisted;
        window.api.readFile = async () => ({ ok: true, contents: 'fresh content from disk' });

        try {
            await useEditorStore.getState().hydrate();
            const state = useEditorStore.getState();
            expect(state.tabs).toHaveLength(1);
            expect(state.tabs[0].markdownSource).toBe('fresh content from disk');
            expect(state.tabs[0].dirty).toBe(false);
            expect(state.activeTabId).toBe('tab-1');
        } finally {
            window.api.loadTabs = originalLoadTabs;
            window.api.readFile = originalReadFile;
        }
    });

    it('hydrate keeps persisted content when the file is missing (gdoc/docx import recovery)', async () => {
        // Simulates the scenario: user imported a .gdoc, which opened a tab
        // with a synthetic sibling .md path that has never been saved. On
        // restart, readFile for that path fails, but we have the original
        // imported content in the persist file. The tab should come back
        // marked dirty so the user knows Save is needed.
        const fakePersisted = {
            tabs: [
                {
                    id: 'tab-import',
                    path: '/tmp/imported.md',
                    name: 'imported.md',
                    markdownSource: 'Full imported doc content.',
                    dirty: false
                }
            ],
            activeTabId: 'tab-import'
        };
        const originalLoadTabs = window.api.loadTabs;
        const originalReadFile = window.api.readFile;
        window.api.loadTabs = async () => fakePersisted;
        window.api.readFile = async () => ({ ok: false, error: 'File not found.' });
        try {
            await useEditorStore.getState().hydrate();
            const state = useEditorStore.getState();
            expect(state.tabs).toHaveLength(1);
            expect(state.tabs[0].markdownSource).toBe('Full imported doc content.');
            expect(state.tabs[0].dirty).toBe(true);
            expect(state.tabs[0].path).toBe('/tmp/imported.md');
            expect(state.activeTabId).toBe('tab-import');
        } finally {
            window.api.loadTabs = originalLoadTabs;
            window.api.readFile = originalReadFile;
        }
    });

    it('hydrate drops tabs when the file is missing AND no cached content exists', async () => {
        const fakePersisted = {
            tabs: [
                { id: 'gone', path: '/tmp/deleted.md', name: 'deleted.md', markdownSource: '', dirty: false }
            ],
            activeTabId: 'gone'
        };
        const originalLoadTabs = window.api.loadTabs;
        const originalReadFile = window.api.readFile;
        window.api.loadTabs = async () => fakePersisted;
        window.api.readFile = async () => ({ ok: false, error: 'File not found.' });
        try {
            await useEditorStore.getState().hydrate();
            expect(useEditorStore.getState().tabs).toEqual([]);
        } finally {
            window.api.loadTabs = originalLoadTabs;
            window.api.readFile = originalReadFile;
        }
    });
});
