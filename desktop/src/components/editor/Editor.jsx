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
    onToggleWrap,
    onFixLater,
    onFixNow,
    onSuggestFixes,
    onApplySuggestedFix,
    showLineNumbers,
    editorFontSize,
    onChangeFontSize,
    onContentReady
}, ref) {
    const editorRef = useRef(null);
    const gutterInnerRef = useRef(null);
    const isSettingContentRef = useRef(false);
    // Line-number positions: one entry per block child of the editor
    // surface, recomputed on content change via a MutationObserver below.
    const [lineNumberPositions, setLineNumberPositions] = useState([]);
    // Track the last markdown we emitted so we can ignore the re-entry
    // that happens when the parent echoes value back.
    const lastEmittedRef = useRef(null);
    // "Hover bridge" timeout — a mouseleave on the flagged text schedules
    // a tooltip close, but the scheduled close is cancelled if the mouse
    // lands on the tooltip itself. Without this, the tooltip would close
    // before the user could reach its buttons.
    const tooltipHideTimerRef = useRef(null);
    // Remembers which finding the tooltip is currently anchored to, by
    // "start-end" key. When a mousemove over the SAME finding fires, we
    // leave the tooltip alone — otherwise the tooltip would chase the
    // cursor and flee from the user's mouse as they try to click a button.
    const pinnedFindingKeyRef = useRef(null);
    // Track in-flight fix so the buttons can show "Fixing…" and avoid
    // double-clicks during the AI rewrite round-trip.
    const [fixInFlight, setFixInFlight] = useState(false);
    const [suggestedFixes, setSuggestedFixes] = useState(null);

    // Hover-tooltip state for inline lint warnings.
    // hoverFinding is the finding currently under the cursor (or null).
    // tooltipPos is the viewport-relative position to render the tooltip.
    // hoverRafRef throttles mousemove lookups to once per animation frame.
    const [hoverFinding, setHoverFinding] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const hoverRafRef = useRef(null);
    // Mirrors of issues/showFindings kept in refs so the async content effect
    // can re-apply highlights right after it writes innerHTML, without taking
    // a closure over the stale values from the last render.
    const latestIssuesRef = useRef(issues);
    const latestShowFindingsRef = useRef(showFindings);
    useEffect(() => { latestIssuesRef.current = issues; }, [issues]);
    useEffect(() => { latestShowFindingsRef.current = showFindings; }, [showFindings]);
    // Keep a ref to onContentReady so the async innerHTML callback always
    // calls the latest version (avoids stale closure over the prop).
    const onContentReadyRef = useRef(onContentReady);
    useEffect(() => { onContentReadyRef.current = onContentReady; }, [onContentReady]);
    // Mirror suggestedFixes in a ref so the stable scheduleHideTooltip
    // useCallback can read the latest value without a stale closure.
    const suggestedFixesRef = useRef(suggestedFixes);
    useEffect(() => { suggestedFixesRef.current = suggestedFixes; }, [suggestedFixes]);

    useEffect(() => {
        if (!hoverFinding) {
            setSuggestedFixes(null);
            return;
        }
        const key = `${hoverFinding.start}-${hoverFinding.end}-${hoverFinding.source}`;
        if (suggestedFixes?.forKey && suggestedFixes.forKey !== key) {
            setSuggestedFixes(null);
        }
    }, [hoverFinding, suggestedFixes]);

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
            // Re-apply any already-computed highlights immediately (handles
            // the case where the lint fired before markdownToHtml resolved
            // and the DOM was still populated from a previous file).
            applyLintHighlights(
                editorRef.current,
                latestShowFindingsRef.current ? latestIssuesRef.current : [],
                latestShowFindingsRef.current
            );
            // Re-run lint against the freshly-populated DOM. This is the
            // critical fix for large gdoc imports: their markdownToHtml
            // conversion takes >300ms, so the debounced lint fires while
            // the DOM is empty, falls back to raw markdown text, and
            // computes wrong-offset issues. Calling onContentReady here
            // runs lint now that getPlainText() returns the real plain text.
            onContentReadyRef.current?.();
        });
        return () => {
            cancelled = true;
            isSettingContentRef.current = false;
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

    // Bridge-timer helpers: scheduleHideTooltip queues a 180ms delayed close
    // (so mouse-travel onto the tooltip has time to cancel it),
    // cancelHideTooltip aborts the pending close. These must be declared
    // BEFORE handleMouseMove and handleMouseLeave because both reference
    // them in their useCallback dependency arrays — const is subject to
    // the Temporal Dead Zone.
    const scheduleHideTooltip = useCallback(() => {
        if (suggestedFixesRef.current !== null) return;
        if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
        tooltipHideTimerRef.current = setTimeout(() => {
            tooltipHideTimerRef.current = null;
            setHoverFinding(null);
            pinnedFindingKeyRef.current = null;
        }, 180);
    }, []);

    const cancelHideTooltip = useCallback(() => {
        if (tooltipHideTimerRef.current) {
            clearTimeout(tooltipHideTimerRef.current);
            tooltipHideTimerRef.current = null;
        }
    }, []);

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
                // Mouse is outside the editor text entirely (e.g., over
                // padding). Schedule close via the bridge so the tooltip
                // stays long enough to be reachable.
                pinnedFindingKeyRef.current = null;
                scheduleHideTooltip();
                return;
            }
            const { map } = buildOffsetMap(editorRef.current);
            const offset = offsetForNode(map, caretRange.startContainer, caretRange.startOffset);
            const finding = findingAtOffset(issues, offset);
            if (!finding) {
                // Over non-flagged text — start the hide bridge. The user
                // might be moving the mouse UP toward the tooltip; give them
                // 180ms to land on it before we close.
                pinnedFindingKeyRef.current = null;
                scheduleHideTooltip();
                return;
            }
            const findingKey = `${finding.start}-${finding.end}`;
            if (pinnedFindingKeyRef.current === findingKey) {
                // Same finding as what's already shown — LEAVE POSITION ALONE.
                // Without this the tooltip chases the cursor and the user
                // can never reach its buttons. Also cancel any pending
                // hide (they re-entered the flagged range).
                cancelHideTooltip();
                return;
            }
            // New finding (or first time) — anchor the tooltip to the
            // range's bounding rect. Centered horizontally over the flagged
            // text, 8px above it. CSS transform: translate(-50%, -100%)
            // places the tooltip's bottom-center at this point.
            cancelHideTooltip();
            pinnedFindingKeyRef.current = findingKey;
            const range = rangeFromOffsets(map, finding.start, finding.end);
            if (range) {
                const rect = range.getBoundingClientRect();
                setTooltipPos({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8
                });
            } else {
                // Very defensive fallback — rangeFromOffsets is robust, but
                // if it somehow returns null we still want the tooltip to
                // show somewhere reasonable.
                setTooltipPos({ x: clientX, y: clientY + 18 });
            }
            setHoverFinding(finding);
        });
    }, [showFindings, issues, scheduleHideTooltip, cancelHideTooltip]);

    const handleMouseLeave = useCallback(() => {
        if (hoverRafRef.current !== null) {
            cancelAnimationFrame(hoverRafRef.current);
            hoverRafRef.current = null;
        }
        // Don't clear immediately — let the bridge timer run so mouse
        // travel onto the tooltip keeps it open.
        scheduleHideTooltip();
    }, [scheduleHideTooltip]);

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

    // Line-number gutter maintenance. A MutationObserver watches the
    // contenteditable for any structural change (including innerHTML
    // resets and keystrokes), then we walk its block children and record
    // each one's offsetTop so the gutter can place numbers at the
    // matching vertical positions. No-op when showLineNumbers is false.
    useEffect(() => {
        if (!showLineNumbers) {
            setLineNumberPositions([]);
            return;
        }
        if (!editorRef.current) return;
        const recompute = () => {
            const surface = editorRef.current;
            if (!surface) return;
            const positions = [];
            let n = 0;
            for (const child of surface.children) {
                // Skip non-block elements that might slip in (e.g. a stray
                // inline <br> with no tag surrounding it shouldn't count
                // as a line). Real block tags include p, headings, etc.
                if (child.nodeType !== 1) continue;
                n += 1;
                positions.push({ n, top: child.offsetTop });
            }
            setLineNumberPositions(positions);
        };
        // Run once after current render, then observe.
        const raf = requestAnimationFrame(recompute);
        const observer = new MutationObserver(() => {
            // Coalesce bursts (typing) into one animation-frame recompute.
            requestAnimationFrame(recompute);
        });
        observer.observe(editorRef.current, {
            childList: true,
            subtree: true,
            characterData: true
        });
        // Also recompute on window resize (wrapped text changes heights).
        window.addEventListener('resize', recompute);
        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            window.removeEventListener('resize', recompute);
        };
    }, [showLineNumbers, value, editorFontSize]);

    // Scroll-sync: translate the gutter's inner container by the editor's
    // negative scrollTop so numbers stay aligned with their blocks as the
    // user scrolls.
    const handleSurfaceScroll = useCallback(() => {
        if (!gutterInnerRef.current || !editorRef.current) return;
        const y = editorRef.current.scrollTop;
        gutterInnerRef.current.style.transform = `translateY(${-y}px)`;
    }, []);

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
                editorFontSize={editorFontSize}
                onChangeFontSize={onChangeFontSize}
            />
            <div className="editor-body">
                {showLineNumbers ? (
                    <div className="editor-gutter" aria-hidden="true">
                        <div className="editor-gutter-inner" ref={gutterInnerRef}>
                            {lineNumberPositions.map(({ n, top }) => (
                                <span
                                    key={n}
                                    className="editor-lineno"
                                    style={{ top: `${top}px` }}
                                >
                                    {n}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}
                <div
                    ref={editorRef}
                    className={`editor-surface ${wrap ? 'wrap' : ''} ${showLineNumbers ? 'with-line-numbers' : ''}`}
                    style={editorFontSize ? { fontSize: `${editorFontSize}px` } : undefined}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onPaste={handlePaste}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    onScroll={handleSurfaceScroll}
                    spellCheck={false}
                />
            </div>
            {hoverFinding ? (
                <div
                    className={`lint-tooltip ${hoverFinding.severity || 'info'}`}
                    style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
                    role="dialog"
                    aria-label="Finding details"
                    // Hover-bridge: while the mouse is over the tooltip,
                    // cancel the pending close so buttons remain clickable.
                    onMouseEnter={cancelHideTooltip}
                    onMouseLeave={scheduleHideTooltip}
                >
                    <div className="lint-tooltip-message">{hoverFinding.message}</div>
                    {(onFixLater || onFixNow || onSuggestFixes) ? (
                        <div className="lint-tooltip-actions">
                            {onFixNow ? (
                                <button
                                    type="button"
                                    className="lint-tooltip-btn primary"
                                    disabled={fixInFlight}
                                    onClick={async () => {
                                        if (!onFixNow || fixInFlight) return;
                                        setFixInFlight(true);
                                        try {
                                            await onFixNow(hoverFinding);
                                        } finally {
                                            setFixInFlight(false);
                                            setSuggestedFixes(null);
                                            setHoverFinding(null);
                                        }
                                    }}
                                >
                                    {fixInFlight ? 'Fixing…' : 'Fix now'}
                                </button>
                            ) : null}
                            {onFixLater ? (
                                <button
                                    type="button"
                                    className="lint-tooltip-btn"
                                    disabled={fixInFlight}
                                    onClick={async () => {
                                        if (!onFixLater) return;
                                        await onFixLater(hoverFinding);
                                        setSuggestedFixes(null);
                                        setHoverFinding(null);
                                    }}
                                >
                                    Fix later
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    {onSuggestFixes ? (
                        <div className="lint-tooltip-suggestions">
                            <div className="lint-tooltip-suggestions-header">
                                <span>Suggested fixes</span>
                                {(suggestedFixes?.options?.length || suggestedFixes?.error) ? (
                                    <button
                                        type="button"
                                        className="lint-tooltip-link"
                                        onClick={() => setSuggestedFixes(null)}
                                    >
                                        Reject
                                    </button>
                                ) : null}
                            </div>
                            {suggestedFixes?.loading ? (
                                <div className="lint-tooltip-suggestions-status">Loading…</div>
                            ) : null}
                            {suggestedFixes?.error ? (
                                <div className="lint-tooltip-suggestions-status error">
                                    {suggestedFixes.error}
                                </div>
                            ) : null}
                            {(!suggestedFixes || (!suggestedFixes.loading && !suggestedFixes.options?.length && !suggestedFixes.error)) ? (
                                <button
                                    type="button"
                                    className="lint-tooltip-btn"
                                    disabled={fixInFlight}
                                    onClick={async () => {
                                        if (!onSuggestFixes || fixInFlight) return;
                                        const key = `${hoverFinding.start}-${hoverFinding.end}-${hoverFinding.source}`;
                                        setSuggestedFixes({ forKey: key, options: [], loading: true, error: null });
                                        const result = await onSuggestFixes(hoverFinding);
                                        if (!result?.ok) {
                                            setSuggestedFixes({
                                                forKey: key,
                                                options: [],
                                                loading: false,
                                                error: result?.error || 'Unable to fetch suggestions.'
                                            });
                                            return;
                                        }
                                        const options = Array.isArray(result.options)
                                            ? result.options.slice(0, 3)
                                            : [];
                                        setSuggestedFixes({
                                            forKey: key,
                                            options,
                                            loading: false,
                                            error: options.length ? null : 'No usable suggestions returned.'
                                        });
                                    }}
                                >
                                    Suggested fixes
                                </button>
                            ) : null}
                            {suggestedFixes?.options?.length ? (
                                <ol className="lint-tooltip-suggestions-list">
                                    {suggestedFixes.options.map((option, idx) => (
                                        <li key={`${hoverFinding.start}-${hoverFinding.end}-${idx}`}>
                                            <button
                                                type="button"
                                                className="lint-tooltip-suggestion-btn"
                                                disabled={fixInFlight}
                                                onClick={async () => {
                                                    if (!onApplySuggestedFix || fixInFlight) return;
                                                    setFixInFlight(true);
                                                    try {
                                                        await onApplySuggestedFix(hoverFinding, option);
                                                    } finally {
                                                        setFixInFlight(false);
                                                        setSuggestedFixes(null);
                                                        setHoverFinding(null);
                                                    }
                                                }}
                                            >
                                                {option}
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            ) : null}
                        </div>
                    ) : null}
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
