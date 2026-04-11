import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
});

// Stub window.api so components that call it in useEffect don't crash in tests.
// Individual tests can override specific methods via vi.spyOn.
if (typeof window !== 'undefined' && !window.api) {
    window.api = {
        chooseFolder: async () => null,
        listDirectory: async () => [],
        readFile: async () => ({ ok: false, error: 'stub' }),
        writeFile: async () => ({ ok: true }),
        getSettings: async () => ({
            spePath: '',
            ai: { provider: 'openrouter', model: '', apiKey: '', baseUrl: '' }
        }),
        saveSettings: async settings => settings,
        loadSpeData: async () => ({ cliches: {}, names: {}, places: {}, protocols: {} }),
        aiComplete: async () => ({ ok: false, error: 'stub' }),
        fetchModels: async () => ({ ok: true, models: [] }),
        loadTabs: async () => ({ tabs: [], activeTabId: null }),
        saveTabs: async state => state,
        onMenuAction: (_cb) => () => {}
    };
}
