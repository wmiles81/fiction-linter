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
});
