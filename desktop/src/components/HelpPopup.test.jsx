import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpPopup from './HelpPopup';

describe('HelpPopup', () => {
    const topic = { id: 'test', title: 'Test Topic', summary: 'A test summary.' };

    it('renders the topic title and summary', () => {
        render(<HelpPopup topic={topic} position={{ x: 100, y: 100 }} onClose={() => {}} onMore={() => {}} />);
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
        expect(screen.getByText('A test summary.')).toBeInTheDocument();
    });

    it('has a More... button that calls onMore with the topic id', async () => {
        const onMore = vi.fn();
        const user = userEvent.setup();
        render(<HelpPopup topic={topic} position={{ x: 100, y: 100 }} onClose={() => {}} onMore={onMore} />);
        await user.click(screen.getByText(/more/i));
        expect(onMore).toHaveBeenCalledWith('test');
    });

    it('calls onClose when Escape is pressed', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(<HelpPopup topic={topic} position={{ x: 100, y: 100 }} onClose={onClose} onMore={() => {}} />);
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalled();
    });
});
