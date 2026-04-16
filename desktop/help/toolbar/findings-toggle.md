---
id: toolbar-findings-toggle
title: Findings Toggle
category: Toolbar
order: 4
summary: Shows or hides the colored underline overlays in the editor without disabling the linter itself. Findings are still tracked in the background when hidden.
keywords: findings, toggle, show, hide, underlines, overlay, highlights, visible
---

## Findings Toggle

The **Show findings / Hide findings** button in the toolbar (top center, next to Lint Toggle) controls whether colored underlines appear in the editor.

### How it differs from the Lint Toggle

| Button | What it controls |
|--------|-----------------|
| Lint Toggle | Whether the linter runs at all |
| Findings Toggle | Whether the underlines are *visible* |

When you hide findings, the linter continues running silently in the background. The moment you click **Show findings** again, all current underlines reappear instantly — nothing needs to be recalculated.

### When to hide findings

- When you want to read or proofread without visual noise from underlines.
- When presenting your draft on screen.
- When copying a section to another application and the highlights feel distracting.

### When findings are hidden

- The findings count in the status bar still shows the total number of issues.
- Hover tooltips do not appear (there is nothing to hover over).
- Fix Now and Fix Later are not accessible until you show findings again.
- The **Show findings / Hide findings** button is disabled when the linter is off — you need to enable linting first.

### See also

- [Lint Toggle](toolbar-lint-toggle)
- [Hover Tooltips](editor-hover-tooltips)
- [Severity Colors](editor-severity-colors)
