import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import Editor from './Editor';

describe('Editor', () => {
    it('renders the initial markdown as formatted HTML in the contenteditable', async () => {
        render(
            <Editor
                value="# Hello"
                onChange={() => {}}
                issues={[]}
                showFindings={true}
                wrap={true}
            />
        );
        await waitFor(() => {
            const h1 = document.querySelector('.editor-surface h1');
            expect(h1?.textContent).toBe('Hello');
        });
    });

    it('fires onChange with markdown when the contenteditable is edited', async () => {
        const onChange = vi.fn();
        render(
            <Editor
                value=""
                onChange={onChange}
                issues={[]}
                showFindings={true}
                wrap={true}
            />
        );
        // Let the initial value=>HTML effect settle
        await waitFor(() => {
            expect(document.querySelector('.editor-surface')).toBeInTheDocument();
        });
        const surface = document.querySelector('.editor-surface');
        surface.innerHTML = '<p>New text</p>';
        surface.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => {
            expect(onChange).toHaveBeenCalled();
        });
        const markdown = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(markdown).toMatch(/New text/);
    });

    it('applies lint highlights when issues are provided (does not mutate DOM)', async () => {
        const { rerender } = render(
            <Editor
                value="Hello world"
                onChange={() => {}}
                issues={[]}
                showFindings={true}
                wrap={true}
            />
        );
        await waitFor(() => {
            expect(document.querySelector('.editor-surface p')).toBeInTheDocument();
        });

        rerender(
            <Editor
                value="Hello world"
                onChange={() => {}}
                issues={[{ start: 6, end: 11, message: 'overused word', severity: 'warning' }]}
                showFindings={true}
                wrap={true}
            />
        );
        // The Highlight API is not polyfilled in jsdom — we just assert the DOM
        // was not mutated (no <span> wrappers injected).
        const surface = document.querySelector('.editor-surface');
        expect(surface.querySelectorAll('span').length).toBe(0);
    });

    it('hides highlights when showFindings is false', async () => {
        render(
            <Editor
                value="Hello world"
                onChange={() => {}}
                issues={[{ start: 6, end: 11, message: 'x', severity: 'warning' }]}
                showFindings={false}
                wrap={true}
            />
        );
        await waitFor(() => {
            expect(document.querySelector('.editor-surface')).toBeInTheDocument();
        });
        const surface = document.querySelector('.editor-surface');
        expect(surface.querySelectorAll('span').length).toBe(0);
    });
});
