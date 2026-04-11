import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import Editor, { findingAtOffset } from './Editor';

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

describe('findingAtOffset', () => {
    const issues = [
        { start: 0, end: 5, message: 'first', severity: 'error' },
        { start: 10, end: 18, message: 'second', severity: 'warning' },
        { start: 25, end: 32, message: 'third', severity: 'info' }
    ];

    it('returns null for empty/missing issues', () => {
        expect(findingAtOffset(null, 5)).toBeNull();
        expect(findingAtOffset(undefined, 5)).toBeNull();
        expect(findingAtOffset([], 5)).toBeNull();
    });

    it('returns the finding whose range contains the offset', () => {
        expect(findingAtOffset(issues, 3)).toBe(issues[0]);
        expect(findingAtOffset(issues, 14)).toBe(issues[1]);
        expect(findingAtOffset(issues, 28)).toBe(issues[2]);
    });

    it('returns null for offsets in the gaps between findings', () => {
        expect(findingAtOffset(issues, 7)).toBeNull();
        expect(findingAtOffset(issues, 22)).toBeNull();
        expect(findingAtOffset(issues, 100)).toBeNull();
    });

    it('treats range boundaries as inclusive (start and end both match)', () => {
        expect(findingAtOffset(issues, 0)).toBe(issues[0]);
        expect(findingAtOffset(issues, 5)).toBe(issues[0]);
        expect(findingAtOffset(issues, 18)).toBe(issues[1]);
    });

    it('returns the first matching finding when ranges overlap', () => {
        const overlapping = [
            { start: 0, end: 20, message: 'outer' },
            { start: 5, end: 15, message: 'inner' }
        ];
        // First-match-wins is the documented behavior — caller orders findings
        // by severity or specificity if they want a different policy.
        expect(findingAtOffset(overlapping, 10)?.message).toBe('outer');
    });
});

describe('Editor — hover tooltip', () => {
    it('does not render a tooltip when no finding is under the cursor', async () => {
        render(
            <Editor
                value="Hello world"
                onChange={() => {}}
                issues={[{ start: 6, end: 11, message: 'overused', severity: 'warning' }]}
                showFindings={true}
                wrap={true}
            />
        );
        await waitFor(() => {
            expect(document.querySelector('.editor-surface')).toBeInTheDocument();
        });
        // No mousemove fired yet → no tooltip in the DOM.
        expect(document.querySelector('.lint-tooltip')).toBeNull();
    });

    it('does not render a tooltip when showFindings is false (silent mode)', async () => {
        render(
            <Editor
                value="Hello world"
                onChange={() => {}}
                issues={[{ start: 6, end: 11, message: 'overused', severity: 'warning' }]}
                showFindings={false}
                wrap={true}
            />
        );
        await waitFor(() => {
            expect(document.querySelector('.editor-surface')).toBeInTheDocument();
        });
        // Even with issues present, silent mode should never produce a tooltip.
        expect(document.querySelector('.lint-tooltip')).toBeNull();
    });
});
