---
id: toolbar-ai-scan
title: AI Scan
category: Toolbar
order: 1
summary: Run an AI-powered scan across the current document to find show-vs-tell violations, weak phrasing, and other issues the deterministic linter cannot catch.
keywords: scan, ai, findings, openrouter, free model, chunking, rate limit, retry
---

## AI Scan

Click **AI Scan** in the toolbar (top center) to start a paragraph-by-paragraph AI analysis of the current document.

### How it works

1. The scanner splits your document into chunks of approximately 2,000 words, aligned to paragraph boundaries.
2. Each chunk is sent to your configured AI model (set in Settings).
3. The AI returns findings — flagged phrases with categories like "show-vs-tell," "weak phrasing," or "emotional telling."
4. Findings appear as colored underlines in the editor, just like the deterministic pattern findings.

### Progress and cancellation

- The button shows **AI Scan: 42%** while scanning.
- Click the button again while scanning to **cancel**.
- The status bar shows which chunk is being processed.

### Rate limiting

Free OpenRouter models may rate-limit at 10-20 requests per minute. When this happens:

- The scanner automatically retries with exponential backoff (3s, 6s, 12s).
- The status bar shows "Rate limited on chunk 4/16. Retrying in 6s..."
- After 3 retries, the chunk is marked as failed and the scan continues.

### Using free models

OpenRouter frequently offers powerful models at no cost. In Settings, use the **Free only** filter in the model picker to see what's available. Free models work well for AI Scan — the per-paragraph analysis doesn't require enormous context windows.

### After the scan

- Findings persist across restarts (saved in the `.findings.json` sidecar on save).
- Hover any finding to see the AI's explanation.
- Use **Fix Now** or **Fix Later** from the hover tooltip.

### See also

- [AI Provider Settings](settings-ai-provider)
- [Model Picker](settings-model-picker)
- [Fix Now](editor-fix-now)
- [Fix Later](editor-fix-later)
