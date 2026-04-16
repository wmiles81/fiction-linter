---
id: editor-editing-text
title: Editing Text
category: Editor
order: 1
summary: The editor is a fully editable writing surface. Type directly in the document, paste from any source, and format with the format bar. Your text is stored as markdown.
keywords: edit, type, paste, contenteditable, wysiwyg, markdown, formatting, clipboard
---

## Editing Text

The main editing area (center of the window, filling most of the screen) is a live, editable document. Click anywhere in the text and start typing.

### How it works under the hood

The editor is a WYSIWYG surface backed by markdown. When you open a `.md` file, the raw markdown is converted to styled text for display. When you save (**Cmd+S** on Mac, **Ctrl+S** on Windows/Linux), the styled text is converted back to clean markdown and written to disk. You never need to type markdown syntax manually — use the format bar instead.

### Typing and editing

- Type directly to insert text at the cursor.
- Use **Delete** / **Backspace**, arrow keys, and standard selection shortcuts exactly as you would in any writing app.
- **Cmd+A** (Mac) / **Ctrl+A** (Windows/Linux) selects all text in the current document.

### Pasting text

Paste from your clipboard with **Cmd+V** (Mac) / **Ctrl+V** (Windows/Linux). The editor strips incompatible HTML formatting (web page styles, font sizes, colors) and keeps only the structure that maps cleanly to markdown: bold, italic, headings, and paragraph breaks. Paste from Word or Google Docs works well — tables are simplified to plain paragraphs.

To paste as plain text with no formatting at all, use **Cmd+Shift+V** (Mac) / **Ctrl+Shift+V** (Windows/Linux).

### Markdown round-trip

If you open the same file in a plain text editor or version-control system, it reads as normal markdown. Fiction Linter does not add proprietary markup to your files.

### See also

- [Save](format-save)
- [Undo / Redo](format-undo-redo)
- [Paragraph Style](format-paragraph-style)
