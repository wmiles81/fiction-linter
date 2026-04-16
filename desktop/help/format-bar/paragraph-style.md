---
id: format-paragraph-style
title: Paragraph Style
category: Format Bar
order: 3
summary: Applies a block-level style to the paragraph containing the cursor — Paragraph (normal prose), Heading 1, Heading 2, or Heading 3.
keywords: paragraph, heading, h1, h2, h3, style, block, format, chapter
---

## Paragraph Style

The **paragraph style dropdown** in the format bar (directly above the editor, to the right of the Undo/Redo buttons) sets the block-level style of the paragraph where the cursor is currently placed.

### Available styles

| Option | Use for |
|--------|---------|
| Paragraph | Normal prose — the default for most of your document |
| Heading 1 | Top-level titles, such as part titles or act headings |
| Heading 2 | Chapter titles |
| Heading 3 | Scene or section headings within a chapter |

### How to apply a style

1. Click anywhere inside the paragraph you want to change.
2. Open the dropdown (it shows the current style of the cursor's paragraph).
3. Select a style. The paragraph updates immediately.

### In the saved file

Paragraph styles round-trip cleanly to markdown. Heading 1 becomes `#`, Heading 2 becomes `##`, and Heading 3 becomes `###`. Normal paragraphs have no prefix. When you reopen the file, the styles are restored from the markdown.

### Changing multiple paragraphs

Select text spanning several paragraphs, then choose a style. All paragraphs within the selection change to the chosen style.

### See also

- [Save](format-save)
- [Bold, Italic, Underline](format-bold-italic-underline)
