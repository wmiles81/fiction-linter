import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemePicker from './ThemePicker';
import { useAppStore, THEMES } from '../store/useAppStore';

// Reset the store AND the DOM attribute between tests so each test starts
// from a clean parchment baseline. Otherwise the previous test's selection
// leaks via both localStorage and the <html data-theme> attribute.
beforeEach(() => {
    try { window.localStorage.removeItem('fl.theme'); } catch { /* ignore */ }
    useAppStore.setState({ theme: 'parchment' });
    document.documentElement.removeAttribute('data-theme');
});

describe('ThemePicker', () => {
    it('shows the current theme label on the toggle button', () => {
        useAppStore.setState({ theme: 'midnight' });
        render(<ThemePicker />);
        // The label text appears both as the visible label AND in the aria
        // label ("Theme: Midnight..."). Use getAllByText and check length.
        expect(screen.getAllByText(/Midnight/).length).toBeGreaterThan(0);
    });

    it('opens a menu listing all four themes when clicked', async () => {
        const user = userEvent.setup();
        render(<ThemePicker />);
        await user.click(screen.getByRole('button', { name: /Theme:/i }));
        THEMES.forEach(t => {
            expect(screen.getByRole('option', { name: new RegExp(t.label) })).toBeInTheDocument();
        });
    });

    it('clicking an option sets the theme and closes the menu', async () => {
        const user = userEvent.setup();
        render(<ThemePicker />);
        await user.click(screen.getByRole('button', { name: /Theme:/i }));
        await user.click(screen.getByRole('option', { name: /Midnight/i }));
        expect(useAppStore.getState().theme).toBe('midnight');
        // Menu closed — no listbox in the DOM anymore.
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('applies data-theme to <html> when a theme is picked', async () => {
        const user = userEvent.setup();
        render(<ThemePicker />);
        await user.click(screen.getByRole('button', { name: /Theme:/i }));
        await user.click(screen.getByRole('option', { name: /Sepia/i }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('sepia');
    });

    it('persists the selection to localStorage', async () => {
        const user = userEvent.setup();
        render(<ThemePicker />);
        await user.click(screen.getByRole('button', { name: /Theme:/i }));
        await user.click(screen.getByRole('option', { name: /High Contrast/i }));
        expect(window.localStorage.getItem('fl.theme')).toBe('high-contrast');
    });

    it('marks the currently-selected theme with aria-selected', async () => {
        useAppStore.setState({ theme: 'sepia' });
        const user = userEvent.setup();
        render(<ThemePicker />);
        await user.click(screen.getByRole('button', { name: /Theme:/i }));
        const sepia = screen.getByRole('option', { name: /Sepia/i });
        expect(sepia).toHaveAttribute('aria-selected', 'true');
        const midnight = screen.getByRole('option', { name: /Midnight/i });
        expect(midnight).toHaveAttribute('aria-selected', 'false');
    });

    it('closes when Escape is pressed', async () => {
        const user = userEvent.setup();
        render(<ThemePicker />);
        await user.click(screen.getByRole('button', { name: /Theme:/i }));
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
});
