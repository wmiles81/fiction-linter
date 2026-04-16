---
id: toolbar-next-finding
title: Next Finding
category: Toolbar
order: 6
summary: Jumps the editor cursor to the next finding after the current cursor position, in document order. Wraps back to the first finding when you reach the end.
keywords: next, finding, navigate, jump, cursor, cycle, wrap
---

## Next Finding

Click **Next ›** in the toolbar (top center, in the rightmost group) to jump directly to the next finding in the document.

### How navigation works

Each click moves the cursor to the finding that starts *closest after* your current cursor position, regardless of that finding's severity. When you reach the last finding in the document, the next click wraps back to the very first one — so you can cycle through every issue without losing your place.

Severity is used only as a tiebreaker: if two findings start at the exact same position, the more severe one is visited first.

### Starting point

The jump uses wherever your cursor currently sits in the editor. Click anywhere in the document, then press **Next ›** to start navigating forward from that point.

### When the button is disabled

**Next ›** is greyed out when there are no visible findings. This happens when:

- The linter is off (see [Lint Toggle](toolbar-lint-toggle)).
- Findings are hidden (see [Findings Toggle](toolbar-findings-toggle)).
- The document is clean — no issues were detected.

### Keyboard shortcut

There is no default keyboard shortcut for Next Finding. For a full list of available shortcuts, see [Keyboard Shortcuts](keyboard-shortcuts-shortcuts).

### See also

- [Findings Toggle](toolbar-findings-toggle)
- [Hover Tooltips](editor-hover-tooltips)
- [Severity Colors](editor-severity-colors)
