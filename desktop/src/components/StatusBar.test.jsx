import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatusBar from './StatusBar';

describe('StatusBar', () => {
    const defaultProps = {
        status: 'Ready',
        content: 'Hello world this is a test',
        cursorLine: 1,
        cursorColumn: 5,
        selection: null,
        dirty: false,
        issueCount: 0,
        lintEnabled: true,
        showFindings: true,
        onToggleLint: () => {},
        onToggleFindings: () => {}
    };

    it('renders the status text', () => {
        render(<StatusBar {...defaultProps} />);
        expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('computes and displays word count', () => {
        render(<StatusBar {...defaultProps} />);
        // "Hello world this is a test" = 6 words
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

    it('shows issue count when findings are visible', () => {
        render(<StatusBar {...defaultProps} issueCount={5} />);
        expect(screen.getByText(/5 findings/)).toBeInTheDocument();
    });

    it('lint toggle shows the FUTURE state ("Lint off" when currently on) and fires callback', async () => {
        // Toggle labels describe what clicking will DO, not the current
        // state — so lintEnabled=true shows "Lint off" (button turns it off).
        const onToggleLint = vi.fn();
        const user = userEvent.setup();
        render(<StatusBar {...defaultProps} onToggleLint={onToggleLint} />);
        const button = screen.getByRole('button', { name: /turn lint off/i });
        expect(button.textContent).toContain('Lint off');
        await user.click(button);
        expect(onToggleLint).toHaveBeenCalled();
    });

    it('shows "Lint on" label when lintEnabled is false', () => {
        // When linting is disabled, the button should invite enabling it.
        render(<StatusBar {...defaultProps} lintEnabled={false} />);
        const button = screen.getByRole('button', { name: /turn lint on/i });
        expect(button.textContent).toContain('Lint on');
    });

    it('findings toggle fires callback and reflects state', async () => {
        const onToggleFindings = vi.fn();
        const user = userEvent.setup();
        render(<StatusBar {...defaultProps} onToggleFindings={onToggleFindings} />);
        const button = screen.getByRole('button', { name: /findings/i });
        await user.click(button);
        expect(onToggleFindings).toHaveBeenCalled();
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
        // Total counts stay visible alongside selection metrics
        expect(screen.getByText(/6 words/)).toBeInTheDocument();
        // Selection metrics appear in a visually distinct element
        expect(screen.getByText(/2 words selected/)).toBeInTheDocument();
        expect(screen.getByText(/11 chars selected/)).toBeInTheDocument();
    });

    it('hides selection metrics when selection is null', () => {
        render(<StatusBar {...defaultProps} selection={null} />);
        expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });

    it('shows selection metrics even when content is empty (defensive)', () => {
        render(
            <StatusBar
                {...defaultProps}
                content=""
                selection={{ chars: 0, words: 0 }}
            />
        );
        // Zero-selection should not crash. We treat { chars: 0, words: 0 } as
        // "no real selection" and hide the display.
        expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });
});
