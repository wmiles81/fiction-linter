import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PanelResizer from './PanelResizer';

describe('PanelResizer', () => {
    it('renders a gutter with col-resize cursor affordance', () => {
        render(<PanelResizer onResize={() => {}} minWidth={160} maxWidth={800} currentWidth={260} />);
        const gutter = screen.getByRole('separator');
        expect(gutter).toBeInTheDocument();
    });

    it('fires onResize with the new width on pointer drag', () => {
        const onResize = vi.fn();
        render(
            <PanelResizer
                onResize={onResize}
                minWidth={160}
                maxWidth={800}
                currentWidth={260}
            />
        );
        const gutter = screen.getByRole('separator');

        // Simulate a drag: pointerdown, pointermove, pointerup — all on the
        // gutter element (pointer capture routes events to the capture target).
        fireEvent.pointerDown(gutter, { clientX: 260, pointerId: 1 });
        fireEvent.pointerMove(gutter, { clientX: 340, pointerId: 1 });
        fireEvent.pointerUp(gutter, { clientX: 340, pointerId: 1 });

        expect(onResize).toHaveBeenCalled();
        const finalCallArg = onResize.mock.calls[onResize.mock.calls.length - 1][0];
        expect(finalCallArg).toBe(340);
    });

    it('clamps to minWidth when dragging below', () => {
        const onResize = vi.fn();
        render(<PanelResizer onResize={onResize} minWidth={160} maxWidth={800} currentWidth={260} />);
        const gutter = screen.getByRole('separator');
        fireEvent.pointerDown(gutter, { clientX: 260, pointerId: 1 });
        fireEvent.pointerMove(gutter, { clientX: 50, pointerId: 1 });
        fireEvent.pointerUp(gutter, { clientX: 50, pointerId: 1 });
        const finalCallArg = onResize.mock.calls[onResize.mock.calls.length - 1][0];
        expect(finalCallArg).toBe(160);
    });

    it('clamps to maxWidth when dragging above', () => {
        const onResize = vi.fn();
        render(<PanelResizer onResize={onResize} minWidth={160} maxWidth={800} currentWidth={260} />);
        const gutter = screen.getByRole('separator');
        fireEvent.pointerDown(gutter, { clientX: 260, pointerId: 1 });
        fireEvent.pointerMove(gutter, { clientX: 1500, pointerId: 1 });
        fireEvent.pointerUp(gutter, { clientX: 1500, pointerId: 1 });
        const finalCallArg = onResize.mock.calls[onResize.mock.calls.length - 1][0];
        expect(finalCallArg).toBe(800);
    });
});
