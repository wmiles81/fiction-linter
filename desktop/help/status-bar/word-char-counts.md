---
id: status-word-char-counts
title: Word & Character Counts
category: Status Bar
order: 2
summary: The status bar shows the total word and character count for the open document. When you select text, the counts update to reflect the selection.
keywords: word count, character count, selection, metrics, status bar, stats
---

## Word & Character Counts

In the **status bar** at the bottom of the window, you'll see a readout like **1,842 words · 10,304 chars**. This reflects the current document's content.

### How counts are calculated

Counts are computed from the editor's live content — not the saved file on disk. They update as you type, paste, or delete text. The word count uses whitespace-delimited splitting (the same method most word processors use), so hyphenated compounds count as one word.

Character count includes all visible characters and spaces but excludes markdown syntax characters (asterisks, hashes, underscores used for formatting). You're counting prose, not markup.

### Selection metrics

Highlight any passage with your cursor and the counts change to show only the selected text:

**142 words selected · 784 chars selected**

This is useful for checking the length of a scene, a chapter, or a specific passage you're considering cutting.

When you deselect (click elsewhere or press Escape), the counts return to the full document totals.

### Right-click for context help

Right-click the word/char count area in the status bar to see a mini-popup with a summary of this feature and a link to this help topic.

### See also

- [Cursor Position & Findings Count](status-cursor-position)
- [Status Messages](status-messages)
