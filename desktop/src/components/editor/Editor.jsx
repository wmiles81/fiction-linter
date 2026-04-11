import React, { forwardRef, useEffect, useImperativeHandle, useRef, useCallback } from 'react';
import EditorToolbar from './EditorToolbar';
import { markdownToHtml, htmlToMarkdown, sanitizeHtml } from './converters';
import { applyLintHighlights, buildOffsetMap, rangeFromOffsets } from './lintOverlay';

/**
 * The Editor is a self-contained WYSIWYG markdown editor. It owns a
 * contenteditable div, converts markdown <-> HTML via unified, and drives
 * lint highlights through the CSS Custom Highlight API.
 *
 * Props-only API — nothing inside references window.api or fiction-linter
 * globals directly. Positioned for future extraction to a shared package.
 */
const Editor = forwardRef(function Editor({
    value,
    onChange,
    issues,
    showFindings,
    onSave,
    onStateChange,
    wrap,
    onToggleWrap
}, ref) {
    const editorRef = useRef(null);
    const isSettingContentRef = useRef(false);
    // Track the last markdown we emitted so we can ignore the re-entry
    // that happens when the parent echoes value back.
    const lastEmittedRef = useRef(null);

    // Sync external value (markdown) into the contenteditable as HTML
    useEffect(() => {
        if (!editorRef.current) return;
        // If the incoming value matches the markdown we just emitted, leave
        // the DOM alone — the user's cursor is still where they left it.
        if (value === lastEmittedRef.current) return;
        isSettingContentRef.current = true;
        let cancelled = false;
        markdownToHtml(value || '').then(html => {
            if (cancelled || !editorRef.current) return;
            const clean = sanitizeHtml(html);
            if (editorRef.current.innerHTML !== clean) {
                editorRef.current.innerHTML = clean;
            }
            isSettingContentRef.current = false;
        });
        return () => {
            cancelled = true;
        };
    }, [value]);

    // Handle user input: convert HTML -> markdown, fire onChange
    const handleInput = useCallback(() => {
        if (isSettingContentRef.current) return;
        if (!editorRef.current) return;
        const html = editorRef.current.innerHTML;
        htmlToMarkdown(html).then(markdown => {
            lastEmittedRef.current = markdown;
            onChange?.(markdown);
        });
    }, [onChange]);

    // Handle paste: convert pasted HTML -> markdown -> HTML (clean) -> insert
    const handlePaste = useCallback(async (e) => {
        e.preventDefault();
        const html = e.clipboardData?.getData('text/html') || '';
        const text = e.clipboardData?.getData('text/plain') || '';

        if (html) {
            try {
                const markdown = await htmlToMarkdown(html);
                const cleanHtml = sanitizeHtml(await markdownToHtml(markdown));
                document.execCommand('insertHTML', false, cleanHtml);
            } catch {
                document.execCommand('insertText', false, text);
            }
        } else if (text) {
            document.execCommand('insertText', false, text);
        }
        // After paste, recompute markdown.
        handleInput();
    }, [handleInput]);

    // Cursor + selection tracking — report line/column AND selection metrics.
    // Matches the shape used by the CodeMirror version in Phase 7.4 so App.jsx
    // does not need to change when the editor swaps.
    const handleSelectionChange = useCallback(() => {
        if (!editorRef.current || !onStateChange) return;
        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!editorRef.current.contains(range.startContainer)) return;

        const { text, map } = buildOffsetMap(editorRef.current);

        const startOffset = offsetForNode(map, range.startContainer, range.startOffset);
        const before = text.slice(0, startOffset);
        const newlineIdx = before.lastIndexOf('\n');
        const line = before.split('\n').length;
        const column = newlineIdx === -1 ? before.length + 1 : before.length - newlineIdx;

        let selectionMetrics = null;
        if (!range.collapsed) {
            const endOffset = offsetForNode(map, range.endContainer, range.endOffset);
            const from = Math.min(startOffset, endOffset);
            const to = Math.max(startOffset, endOffset);
            const selectedText = text.slice(from, to);
            if (selectedText.length > 0) {
                selectionMetrics = {
                    chars: selectedText.length,
                    words: selectedText.trim().split(/\s+/).filter(Boolean).length
                };
            }
        }

        onStateChange({ line, column, selection: selectionMetrics });
    }, [onStateChange]);

    useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [handleSelectionChange]);

    // Apply lint highlights whenever issues change
    useEffect(() => {
        if (!editorRef.current) return;
        const cleanup = applyLintHighlights(
            editorRef.current,
            showFindings ? issues : [],
            showFindings
        );
        return cleanup;
    }, [issues, showFindings]);

    // Toolbar command dispatch
    const handleToolbarCommand = useCallback(({ kind, value: cmdValue }) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        switch (kind) {
            case 'undo':
                document.execCommand('undo');
                break;
            case 'redo':
                document.execCommand('redo');
                break;
            case 'bold':
                document.execCommand('bold');
                break;
            case 'italic':
                document.execCommand('italic');
                break;
            case 'underline':
                document.execCommand('underline');
                break;
            case 'format-block':
                document.execCommand('formatBlock', false, cmdValue);
                break;
            case 'scene-break':
                document.execCommand('insertHorizontalRule');
                break;
            default:
                break;
        }
        // After a command, fire onChange so the markdown source updates
        handleInput();
    }, [handleInput]);

    // Expose imperative jumpTo for click-to-issue
    useImperativeHandle(ref, () => ({
        jumpTo(issue) {
            if (!editorRef.current) return;
            const { map } = buildOffsetMap(editorRef.current);
            const range = rangeFromOffsets(map, issue.start, issue.end);
            if (!range) return;
            const selection = document.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
            // Scroll the editor surface so the range is visible.
            try {
                const rect = range.getBoundingClientRect();
                const surfaceRect = editorRef.current.getBoundingClientRect();
                const targetTop = editorRef.current.scrollTop + (rect.top - surfaceRect.top) - 100;
                editorRef.current.scrollTo({
                    top: Math.max(0, targetTop),
                    behavior: 'smooth'
                });
            } catch {
                // jsdom / getBoundingClientRect may throw; non-fatal.
            }
            editorRef.current.focus();
        }
    }));

    return (
        <section className="editor-panel">
            <EditorToolbar
                onCommand={handleToolbarCommand}
                onSave={onSave}
                onToggleWrap={onToggleWrap}
                wrap={wrap}
                canUndo={true}
                canRedo={true}
                canSave={true}
            />
            <div
                ref={editorRef}
                className={`editor-surface ${wrap ? 'wrap' : ''}`}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onPaste={handlePaste}
                spellCheck={false}
            />
        </section>
    );
});

// Helper: given the offset map and a DOM node + offset, find the plain-text offset.
function offsetForNode(map, node, nodeOffset) {
    for (const entry of map) {
        if (entry.node === node) {
            return entry.startInText + nodeOffset;
        }
    }
    // Fallback: if the node is an element, try to find the first text entry
    // inside it and use its start.
    for (const entry of map) {
        if (entry.node.parentNode === node || (node.contains && node.contains(entry.node))) {
            return entry.startInText;
        }
    }
    return 0;
}

export default Editor;
