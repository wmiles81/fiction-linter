---
id: data-files-findings-json
title: Findings JSON
category: Data Files
order: 1
summary: Every time you save, Fiction Linter writes a sidecar .findings.json file next to your document. It records every finding with its position, severity, and rule.
keywords: findings, json, sidecar, schema, save, word number, position, severity, diff, ci
---

## Findings JSON

Each time you save a document (**Cmd+S** on Mac / **Ctrl+S** on Windows/Linux), Fiction Linter writes a sidecar file alongside your manuscript. If your document is `chapter-01.md`, the sidecar is `chapter-01.findings.json`. This file appears in the file tree next to your document.

### What it contains

The file is an array of finding objects. Each object includes the rule that fired, the severity level, the exact matched text, word numbers from the start of the document, and character offsets for precise positioning.

| Field | Meaning |
|-------|---------|
| `ruleId` | Which rule triggered the finding |
| `message` | Human-readable description |
| `severity` | `error`, `warning`, or `info` |
| `startWord` / `endWord` | Word numbers from the start of the document (1-based) |
| `startOffset` / `endOffset` | Character offsets for precise positioning |
| `matchedText` | The exact text that was flagged |

### Ordering

Findings are written in document order (by character offset), so the file is deterministic — the same document produces the same JSON every time. This makes it easy to diff two versions of the same chapter and see which problems were resolved.

### How to use it

- **Track progress over time** — compare findings counts between drafts to see whether your revision is reducing issues.
- **CI / automated checks** — a build script can parse the JSON and fail if error-severity findings remain before submission.
- **Hand to an AI** — paste the array into a conversation with an AI assistant to get a summary of your manuscript's pattern problems.

### See also

- [Annotation Markdown](data-files-annotation-md)
- [Understanding Findings](getting-started-findings)
