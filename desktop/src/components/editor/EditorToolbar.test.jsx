import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditorToolbar from './EditorToolbar';

describe('EditorToolbar', () => {
    const defaultProps = {
        onCommand: vi.fn(),
        onSave: vi.fn(),
        canUndo: true,
        canRedo: true,
        canSave: true,
        wrap: true,
        onToggleWrap: vi.fn()
    };

    it('renders all expected buttons', () => {
        render(<EditorToolbar {...defaultProps} />);
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /underline/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /scene break/i })).toBeInTheDocument();
    });

    it('renders paragraph style selector with H1, H2, H3, Paragraph options', () => {
        render(<EditorToolbar {...defaultProps} />);
        const select = screen.getByRole('combobox', { name: /paragraph style/i });
        expect(select).toBeInTheDocument();
        const options = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
        expect(options).toEqual(expect.arrayContaining(['Paragraph', 'Heading 1', 'Heading 2', 'Heading 3']));
    });

    it('fires onCommand when Bold is clicked', async () => {
        const onCommand = vi.fn();
        const user = userEvent.setup();
        render(<EditorToolbar {...defaultProps} onCommand={onCommand} />);
        await user.click(screen.getByRole('button', { name: /bold/i }));
        expect(onCommand).toHaveBeenCalledWith({ kind: 'bold' });
    });

    it('fires onCommand with heading kind when paragraph style changes', async () => {
        const onCommand = vi.fn();
        const user = userEvent.setup();
        render(<EditorToolbar {...defaultProps} onCommand={onCommand} />);
        const select = screen.getByRole('combobox', { name: /paragraph style/i });
        await user.selectOptions(select, 'h2');
        expect(onCommand).toHaveBeenCalledWith({ kind: 'format-block', value: 'h2' });
    });

    it('undo button is disabled when canUndo is false', () => {
        render(<EditorToolbar {...defaultProps} canUndo={false} />);
        expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    });
});
