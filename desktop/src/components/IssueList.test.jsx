import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IssueList from './IssueList';

const sampleIssues = [
    {
        start: 10,
        end: 18,
        message: 'Somatic Cliche: "released a breath". Penalty: 3.',
        severity: 'warning',
        line: 2,
        column: 4
    }
];

describe('IssueList', () => {
    it('renders a jump button for each issue and calls onJump on click', async () => {
        const onJump = vi.fn();
        const user = userEvent.setup();

        render(<IssueList issues={sampleIssues} onJump={onJump} />);

        const jumpButton = screen.getByRole('button', { name: /Jump to/i });
        await user.click(jumpButton);

        expect(onJump).toHaveBeenCalledWith(sampleIssues[0]);
    });

    it('renders a helpful empty-state when there are no issues', () => {
        render(<IssueList issues={[]} onJump={() => {}} />);
        expect(screen.getByText(/No lint findings yet/i)).toBeInTheDocument();
    });
});
