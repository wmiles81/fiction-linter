import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';

// The plan's test file used `vi.mock('electron', ...)` + CJS require to stub
// out Electron before importing the helper. Vitest 4.x disallows `require()`
// of its API from CJS, and the existing project tests (aiClient.test.js) use
// ESM imports. `spePath.js` already supports dependency injection via its
// `{ app, resourcesPath }` parameter, so we skip the `vi.mock('electron')`
// dance entirely and pass the mock app object directly. This keeps the test
// hermetic without touching Electron's module cache.

import { getDefaultSpePath } from './spePath.js';

const mockApp = {
    isPackaged: false,
    getAppPath: () => '/fake/project/desktop'
};

describe('getDefaultSpePath', () => {
    beforeEach(() => {
        mockApp.isPackaged = false;
        mockApp.getAppPath = () => '/fake/project/desktop';
    });

    it('resolves to ../resources/spe_defaults in dev mode', () => {
        mockApp.isPackaged = false;
        mockApp.getAppPath = () => '/fake/project/desktop';
        const result = getDefaultSpePath({ app: mockApp, resourcesPath: '/irrelevant' });
        expect(result).toBe(path.resolve('/fake/project/desktop', '..', 'resources', 'spe_defaults'));
    });

    it('resolves to process.resourcesPath/spe_defaults when packaged', () => {
        mockApp.isPackaged = true;
        const result = getDefaultSpePath({
            app: mockApp,
            resourcesPath: '/Applications/Fiction Linter.app/Contents/Resources'
        });
        expect(result).toBe('/Applications/Fiction Linter.app/Contents/Resources/spe_defaults');
    });
});
