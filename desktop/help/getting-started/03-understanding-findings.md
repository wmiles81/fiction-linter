---
id: getting-started-findings
title: Understanding Findings
category: Getting Started
order: 3
summary: Findings appear as colored underlines in your text. Hover to see the rule, severity, and suggested fix. Use Fix Now to rewrite with AI or Fix Later to log without changing text.
keywords: findings, severity, error, warning, info, underline, tooltip, fix now, fix later, annotation, hover
---

## Understanding Findings

After a lint pass runs, Fiction Linter marks flagged text with colored underlines directly in the editor. These are called **findings**.

### Severity levels

Each finding has a severity that tells you how urgent the issue is:

| Color | Severity | Meaning |
|-------|----------|---------|
| Red underline | **Error** | High-priority problems — show-vs-tell violations, strong emotional tells, banned AI patterns |
| Orange underline | **Warning** | Should-fix issues — somatic cliches, overused phrases, generic descriptors |
| Blue underline | **Info** | Consider-fixing suggestions — weak intensifiers ("very," "really"), dialogue crutches, minor patterns |

You can choose to focus on errors first, then work through warnings and info findings as time permits.

### Hover tooltips

Hover your cursor over any underlined text to see a tooltip anchored to that range. The tooltip shows:

- The **rule name** that triggered the finding
- A **message** explaining why the text was flagged
- A **suggested fix** (where the rule provides one)
- Two action buttons: **Fix Now** and **Fix Later**

The tooltip stays open as long as your cursor is near it, so you have time to read the suggestion and click a button.

### Fix Now

Click **Fix Now** in the tooltip to send the flagged phrase to the AI for a rewrite. The AI replaces the phrase in place, following the [Line Editing Protocol](spe-line-editing). The change is logged to your annotation file. This requires an AI provider to be configured in Settings.

### Fix Later

Click **Fix Later** to dismiss the tooltip without changing your text. The finding is logged to the **annotation file** (`chapter-01.annotation.md`) next to your document, so you have a record of every deferred issue. Nothing in your prose changes.

### The annotation file

The annotation file is a plain markdown log of all Fix Now and Fix Later actions in the current session. Open it in Fiction Linter's editor any time to review your deferred list, or paste it into a conversation with an AI assistant for a batch review.

### The findings JSON

Every time you save, a `.findings.json` sidecar file is written next to your document with a machine-readable record of all current findings. Use it to track progress across drafts or run automated checks.

### See also

- [Findings Overlay](editor-findings-overlay)
- [Annotation Markdown](data-files-annotation-md)
- [Findings JSON](data-files-findings-json)
- [How the SPE Works](spe-how-it-works)
