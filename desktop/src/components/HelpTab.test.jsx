import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpTab from './HelpTab';

// markdownToHtml is async — stub it to return a predictable HTML string
vi.mock('./editor/converters', () => ({
    markdownToHtml: async (body) => `<div data-testid="rendered">${body}</div>`,
}));

const sampleTopics = [
    { id: 'gs-open', title: 'Opening', category: 'Getting Started', order: 1, summary: 'Open files.', keywords: ['open'], body: '## Opening\n\nOpen your files.' },
    { id: 'gs-scan', title: 'First Scan', category: 'Getting Started', order: 2, summary: 'Run a scan.', keywords: ['scan'], body: '## First Scan\n\nRun your first scan.' },
    { id: 'tb-ai', title: 'AI Scan', category: 'Toolbar', order: 1, summary: 'AI scanning.', keywords: ['ai'], body: '## AI Scan\n\nClick AI Scan.' }
];

describe('HelpTab', () => {
    it('renders navigation tree with categories and topic names', () => {
        render(<HelpTab topics={sampleTopics} initialTopicId={null} />);

        // Both category headers should be present
        expect(screen.getByText('Getting Started')).toBeInTheDocument();
        expect(screen.getByText('Toolbar')).toBeInTheDocument();

        // All topic names should be visible (categories expanded by default)
        expect(screen.getByText('Opening')).toBeInTheDocument();
        expect(screen.getByText('First Scan')).toBeInTheDocument();
        expect(screen.getByText('AI Scan')).toBeInTheDocument();
    });

    it('renders topic content when a topic is clicked', async () => {
        const user = userEvent.setup();
        render(<HelpTab topics={sampleTopics} initialTopicId={null} />);

        // Initially shows the empty state
        expect(screen.getByText(/Select a topic/i)).toBeInTheDocument();

        // Click the "Opening" topic
        await user.click(screen.getByText('Opening'));

        // Content should render with the body markdown
        await waitFor(() => {
            expect(screen.getByTestId('rendered')).toBeInTheDocument();
        });
        expect(screen.getByTestId('rendered').textContent).toContain('Opening');
    });

    it('renders the initial topic when initialTopicId is set', async () => {
        render(<HelpTab topics={sampleTopics} initialTopicId="tb-ai" />);

        // The AI Scan topic should be selected and its content rendered
        await waitFor(() => {
            expect(screen.getByTestId('rendered')).toBeInTheDocument();
        });
        expect(screen.getByTestId('rendered').textContent).toContain('AI Scan');
    });

    it('filters topics when search text is entered', async () => {
        const user = userEvent.setup();
        render(<HelpTab topics={sampleTopics} initialTopicId={null} />);

        const searchInput = screen.getByPlaceholderText('Search help...');
        await user.type(searchInput, 'scan');

        // "First Scan" and "AI Scan" both match "scan" — visible
        expect(screen.getByText('First Scan')).toBeInTheDocument();
        expect(screen.getByText('AI Scan')).toBeInTheDocument();

        // "Opening" does not match "scan" — should not be visible
        expect(screen.queryByText('Opening')).not.toBeInTheDocument();
    });
});
