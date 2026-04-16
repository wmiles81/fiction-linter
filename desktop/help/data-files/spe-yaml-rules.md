---
id: data-files-spe-yaml
title: SPE YAML Rules
category: Data Files
order: 3
summary: The SPE rule files are plain YAML text you can read and edit in any text editor. Each file covers a different category of prose problems.
keywords: yaml, spe, rules, cliche_collider, name_collider, place_collider, line_editing_protocol, edit, custom
---

## SPE YAML Rules

The Semantic Physics Engine (SPE) reads its rules from four YAML files. When you point Fiction Linter at your own **SPE Rules Path** (in Settings), these files live in that folder. When you use the bundled defaults, the files are inside the app package and read-only.

### The four files

| File | What it governs |
|------|----------------|
| `cliche_collider.yaml` | Somatic cliches, AI tells, weak descriptors, emotion tells, purple prose |
| `name_collider.yaml` | Forbidden character first and last names (high-frequency AI defaults) |
| `place_collider.yaml` | Generic town, city, and fantasy location names |
| `line_editing_protocol.yaml` | Editorial principles and banned patterns for line editing |

### YAML structure

Each file uses top-level keys that group related rules. Under each key is a list of entries. A typical entry has a `phrase` (the text to match), a `penalty_score` (0.0–1.0, used to determine severity), and an optional `suggested_fix` explaining what to write instead.

```yaml
somatic_cliches:
  - phrase: "heart skipped a beat"
    penalty_score: 0.8
    suggested_fix: "Describe the physical jolt of surprise directly."
```

The `name_collider.yaml` and `place_collider.yaml` files use flat lists under `forbidden_first_names`, `forbidden_last_names`, `forbidden_town_names`, and similar keys.

### Editing rules safely

1. Copy the bundled defaults out of the app package to a working folder.
2. Open the file in any plain-text editor.
3. Add, remove, or adjust entries following the existing structure.
4. In Settings, point the **SPE Rules Path** at your folder.
5. Click **Re-lint** in the toolbar to see the new rules applied to your current document.

### See also

- [SPE Rules Path](settings-spe-path)
- [Customizing Rules](spe-customizing-rules)
- [How the SPE Works](spe-how-it-works)
