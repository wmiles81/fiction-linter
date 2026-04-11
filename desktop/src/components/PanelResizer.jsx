import React, { useCallback, useEffect, useRef } from 'react';

function PanelResizer({ onResize, minWidth, maxWidth, currentWidth }) {
    const startX = useRef(null);
    const startWidth = useRef(null);
    const dragging = useRef(false);

    const handleMouseMove = useCallback((e) => {
        if (!dragging.current) return;
        const delta = e.clientX - startX.current;
        const newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, startWidth.current + delta)
        );
        onResize(newWidth);
    }, [minWidth, maxWidth, onResize]);

    const handleMouseUp = useCallback(() => {
        dragging.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [handleMouseMove]);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        dragging.current = true;
        startX.current = e.clientX;
        startWidth.current = currentWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [currentWidth, handleMouseMove, handleMouseUp]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return (
        <div
            className="panel-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize files panel"
            onMouseDown={handleMouseDown}
        />
    );
}

export default PanelResizer;
