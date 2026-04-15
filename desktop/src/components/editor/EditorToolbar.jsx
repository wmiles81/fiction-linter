import { MIN_FONT_SIZE, MAX_FONT_SIZE, FONT_SIZE_STEP } from '../../store/useAppStore';

function EditorToolbar({
    onCommand,
    onSave,
    onToggleWrap,
    wrap,
    canUndo,
    canRedo,
    canSave,
    editorFontSize,
    onChangeFontSize
}) {
    const fire = (kind, value) => () => onCommand?.({ kind, value });

    // Font-size controls are optional — the toolbar still works without
    // them (for consumers / tests that don't wire the prop). When wired,
    // the buttons step by FONT_SIZE_STEP (2px) and disable at bounds so
    // clicks can't overshoot.
    const canShowFontControls = typeof onChangeFontSize === 'function' &&
        typeof editorFontSize === 'number';
    const decreaseDisabled = !canShowFontControls || editorFontSize <= MIN_FONT_SIZE;
    const increaseDisabled = !canShowFontControls || editorFontSize >= MAX_FONT_SIZE;

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

            {canShowFontControls ? (
                <div className="editor-fontsize" role="group" aria-label="Editor font size">
                    <button
                        type="button"
                        onClick={() => onChangeFontSize(editorFontSize - FONT_SIZE_STEP)}
                        disabled={decreaseDisabled}
                        title={`Decrease editor font size (currently ${editorFontSize}px)`}
                        aria-label="Decrease font size"
                        className="toolbar-button-format"
                    >
                        A−
                    </button>
                    <span
                        className="editor-fontsize-readout"
                        aria-live="polite"
                        title="Current editor font size"
                    >
                        {editorFontSize}px
                    </span>
                    <button
                        type="button"
                        onClick={() => onChangeFontSize(editorFontSize + FONT_SIZE_STEP)}
                        disabled={increaseDisabled}
                        title={`Increase editor font size (currently ${editorFontSize}px)`}
                        aria-label="Increase font size"
                        className="toolbar-button-format"
                    >
                        A+
                    </button>
                </div>
            ) : null}

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
