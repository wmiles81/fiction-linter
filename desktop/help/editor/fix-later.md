---
id: editor-fix-later
title: Fix Later
category: Editor
order: 4
summary: Flag a finding for later attention without changing your text. The finding is logged to the annotation sidecar file so you can review it in a separate editing pass.
keywords: fix later, annotation, log, defer, sidecar, review, finding
---

## Fix Later

When you hover a finding in the editor, a tooltip appears with **Fix Now** and **Fix Later** buttons. Clicking **Fix Later** records the finding without touching your text.

### What Fix Later does

1. The flagged phrase, its category, and its location in the document are written to the `.annotation.md` sidecar file alongside your manuscript.
2. The underline in the editor changes to a dimmer shade, indicating you've acknowledged the finding.
3. Your text is left exactly as written.

### When to use it

Fix Later is useful when you're in a flow state and don't want to break your focus with an AI rewrite. Come back to the annotation file during a revision pass to work through deferred findings in bulk.

### The annotation file

The `.annotation.md` file (visible in the file tree next to your document after the first use) is plain markdown you can read in any text editor. Each entry records:

- The flagged text
- The rule that caught it
- The paragraph location
- The timestamp of your Fix Later action

You can hand the annotation file to an AI assistant for a batch revision conversation, or simply work through it manually.

### Clearing acknowledged findings

Re-running **Re-lint** or **AI Scan** refreshes the findings list. Passages you've already fixed will no longer appear. Findings you marked Fix Later but didn't address will reappear if they are still present in the document.

### See also

- [Fix Now](editor-fix-now)
- [Annotation File](data-files-annotation-md)
- [Hover Tooltips](editor-hover-tooltips)
