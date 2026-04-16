---
id: format-scene-break
title: Scene Break
category: Format Bar
order: 5
summary: Inserts a horizontal rule (---) at the cursor position to mark a scene or section break in the narrative.
keywords: scene break, horizontal rule, divider, separator, section, hr, em dash
---

## Scene Break

Click the **—** (em-rule) button in the format bar (directly above the editor) to insert a scene break at the current cursor position.

### What it inserts

A scene break is a horizontal rule — rendered as a visual dividing line in the editor and saved as `---` (three hyphens on their own line) in the markdown file. This is standard markdown for a thematic break between scenes or sections.

### How to use it

1. Place the cursor at the end of the paragraph where the scene ends, or at the start of a blank line between scenes.
2. Click the **—** button. The break is inserted as its own block.

### In the saved file

The `---` line in markdown becomes a `<hr>` element in HTML and renders as a horizontal rule in any markdown-compatible viewer. Most publishing pipelines and word-processor paste-in flows recognize it as a section separator.

### Removing a scene break

Select the `---` line in the editor and press **Delete** or **Backspace**, or use **Undo** (Cmd+Z / Ctrl+Z) immediately after inserting it.

### See also

- [Undo / Redo](format-undo-redo)
- [Save](format-save)
