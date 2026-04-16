---
id: editor-fix-now
title: Fix Now
category: Editor
order: 3
summary: Ask the AI for a rewrite of the flagged phrase and apply it immediately. The original text and replacement are logged to the annotation file.
keywords: fix, rewrite, replace, ai, annotation, undo
---

## Fix Now

When you hover a finding in the editor, a tooltip appears with **Fix Now** and **Fix Later** buttons.

Clicking **Fix Now**:

1. Sends the flagged phrase (plus surrounding context) to your AI model.
2. The AI returns three alternative phrasings.
3. The first alternative replaces the flagged text in your document.
4. Both the original and the replacement are logged to the `.annotation.md` sidecar file.
5. The finding's underline disappears — confirming the fix was applied.

### If the fix doesn't look right

Press **Cmd+Z** (Mac) or **Ctrl+Z** (Windows/Linux) immediately to undo. The original text is restored. The annotation file still records the attempt.

### Stale findings

If you've edited the document since the last scan, the flagged text may have shifted. Fiction Linter detects this and refuses the fix with a clear message: "Finding is stale — the document has changed since the scan." Run **Re-lint** or **AI Scan** again to refresh findings.

### See also

- [Fix Later](editor-fix-later)
- [Annotation File](data-files-annotation-md)
- [Hover Tooltips](editor-hover-tooltips)
