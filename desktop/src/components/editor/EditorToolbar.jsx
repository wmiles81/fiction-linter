import React from 'react';

function EditorToolbar({
    onCommand,
    onSave,
    onToggleWrap,
    wrap,
    canUndo,
    canRedo,
    canSave
}) {
    const fire = (kind, value) => () => onCommand?.({ kind, value });

    return (
        <div className="editor-toolbar" role="toolbar" aria-label="Editor toolbar">
            <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                title="Save (Cmd+S)"
                aria-label="Save"
            >
                Save
            </button>

            <div className="editor-toolbar-separator" />

            <button
                type="button"
                onClick={fire('undo')}
                disabled={!canUndo}
                title="Undo (Cmd+Z)"
                aria-label="Undo"
            >
                {'\u21B6'}
            </button>
            <button
                type="button"
                onClick={fire('redo')}
                disabled={!canRedo}
                title="Redo (Cmd+Shift+Z)"
                aria-label="Redo"
            >
                {'\u21B7'}
            </button>

            <div className="editor-toolbar-separator" />

            <select
                onChange={(e) => onCommand?.({ kind: 'format-block', value: e.target.value })}
                aria-label="Paragraph style"
                className="paragraph-style-select"
                defaultValue="p"
            >
                <option value="p">Paragraph</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
            </select>

            <div className="editor-toolbar-separator" />

            <button
                type="button"
                onClick={fire('bold')}
                title="Bold (Cmd+B)"
                aria-label="Bold"
                className="toolbar-button-format"
            >
                <strong>B</strong>
            </button>
            <button
                type="button"
                onClick={fire('italic')}
                title="Italic (Cmd+I)"
                aria-label="Italic"
                className="toolbar-button-format"
            >
                <em>I</em>
            </button>
            <button
                type="button"
                onClick={fire('underline')}
                title="Underline (Cmd+U)"
                aria-label="Underline"
                className="toolbar-button-format"
            >
                <u>U</u>
            </button>

            <div className="editor-toolbar-separator" />

            <button
                type="button"
                onClick={fire('scene-break')}
                title="Insert scene break"
                aria-label="Scene break"
            >
                {'\u2015'}
            </button>

            <div className="editor-toolbar-spacer" />

            <button
                type="button"
                onClick={onToggleWrap}
                title={wrap ? 'Disable soft wrap' : 'Enable soft wrap'}
                aria-label={`Toggle wrap (currently ${wrap ? 'on' : 'off'})`}
                className={`toolbar-toggle ${wrap ? 'on' : 'off'}`}
            >
                Wrap
            </button>
        </div>
    );
}

export default EditorToolbar;
