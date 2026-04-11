import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

describe('useAppStore', () => {
    beforeEach(() => {
        useAppStore.setState({
            settings: null,
            speData: { cliches: {}, names: {}, places: {}, protocols: {} },
            status: 'Ready',
            rootPath: '',
            tree: []
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
