import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabBar from './TabBar';

describe('TabBar', () => {
    const sampleTabs = [
        { id: 't1', name: 'alpha.md', path: '/tmp/alpha.md', dirty: false },
        { id: 't2', name: 'beta.md', path: '/tmp/beta.md', dirty: true },
        { id: 't3', name: 'Untitled.md', path: null, dirty: true }
    ];

    it('renders one button per tab with the file name', () => {
        render(
            <TabBar
                tabs={sampleTabs}
                activeTabId="t1"
                onSelect={() => {}}
                onClose={() => {}}
                onCloseAll={() => {}}
            />
        );
        expect(screen.getByRole('button', { name: /alpha\.md/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /beta\.md/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Untitled\.md/ })).toBeInTheDocument();
    });

    it('marks dirty tabs visually (bullet indicator in name)', () => {
        render(
            <TabBar
                tabs={sampleTabs}
                activeTabId="t1"
                onSelect={() => {}}
                onClose={() => {}}
                onCloseAll={() => {}}
            />
        );
        const dirtyTab = screen.getByRole('button', { name: /beta\.md/ });
        expect(dirtyTab.textContent).toContain('\u25cf'); // dirty marker
    });

    it('calls onSelect with tab id when a tab is clicked', async () => {
        const onSelect = vi.fn();
        const user = userEvent.setup();
        render(
            <TabBar
                tabs={sampleTabs}
                activeTabId="t1"
                onSelect={onSelect}
                onClose={() => {}}
                onCloseAll={() => {}}
            />
        );
        await user.click(screen.getByRole('button', { name: /beta\.md/ }));
        expect(onSelect).toHaveBeenCalledWith('t2');
    });

    it('calls onClose with tab id when the close button is clicked, without triggering onSelect', async () => {
        const onSelect = vi.fn();
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(
            <TabBar
                tabs={sampleTabs}
                activeTabId="t1"
                onSelect={onSelect}
                onClose={onClose}
                onCloseAll={() => {}}
            />
        );
        const closeButtons = screen.getAllByRole('button', { name: /close tab/i });
        await user.click(closeButtons[1]); // close beta.md
        expect(onClose).toHaveBeenCalledWith('t2');
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('renders a Clear All button that calls onCloseAll', async () => {
        const onCloseAll = vi.fn();
        const user = userEvent.setup();
        render(
            <TabBar
                tabs={sampleTabs}
                activeTabId="t1"
                onSelect={() => {}}
                onClose={() => {}}
                onCloseAll={onCloseAll}
            />
        );
        await user.click(screen.getByRole('button', { name: /clear all/i }));
        expect(onCloseAll).toHaveBeenCalled();
    });

    it('hides Clear All when there are zero tabs', () => {
        render(
            <TabBar
                tabs={[]}
                activeTabId={null}
                onSelect={() => {}}
                onClose={() => {}}
                onCloseAll={() => {}}
            />
        );
        expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
    });
});
