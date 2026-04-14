import React, { forwardRef, useEffect, useImperativeHandle, useRef, useCallback, useState } from 'react';
import EditorToolbar from './EditorToolbar';
import { markdownToHtml, htmlToMarkdown, sanitizeHtml } from './converters';
import { applyLintHighlights, buildOffsetMap, rangeFromOffsets } from './lintOverlay';

/**
 * Pure helper: given a list of findings and a plain-text offset, return
 * the first finding whose range contains the offset, or null. Exported
 * so the hover-tooltip lookup logic is testable in isolation (jsdom does
 * not implement caretRangeFromPoint, so we cannot easily integration-test
 * the full DOM-coordinate path).
 */
export function findingAtOffset(issues, offset) {
    if (!issues || issues.length === 0) return null;
    for (const issue of issues) {
        if (offset >= issue.start && offset <= issue.end) return issue;
    }
    return null;
}

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

    // Hover-tooltip state for inline lint warnings.
    // hoverFinding is the finding currently under the cursor (or null).
    // tooltipPos is the viewport-relative position to render the tooltip.
    // hoverRafRef throttles mousemove lookups to once per animation frame.
    const [hoverFinding, setHoverFinding] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const hoverRafRef = useRef(null);

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

    // Hover-tooltip lookup: convert mouse coordinates back into a plain-text
    // offset and check whether any finding's range contains it. Throttled to
    // once per animation frame to keep mousemove cheap (caret lookups + map
    // builds + finding scans on every pixel of cursor travel would burn cycles).
    const handleMouseMove = useCallback((e) => {
        if (!showFindings) return;
        if (!editorRef.current) return;
        if (hoverRafRef.current !== null) return;
        // Pull coordinates out before the rAF callback (defensive against
        // any future SyntheticEvent pooling, though React 17+ does not pool).
        const clientX = e.clientX;
        const clientY = e.clientY;
        hoverRafRef.current = requestAnimationFrame(() => {
            hoverRafRef.current = null;
            if (!editorRef.current) return;
            // caretRangeFromPoint is the WebKit/Blink API. Firefox uses
            // caretPositionFromPoint with a different return shape — we are
            // in Electron (Chromium) so caretRangeFromPoint is correct.
            const caretRange = document.caretRangeFromPoint?.(clientX, clientY);
            if (!caretRange || !editorRef.current.contains(caretRange.startContainer)) {
                setHoverFinding(null);
                return;
            }
            const { map } = buildOffsetMap(editorRef.current);
            const offset = offsetForNode(map, caretRange.startContainer, caretRange.startOffset);
            const finding = findingAtOffset(issues, offset);
            if (finding) {
                setHoverFinding(finding);
                // Offset the tooltip slightly down-and-right of the cursor so
                // it does not obscure the text being hovered.
                setTooltipPos({ x: clientX + 14, y: clientY + 18 });
            } else {
                setHoverFinding(null);
            }
        });
    }, [showFindings, issues]);

    const handleMouseLeave = useCallback(() => {
        if (hoverRafRef.current !== null) {
            cancelAnimationFrame(hoverRafRef.current);
            hoverRafRef.current = null;
        }
        setHoverFinding(null);
    }, []);

    // Hide the tooltip if showFindings flips to false while we're hovering
    // (toggling from Findings to Silent in the status bar mid-hover).
    useEffect(() => {
        if (!showFindings) setHoverFinding(null);
    }, [showFindings]);

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

    // Expose imperative methods.
    //
    // - jumpTo(issue): scroll/select the range corresponding to a finding
    // - getPlainText(): return the editor's plain-text representation
    //   (the same string lintOverlay uses for offset mapping). The lint
    //   pipeline must lint THIS string, not the markdown source — markdown
    //   syntax markers (**, #, etc.) shift offsets vs the rendered text,
    //   and feeding markdown offsets into the DOM-based highlight overlay
    //   produces wrong-position highlights and (in the worst case) crashes
    //   the Range API on out-of-bounds offsets.
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
        },
        getPlainText() {
            if (!editorRef.current) return '';
            return buildOffsetMap(editorRef.current).text;
        },
        // Current caret position as an offset into the plain-text
        // representation the linter uses. Returns null when nothing in the
        // editor is selected (e.g., user just focused elsewhere). Used by
        // "Next finding" so it can jump to the next issue AFTER the cursor
        // instead of always restarting from the top.
        getCursorOffset() {
            if (!editorRef.current) return null;
            const sel = document.getSelection();
            if (!sel || sel.rangeCount === 0) return null;
            const range = sel.getRangeAt(0);
            if (!editorRef.current.contains(range.startContainer)) return null;
            const { map } = buildOffsetMap(editorRef.current);
            const entry = map.find(e => e.node === range.startContainer);
            if (!entry) return null;
            return entry.startInText + range.startOffset;
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
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                spellCheck={false}
            />
            {hoverFinding ? (
                <div
                    className={`lint-tooltip ${hoverFinding.severity || 'info'}`}
                    style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
                    role="tooltip"
                >
                    {hoverFinding.message}
                </div>
            ) : null}
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
