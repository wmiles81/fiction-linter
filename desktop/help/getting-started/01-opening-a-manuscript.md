---
id: getting-started-opening
title: Opening a Manuscript
category: Getting Started
order: 1
summary: Open a folder containing your manuscript files to start linting. The app remembers your last folder across restarts.
keywords: open, folder, file tree, manuscript, browse, directory
---

## Opening a Manuscript

Fiction Linter works with folders of manuscript files. To get started:

1. Click **Open** in the top-left panel header, or use **Cmd+Shift+O** (Mac) / **Ctrl+Shift+O** (Windows/Linux).
2. Select a folder that contains your manuscript files (.md, .txt, .docx, or .gdoc).
3. The file tree appears on the left, showing all files in the folder.

### Supported file types

| Extension | What happens when you click it |
|-----------|-------------------------------|
| `.md`, `.markdown` | Opens as editable markdown |
| `.txt` | Opens as editable plain text |
| `.docx` | Imported via mammoth (converted to markdown) |
| `.gdoc` | Google Docs inline import (sign-in may be required) |
| Other files | Shown in the tree but grayed out (not editable) |

### Folder persistence

The app remembers the last folder you opened. When you relaunch, the file tree automatically shows that folder's contents — no need to re-open it.

### File tree navigation

- Click a **folder** to expand or collapse it.
- Click a **file** to open it in a new tab.
- The currently-open file is highlighted. Its parent folders are subtly highlighted as a breadcrumb trail.
- **Sidecar files** (`.findings.json`, `.annotation.md`) appear alongside your documents after you save or use Fix Later.

### See also

- [Supported File Types](file-tree-file-types)
- [Google Docs Import](file-tree-gdoc-import)
- [Word Document Import](file-tree-docx-import)
