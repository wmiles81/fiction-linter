---
id: status-cursor-position
title: Cursor Position & Findings Count
category: Status Bar
order: 3
summary: The right side of the status bar shows your cursor's line and column position, and the total number of findings in the current document.
keywords: cursor position, line number, column, ln, findings count, status bar
---

## Cursor Position & Findings Count

The **right side of the status bar** (bottom of the window) displays two pieces of information: where your cursor is in the document, and how many findings are currently active.

### Cursor position — Ln X:Y

The cursor position is displayed as **Ln 14:32**, meaning line 14, column 32 (character position within that line, counting from 1).

- **Line** counts visual paragraphs from the top of the document.
- **Column** counts characters from the start of the line to the cursor. Wrapped lines count as a single line.

This is helpful for navigating large documents, discussing specific passages with collaborators, or orienting yourself after jumping to a finding.

### Findings count

Next to the cursor position you'll see a count like **12 findings**. This is the total number of active findings across the entire document — not just the visible viewport.

- The count updates immediately when a scan completes or when you apply **Fix Now** to a finding.
- If you've hidden the overlay with the **Findings** toggle, the count still shows how many findings exist — the underlines are just invisible.
- A count of **0 findings** after a successful scan means the document is clean.

### Right-click for context help

Right-click anywhere on the cursor position or findings count area to see a mini-popup summarizing this feature.

### See also

- [Word & Character Counts](status-word-char-counts)
- [Findings Toggle](toolbar-findings-toggle)
- [Next Finding](toolbar-next-finding)
