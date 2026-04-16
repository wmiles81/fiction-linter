---
id: editor-findings-overlay
title: Findings Overlay
category: Editor
order: 2
summary: Lint findings appear as colored underlines directly over your text. The underlines are drawn by the browser's CSS Custom Highlight API and never alter your document content.
keywords: underline, highlight, overlay, findings, colors, severity, css highlight api, lint
---

## Findings Overlay

After Fiction Linter scans your document, flagged passages appear as colored underlines drawn on top of your text in the editor. These underlines are purely visual — they do not add characters to your document and will not appear when you print or export.

### How the underlines are drawn

The overlay uses the browser's **CSS Custom Highlight API**, a modern browser feature that lets the app paint highlights over arbitrary text ranges without changing the DOM. This means:

- Your actual text is untouched at all times.
- Undo/redo is not affected by findings appearing or disappearing.
- Underlines update instantly when findings change — no re-render of the document.

### Severity colors

Each underline color corresponds to a severity level:

| Color | Severity | Examples |
|-------|----------|---------|
| Red | Error | Show-vs-tell, emotional telling |
| Orange | Warning | Weak phrasing, generic descriptors |
| Blue | Info | Over-explanation, unnecessary hedging |

See [Severity Colors](editor-severity-colors) for the full breakdown of which rules produce which colors.

### Showing and hiding the overlay

Use the **Findings** toggle button in the toolbar (top center of the window) to hide all underlines without deleting the findings. The scan results are preserved — toggling the overlay back on restores them instantly.

### Hovering a finding

Hover your cursor over any underlined passage to see a tooltip explaining the finding and offering **Fix Now** and **Fix Later** actions.

### See also

- [Severity Colors](editor-severity-colors)
- [Hover Tooltips](editor-hover-tooltips)
- [Findings Toggle](toolbar-findings-toggle)
