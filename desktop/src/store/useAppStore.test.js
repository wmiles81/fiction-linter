import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, THEMES } from './useAppStore';

describe('useAppStore', () => {
    beforeEach(() => {
        try { window.localStorage.removeItem('fl.theme'); } catch { /* ignore */ }
        document.documentElement.removeAttribute('data-theme');
        useAppStore.setState({
            settings: null,
            speData: { cliches: {}, names: {}, places: {}, protocols: {} },
            status: 'Ready',
            rootPath: '',
            tree: [],
            theme: 'parchment'
        });
    });

    it('initializes with Ready status and empty state', () => {
        const state = useAppStore.getState();
        expect(state.status).toBe('Ready');
        expect(state.settings).toBeNull();
        expect(state.rootPath).toBe('');
        expect(state.tree).toEqual([]);
    });

    it('setStatus updates the status field', () => {
        useAppStore.getState().setStatus('Loading...');
        expect(useAppStore.getState().status).toBe('Loading...');
    });

    it('setSettings replaces the settings object', () => {
        const settings = { spePath: '/foo', ai: { provider: 'openrouter' } };
        useAppStore.getState().setSettings(settings);
        expect(useAppStore.getState().settings).toEqual(settings);
    });

    it('setRootPath + setTree update together for folder-open flow', () => {
        useAppStore.getState().setRootPath('/tmp/project');
        useAppStore.getState().setTree([
            { name: 'story.md', path: '/tmp/project/story.md', isDirectory: false }
        ]);
        const state = useAppStore.getState();
        expect(state.rootPath).toBe('/tmp/project');
        expect(state.tree).toHaveLength(1);
    });
});

describe('useAppStore — theme', () => {
    beforeEach(() => {
        try { window.localStorage.removeItem('fl.theme'); } catch { /* ignore */ }
        document.documentElement.removeAttribute('data-theme');
        useAppStore.setState({ theme: 'parchment' });
    });

    it('exposes the expected four themes in the listed order', () => {
        expect(THEMES.map(t => t.id)).toEqual([
            'parchment',
            'midnight',
            'sepia',
            'high-contrast'
        ]);
    });

    it('setTheme updates state, document attribute, and localStorage', () => {
        useAppStore.getState().setTheme('midnight');
        expect(useAppStore.getState().theme).toBe('midnight');
        expect(document.documentElement.getAttribute('data-theme')).toBe('midnight');
        expect(window.localStorage.getItem('fl.theme')).toBe('midnight');
    });

    it('setTheme silently ignores unknown theme ids', () => {
        // Guard against future typos or bogus persisted values. Store stays
        // on parchment, DOM attribute stays unset.
        useAppStore.getState().setTheme('neon-punk-cat');
        expect(useAppStore.getState().theme).toBe('parchment');
        expect(document.documentElement.getAttribute('data-theme')).toBe(null);
    });

    it('hydrateTheme paints the current theme onto <html>', () => {
        useAppStore.setState({ theme: 'sepia' });
        useAppStore.getState().hydrateTheme();
        expect(document.documentElement.getAttribute('data-theme')).toBe('sepia');
    });
});
