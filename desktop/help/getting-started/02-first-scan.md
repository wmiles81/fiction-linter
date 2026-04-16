---
id: getting-started-first-scan
title: Your First Scan
category: Getting Started
order: 2
summary: Fiction Linter runs a fast deterministic lint automatically when you open a file. You can also trigger a deeper AI Scan at any time. This topic explains what happens during each scan and what the underline colors mean.
keywords: scan, lint, first scan, deterministic, ai scan, underlines, colors, findings, getting started
---

## Your First Scan

As soon as you open a manuscript file in Fiction Linter, the app automatically runs the **deterministic linter** — a fast pattern-based scan that checks your text against hundreds of built-in rules covering weak phrasing, cliche language, and common AI-generated prose patterns.

### The automatic lint (deterministic scan)

When a file finishes loading:

1. The linter runs in the background — typically less than a second for a full chapter.
2. Flagged passages appear as colored underlines in the editor.
3. The status bar (bottom of the window) briefly shows "Linting..." then "X findings."
4. The findings count on the right side of the status bar shows the total.

You don't need to click anything. The scan runs automatically every time you open a file.

### Running the AI Scan

The deterministic scan catches patterns it knows about. The **AI Scan** goes further — it reads your prose and finds issues that require understanding context, such as whether a sentence is genuinely showing a character's state or merely telling it.

To run an AI Scan:

1. Click **AI Scan** in the toolbar (top center of the window).
2. The button shows progress: **AI Scan: 42%**.
3. When complete, any new findings appear as additional colored underlines.

AI Scan requires an API key in Settings. Free models on OpenRouter work well for this.

### What the colors mean

| Color | Severity | Common causes |
|-------|----------|--------------|
| Red underline | Error | Show-vs-tell, emotional telling |
| Orange underline | Warning | Weak phrasing, generic descriptors |
| Blue underline | Info | Over-explanation, redundant text |

Hover any underline to read the tooltip explaining what was flagged and why.

### Next steps

- Hover a red finding and click **Fix Now** to see an AI-suggested rewrite.
- Click **Fix Later** to log a finding for a revision pass without changing your text.
- Use the **Next** button in the toolbar to cycle through all findings in order.

### See also

- [Severity Colors](editor-severity-colors)
- [Hover Tooltips](editor-hover-tooltips)
- [AI Scan](toolbar-ai-scan)
- [Fix Now](editor-fix-now)
