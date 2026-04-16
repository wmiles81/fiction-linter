---
id: data-files-annotation-md
title: Annotation Markdown
category: Data Files
order: 2
summary: Fix Later logs a finding to a .annotation.md sidecar file without touching your prose. The file is plain markdown you can read, edit, and share with an AI.
keywords: annotation, fix later, sidecar, markdown, log, ai, review, findings
---

## Annotation Markdown

When you click **Fix Later** on a finding tooltip, Fiction Linter appends a note to a sidecar file next to your document. If your document is `chapter-01.md`, the annotation file is `chapter-01.annotation.md`. It appears in the file tree after the first Fix Later entry is added.

### File format

The annotation file is plain markdown. Each entry looks like this:

```markdown
## Fix Later — warning

**Rule:** cliche-somatic
**Text:** "heart skipped a beat"
**Location:** word 142
**Message:** Somatic cliche. Describe the physical jolt directly.

---
```

**Fix Now** entries are also recorded, showing what the AI replaced and what it wrote:

```markdown
## Fix Now — info

**Rule:** weak-descriptor
**Original:** "very quickly"
**Replacement:** "in seconds"
**Location:** word 89

---
```

### Reading the file

The annotation file is a running log in the order you reviewed your document. Open it any time to review what you have deferred, or to check what rewrites the AI made in a session.

### Handing it to an AI

The file was designed to be pasted directly into a conversation with an AI assistant. Ask: "Here are the issues I deferred in my chapter. Suggest fixes." The plain text format means no special parsing is needed.

### Editing the file

You can open `chapter-01.annotation.md` in Fiction Linter's editor, add your own notes, delete entries you have already resolved, or reorganize the list. It is just a text file.

### See also

- [Fix Later](editor-fix-later)
- [Fix Now](editor-fix-now)
- [Findings JSON](data-files-findings-json)
