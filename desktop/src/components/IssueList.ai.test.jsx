import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IssueList from './IssueList';

const sampleIssue = {
    start: 10,
    end: 18,
    message: 'Somatic Cliche: "released a breath". Penalty: 3.',
    severity: 'warning',
    line: 2,
    column: 4
};

describe('IssueList — AI actions', () => {
    beforeEach(() => {
        window.api.aiComplete = vi.fn();
    });

    it('calls aiComplete with kind=explain when Explain is clicked', async () => {
        window.api.aiComplete.mockResolvedValue({ ok: true, content: 'Because it is tired.' });
        const user = userEvent.setup();

        render(
            <IssueList
                issues={[sampleIssue]}
                onJump={() => {}}
                getSnippet={() => 'He released a breath he had been holding.'}
            />
        );

        await user.click(screen.getByRole('button', { name: /Explain/i }));

        expect(window.api.aiComplete).toHaveBeenCalledWith({
            kind: 'explain',
            finding: sampleIssue,
            snippet: 'He released a breath he had been holding.'
        });
        expect(await screen.findByText(/Because it is tired/)).toBeInTheDocument();
    });

    it('shows a loading state then the rewrite content', async () => {
        let resolveFn;
        window.api.aiComplete.mockImplementation(
            () => new Promise(r => { resolveFn = r; })
        );
        const user = userEvent.setup();

        render(
            <IssueList
                issues={[sampleIssue]}
                onJump={() => {}}
                getSnippet={() => 'Snippet.'}
            />
        );

        await user.click(screen.getByRole('button', { name: /Suggest rewrite/i }));
        expect(screen.getByText(/Thinking/i)).toBeInTheDocument();

        resolveFn({ ok: true, content: '1. Alpha\n2. Bravo\n3. Charlie' });
        expect(await screen.findByText(/Alpha/)).toBeInTheDocument();
    });

    it('displays an error when aiComplete fails', async () => {
        window.api.aiComplete.mockResolvedValue({ ok: false, error: '401 unauthorized' });
        const user = userEvent.setup();

        render(
            <IssueList
                issues={[sampleIssue]}
                onJump={() => {}}
                getSnippet={() => 'Snippet.'}
            />
        );

        await user.click(screen.getByRole('button', { name: /Explain/i }));
        expect(await screen.findByText(/401 unauthorized/)).toBeInTheDocument();
    });
});
