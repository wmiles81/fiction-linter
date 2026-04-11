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

    it('fires onResize with the new width on mouse drag', () => {
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

        // Simulate a drag: mousedown on the gutter, mousemove on window, mouseup
        fireEvent.mouseDown(gutter, { clientX: 260 });
        fireEvent.mouseMove(window, { clientX: 340 });
        fireEvent.mouseUp(window);

        // onResize is called with the final width (260 + 80 = 340)
        expect(onResize).toHaveBeenCalled();
        const finalCallArg = onResize.mock.calls[onResize.mock.calls.length - 1][0];
        expect(finalCallArg).toBe(340);
    });

    it('clamps to minWidth when dragging below', () => {
        const onResize = vi.fn();
        render(<PanelResizer onResize={onResize} minWidth={160} maxWidth={800} currentWidth={260} />);
        const gutter = screen.getByRole('separator');
        fireEvent.mouseDown(gutter, { clientX: 260 });
        fireEvent.mouseMove(window, { clientX: 50 }); // would be 50, clamp to 160
        fireEvent.mouseUp(window);
        const finalCallArg = onResize.mock.calls[onResize.mock.calls.length - 1][0];
        expect(finalCallArg).toBe(160);
    });

    it('clamps to maxWidth when dragging above', () => {
        const onResize = vi.fn();
        render(<PanelResizer onResize={onResize} minWidth={160} maxWidth={800} currentWidth={260} />);
        const gutter = screen.getByRole('separator');
        fireEvent.mouseDown(gutter, { clientX: 260 });
        fireEvent.mouseMove(window, { clientX: 1500 }); // would be 1500, clamp to 800
        fireEvent.mouseUp(window);
        const finalCallArg = onResize.mock.calls[onResize.mock.calls.length - 1][0];
        expect(finalCallArg).toBe(800);
    });
});
