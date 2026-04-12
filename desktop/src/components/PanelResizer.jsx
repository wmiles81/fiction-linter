import React, { useCallback, useRef } from 'react';

function PanelResizer({ onResize, minWidth, maxWidth, currentWidth }) {
    const startX = useRef(null);
    const startWidth = useRef(null);

    const handlePointerDown = useCallback((e) => {
        e.preventDefault();
        e.target.setPointerCapture?.(e.pointerId);
        startX.current = e.clientX;
        startWidth.current = currentWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [currentWidth]);

    const handlePointerMove = useCallback((e) => {
        if (startX.current === null) return;
        const delta = e.clientX - startX.current;
        const newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, startWidth.current + delta)
        );
        onResize(newWidth);
    }, [minWidth, maxWidth, onResize]);

    const handlePointerUp = useCallback((e) => {
        if (startX.current === null) return;
        startX.current = null;
        e.target.releasePointerCapture?.(e.pointerId);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    return (
        <div
            className="panel-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize files panel"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        />
    );
}

export default PanelResizer;
