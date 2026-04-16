---
id: file-tree-file-types
title: Supported File Types
category: File Tree
order: 2
summary: Markdown (.md, .markdown), plain text (.txt), Word documents (.docx), and Google Docs pointers (.gdoc) are all clickable. All other file types appear in the tree but cannot be opened.
keywords: file types, extensions, md, txt, docx, gdoc, markdown, supported, disabled, eligible
---

## Supported File Types

The file tree shows every file in your manuscript folder — but only certain file types can be opened in the editor.

### Clickable file types

| Extension | What happens when you click |
|-----------|---------------------------|
| `.md` / `.markdown` | Opens directly in the editor as markdown prose |
| `.txt` | Opens directly in the editor as plain text |
| `.docx` | Converts to markdown via mammoth, then opens in the editor ([see Word Document Import](file-tree-docx-import)) |
| `.gdoc` | Fetches the document from Google Drive and opens it in the editor ([see Google Docs Import](file-tree-gdoc-import)) |

### Disabled file types

Any file with an extension not in the list above is shown in the tree but rendered as disabled (greyed out). Clicking a disabled file does nothing. A tooltip on the file says "File type not supported for editing."

Common disabled types include images (`.png`, `.jpg`), PDFs, spreadsheets, and code files. They are shown so you have a complete picture of your project folder, but Fiction Linter does not edit them.

### Subfolders

Folders are always clickable — clicking them expands or collapses the folder. Whether the files *inside* a folder are editable depends on each file's extension.

### See also

- [Opening Folders](file-tree-opening)
- [Word Document Import](file-tree-docx-import)
- [Google Docs Import](file-tree-gdoc-import)
