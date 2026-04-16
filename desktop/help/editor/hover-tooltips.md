---
id: editor-hover-tooltips
title: Hover Tooltips
category: Editor
order: 6
summary: Hovering over any underlined finding opens a tooltip that names the rule, shows the flagged text, and offers Fix Now and Fix Later buttons.
keywords: tooltip, hover, fix now, fix later, finding, explanation, rule, popup
---

## Hover Tooltips

Every colored underline in the editor is interactive. Move your cursor over a flagged passage and a small tooltip card appears, anchored just above the underlined text.

### What the tooltip shows

- **Rule name** — the name of the rule that flagged this passage (e.g., "Show vs. Tell," "Weak Phrasing")
- **Flagged text** — the exact phrase that triggered the finding, highlighted in the tooltip
- **Explanation** — a brief note on why this phrase was flagged and what to consider instead
- **Fix Now** button — sends the phrase to your AI model for an immediate rewrite
- **Fix Later** button — logs the finding to the annotation file without changing your text

### Keeping the tooltip open

The tooltip stays visible as long as your cursor is anywhere within the tooltip card or over the underlined text. There is a small hover bridge between the underlined text and the tooltip card so you can move your cursor up to the buttons without the tooltip closing.

### Dismissing the tooltip

Move your cursor away from both the underlined text and the tooltip card. The tooltip fades out automatically.

### Tooltips and the findings toggle

If you have hidden the findings overlay using the **Findings** toggle in the toolbar, underlines are invisible and tooltips will not appear. Re-enable the overlay to interact with findings again.

### Keyboard navigation

You can also navigate findings without hovering. Use the **Next** button in the toolbar (top center) to move the cursor to the next finding in document order. The tooltip for that finding opens automatically.

### See also

- [Fix Now](editor-fix-now)
- [Fix Later](editor-fix-later)
- [Next Finding](toolbar-next-finding)
- [Findings Toggle](toolbar-findings-toggle)
