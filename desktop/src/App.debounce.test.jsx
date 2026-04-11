import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatternLinterCore } from '@shared/linting';
import App from './App';

describe('App — lint debounce', () => {
    let lintSpy;

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        lintSpy = vi.spyOn(PatternLinterCore.prototype, 'lintText');

        // Minimal fs stubs — any YAML returns empty, manuscript returns some text.
        window.api.chooseFolder = async () => '/tmp';
        window.api.listDirectory = async () => [
            { name: 'story.md', path: '/tmp/story.md', isDirectory: false }
        ];
        window.api.readFile = async filePath => {
            if (filePath === '/tmp/story.md') {
                return { ok: true, contents: 'Initial content.' };
            }
            return { ok: true, contents: '{}' };
        };
        window.api.getSettings = async () => ({
            spePath: '/fake/spe',
            ai: { provider: '', model: '', apiKey: '', baseUrl: '' }
        });
    });

    afterEach(() => {
        lintSpy.mockRestore();
        vi.useRealTimers();
    });

    it('coalesces a burst of content changes into one lintText call per debounce window', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        render(<App />);
        await act(async () => { await Promise.resolve(); });

        // No content loaded yet → no lint calls.
        expect(lintSpy).not.toHaveBeenCalled();

        // Open folder, then click the file to load its content.
        await user.click(screen.getByRole('button', { name: /Open Folder/i }));
        await act(async () => { await Promise.resolve(); });
        await user.click(await screen.findByText('story.md'));
        await act(async () => { await Promise.resolve(); });

        // Debounce pending — still no lint calls.
        expect(lintSpy).not.toHaveBeenCalled();

        // Advance past the debounce window → exactly one lint call.
        await act(async () => { vi.advanceTimersByTime(350); });
        expect(lintSpy).toHaveBeenCalledTimes(1);

        // Type rapidly into the textarea.
        const textarea = screen.getByRole('textbox');
        await act(async () => { await user.type(textarea, 'XYZ'); });

        // Advance less than the debounce window → still only 1 call.
        await act(async () => { vi.advanceTimersByTime(100); });
        expect(lintSpy).toHaveBeenCalledTimes(1);

        // Advance past the window → one more call (total = 2, not 4).
        await act(async () => { vi.advanceTimersByTime(300); });
        expect(lintSpy).toHaveBeenCalledTimes(2);
    });
});
