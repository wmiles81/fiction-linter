---
id: file-tree-docx-import
title: Word Document Import
category: File Tree
order: 4
summary: Click a .docx file in the tree to convert it to markdown via mammoth and open it in the editor. A sibling .md file is created on save — the original .docx is never overwritten.
keywords: docx, word, import, mammoth, convert, markdown, table, formatting
---

## Word Document Import

Click any `.docx` file in the file tree to import it into Fiction Linter. The document is converted to markdown automatically and opens in a new editor tab.

### How the conversion works

Fiction Linter uses a library called mammoth to extract the content of the Word file. Mammoth converts Word's formatting to clean HTML, which Fiction Linter then converts to markdown using the same pipeline that handles pasted content. The result is standard prose markdown: paragraphs, headings, bold, and italic — ready for editing and linting.

### What converts well

- Body paragraphs and headings
- Bold and italic text
- Lists (bulleted and numbered)
- Footnotes (converted to inline text)

### Table handling

Tables are flattened into paragraphs. Each row becomes a paragraph, with the cell values joined by ` | `. The grid structure is not preserved, but the text content is. This is intentional: Fiction Linter is a prose editor, and complex table round-trips would complicate the editor without much benefit for fiction writers.

If your Word file contains important tables (such as a character sheet), review those sections after import and reformat them as needed.

### Saving after import

The imported content opens as a tab with a `.md` path that sits next to the original `.docx` file — for example, `chapter-01.docx` imports as `chapter-01.md`. When you press **Save** (Cmd+S / Ctrl+S), the markdown is written to the `.md` path. The original `.docx` is never touched.

### Conversion warnings

If mammoth encounters unsupported Word styles, a note appears in the status bar. The import still completes — warnings are informational only.

### See also

- [Supported File Types](file-tree-file-types)
- [Save](format-save)
- [Google Docs Import](file-tree-gdoc-import)
