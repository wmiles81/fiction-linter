---
id: status-messages
title: Status Messages
category: Status Bar
order: 1
summary: The status bar at the bottom of the window shows real-time feedback about scans, saves, errors, and other app activity.
keywords: status bar, status messages, progress, scanning, saving, error, ready, rate limit, chunk
---

## Status Messages

The **status bar** runs along the very bottom of the Fiction Linter window. The left side displays short messages about what the app is currently doing or the result of the last action.

### Common messages and what they mean

| Message | What's happening |
|---------|-----------------|
| Ready | No scan is running; the document is idle. |
| Saved | The file and its sidecar files were written to disk successfully. |
| Linting... | The deterministic pattern linter is running. This is fast — usually less than a second. |
| AI Scan: chunk 3 of 12 | The AI Scan is in progress. The numbers show current chunk / total chunks. |
| Rate limited on chunk 4/16. Retrying in 6s... | Your AI model's rate limit was hit. The scanner will retry automatically. |
| AI Scan complete — 24 findings | The scan finished. The number is the total findings added by this scan. |
| AI Scan cancelled | You clicked the AI Scan button while it was running to stop it. |
| Finding is stale — document has changed since the scan | You tried Fix Now on a finding that no longer aligns with the current text. Re-scan to refresh. |
| Error saving file | The save failed (disk full, permissions issue, etc.). The message may include a brief reason. |
| Rules reloaded — 312 patterns | Re-lint completed; the number shows how many patterns were loaded from your SPE rules files. |

### Message timing

Most messages persist for a few seconds before clearing back to **Ready**. Error messages remain until you take an action or dismiss them.

### See also

- [AI Scan](toolbar-ai-scan)
- [Re-lint](toolbar-re-lint)
- [Word & Character Counts](status-word-char-counts)
