import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LicenseDialog from './LicenseDialog';

beforeEach(() => {
    window.api = window.api || {};
    window.api.validateLicense = vi.fn(async () => ({ valid: true, email: 'a@b.com', name: 'Author' }));
    window.api.openExternal = vi.fn();
});

describe('LicenseDialog', () => {
    it('renders a key input and an Activate button', () => {
        render(<LicenseDialog onActivated={() => {}} />);
        expect(screen.getByLabelText('License Key')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /activate/i })).toBeInTheDocument();
    });

    it('calls onActivated after successful validation', async () => {
        const user = userEvent.setup();
        const onActivated = vi.fn();
        render(<LicenseDialog onActivated={onActivated} />);

        const input = screen.getByLabelText('License Key');
        await user.type(input, 'TEST-1234-ABCD-5678');
        await user.click(screen.getByRole('button', { name: /activate/i }));

        expect(window.api.validateLicense).toHaveBeenCalledWith('TEST-1234-ABCD-5678');
        expect(onActivated).toHaveBeenCalledWith({ email: 'a@b.com', name: 'Author' });
    });

    it('shows error text on invalid key', async () => {
        window.api.validateLicense = vi.fn(async () => ({ valid: false, error: 'Key not recognized.' }));
        const user = userEvent.setup();
        render(<LicenseDialog onActivated={() => {}} />);

        const input = screen.getByLabelText('License Key');
        await user.type(input, 'BAD-KEY-1234-XXXX');
        await user.click(screen.getByRole('button', { name: /activate/i }));

        expect(await screen.findByText('Key not recognized.')).toBeInTheDocument();
    });

    it('has a Buy button', () => {
        render(<LicenseDialog onActivated={() => {}} />);
        expect(screen.getByRole('button', { name: /buy/i })).toBeInTheDocument();
    });
});
