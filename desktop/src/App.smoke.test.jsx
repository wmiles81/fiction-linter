import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App (smoke)', () => {
    it('renders the top bar with brand title', async () => {
        render(<App />);
        expect(await screen.findByText('Fiction Linter')).toBeInTheDocument();
        expect(screen.getByText('Desktop Studio')).toBeInTheDocument();
    });

    it('shows the empty-tree hint before a folder is chosen', async () => {
        render(<App />);
        expect(
            await screen.findByText(/Pick a folder to start exploring/i)
        ).toBeInTheDocument();
    });

    it('shows the ready status in the footer', async () => {
        render(<App />);
        expect(await screen.findByText('Ready')).toBeInTheDocument();
    });
});
