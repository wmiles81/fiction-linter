---
id: format-font-size
title: Font Size
category: Format Bar
order: 6
summary: Increases or decreases the editor's display font size using the A− and A+ buttons. Range is 12–28 px in 2 px steps. Your preference persists across restarts.
keywords: font size, a+, a-, increase, decrease, text size, readability, persist, zoom
---

## Font Size

The **A−** and **A+** buttons at the right side of the format bar (directly above the editor) adjust the size of the text displayed in the editor.

### Range and steps

| Control | Action | Range |
|---------|--------|-------|
| **A−** | Decrease by 2 px | Down to 12 px minimum |
| **A+** | Increase by 2 px | Up to 28 px maximum |

The current size is shown between the two buttons (for example, `16px`). The buttons disable automatically at the minimum and maximum so you cannot accidentally overshoot the range.

### What font size controls

Font size affects only the editor display — it does not change anything in the saved markdown file. Your prose always saves as plain text regardless of how large or small it looks on screen.

The line-number gutter (if enabled) scales with the text so the numbers stay aligned with their paragraphs at any size.

### Persistence

Your chosen font size is saved in the app's local storage. It is restored the next time you open Fiction Linter, even after a restart. The default size is 16 px.

### If you need larger text

The **A+** maximum of 28 px covers most desktop reading preferences. For sizes beyond that, use your operating system's display scaling or accessibility zoom.

### See also

- [Line Numbers](toolbar-line-numbers)
- [Wrap](format-wrap)
