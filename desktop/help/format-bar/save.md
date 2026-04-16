---
id: format-save
title: Save
category: Format Bar
order: 1
summary: Writes the current document to disk as a markdown file and creates a findings.json sidecar alongside it. Press Cmd+S (Mac) or Ctrl+S (Windows/Linux).
keywords: save, write, disk, markdown, sidecar, findings, json, cmd+s, ctrl+s
---

## Save

Click **Save** in the format bar (the bar directly above the editor) or press **Cmd+S** (Mac) / **Ctrl+S** (Windows/Linux) to save the current document.

### What gets written

Saving does two things:

1. **Writes the markdown file** — your prose is saved to the file path shown in the tab at the top. The file is written as plain markdown (`.md`).
2. **Writes the findings sidecar** — a `filename.findings.json` file is created alongside your document. This snapshot captures all current findings (both deterministic and AI) at save time. The status bar confirms: `Saved. 14 findings snapshot → /path/to/chapter-01.findings.json`.

### Why a separate findings file?

The findings sidecar lets you track how a document's issues change between editing sessions, compare findings across drafts using standard diff tools, and share structured finding data without embedding metadata in your prose.

### When the Save button is greyed out

The button is disabled when the document has no unsaved changes. It re-enables as soon as you make any edit.

### Imported files

If you opened a `.docx` or `.gdoc` file, Save writes a new `.md` file next to the original. The original `.docx` or `.gdoc` pointer file is never overwritten.

### See also

- [Findings JSON](data-files-findings-json)
- [Word Document Import](file-tree-docx-import)
- [Google Docs Import](file-tree-gdoc-import)
