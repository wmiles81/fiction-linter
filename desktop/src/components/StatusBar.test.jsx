import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBar from './StatusBar';

// The status bar moved its action buttons (Lint, Findings, Line #s, AI
// Scan, Re-lint, Next) up to the top toolbar, so these tests now only
// cover the informational surface left behind: status text, dirty
// indicator, word/char counts, selection metrics, cursor, findings count.
describe('StatusBar', () => {
    const defaultProps = {
        status: 'Ready',
        content: 'Hello world this is a test',
        cursorLine: 1,
        cursorColumn: 5,
        selection: null,
        dirty: false,
        issueCount: 0
    };

    it('renders the status text', () => {
        render(<StatusBar {...defaultProps} />);
        expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('computes and displays word count', () => {
        render(<StatusBar {...defaultProps} />);
        expect(screen.getByText(/6 words/)).toBeInTheDocument();
    });

    it('displays char count', () => {
        render(<StatusBar {...defaultProps} />);
        expect(screen.getByText(/26 chars/)).toBeInTheDocument();
    });

    it('shows cursor position', () => {
        render(<StatusBar {...defaultProps} cursorLine={3} cursorColumn={14} />);
        expect(screen.getByText(/3:14/)).toBeInTheDocument();
    });

    it('shows dirty indicator when dirty', () => {
        render(<StatusBar {...defaultProps} dirty={true} />);
        expect(screen.getByText('\u25CF')).toBeInTheDocument();
    });

    it('shows issue count', () => {
        render(<StatusBar {...defaultProps} issueCount={5} />);
        expect(screen.getByText(/5 findings/)).toBeInTheDocument();
    });

    it('does not render any action buttons — those live in the top bar now', () => {
        render(<StatusBar {...defaultProps} issueCount={5} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles empty content gracefully', () => {
        render(<StatusBar {...defaultProps} content="" />);
        expect(screen.getByText(/0 words/)).toBeInTheDocument();
        expect(screen.getByText(/0 chars/)).toBeInTheDocument();
    });

    it('shows selection metrics when selection is non-null', () => {
        render(
            <StatusBar
                {...defaultProps}
                selection={{ chars: 11, words: 2 }}
            />
        );
        expect(screen.getByText(/6 words/)).toBeInTheDocument();
        expect(screen.getByText(/2 words selected/)).toBeInTheDocument();
        expect(screen.getByText(/11 chars selected/)).toBeInTheDocument();
    });

    it('hides selection metrics when selection is null', () => {
        render(<StatusBar {...defaultProps} selection={null} />);
        expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });

    it('hides selection metrics for a zero-length selection', () => {
        render(
            <StatusBar
                {...defaultProps}
                content=""
                selection={{ chars: 0, words: 0 }}
            />
        );
        expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });
});
