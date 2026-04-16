---
id: format-undo-redo
title: Undo / Redo
category: Format Bar
order: 2
summary: Steps backward or forward through your editing history. Press Cmd+Z to undo and Cmd+Shift+Z to redo (Mac), or Ctrl+Z / Ctrl+Shift+Z (Windows/Linux).
keywords: undo, redo, history, cmd+z, ctrl+z, revert, step back
---

## Undo / Redo

The **↶** (undo) and **↷** (redo) buttons in the format bar (directly above the editor, second group from the left) step through your editing history.

### Keyboard shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|----------------|
| Undo   | **Cmd+Z** | **Ctrl+Z** |
| Redo   | **Cmd+Shift+Z** | **Ctrl+Shift+Z** |

### What undo and redo cover

Undo and redo track all text changes made in the editor: typing, deleting, pasting, formatting, scene break insertions, and paragraph style changes. Each undoable step corresponds to a discrete change in the document.

### What is not undoable

- Saving a file (the file on disk is not affected by undo).
- Opening or closing tabs.
- Changes to Settings or the theme picker.

### When the buttons are greyed out

- **↶** is disabled when there is nothing left to undo (you are at the oldest state in the history).
- **↷** is disabled when there is nothing to redo (no changes have been undone, or you have made a new edit after undoing).

### See also

- [Bold, Italic, Underline](format-bold-italic-underline)
- [Scene Break](format-scene-break)
