---
id: spe-customizing-rules
title: Customizing Rules
category: SPE Rules
order: 6
summary: Create your own SPE YAML files to add phrases you want to catch, remove names that are legitimate in your story, and tune penalty scores to your genre.
keywords: custom, yaml, rules, add, edit, pattern, re-lint, test, penalty, phrase, personal
---

## Customizing Rules

Fiction Linter's SPE rules are plain YAML files you can read and edit in any text editor. Customizing them lets you catch phrases specific to your own writing habits, remove names that are valid in your story, or add genre-specific patterns the bundled defaults do not cover.

### Step 1 — Get a copy of the defaults

The bundled rule files ship inside the app package. Copy them out to a working folder on your machine. A good location is something like `~/Documents/my-spe-rules/`. The four files to copy are:

- `cliche_collider.yaml`
- `name_collider.yaml`
- `place_collider.yaml`
- `line_editing_protocol.yaml`

### Step 2 — Edit the files

Open any file in a plain-text editor. The structure is straightforward: top-level keys group categories of rules, and each rule is a list entry with at minimum a `phrase` and a `penalty_score`.

To **add a new pattern**, append an entry under the relevant category:

```yaml
weak_descriptors:
  - phrase: "suddenly"
    penalty_score: 0.4
    suggested_fix: "Delete or rewrite the sentence to show the surprise."
```

To **remove a name**, find the entry in `name_collider.yaml` and delete it from the list.

### Step 3 — Point Settings at your folder

1. Open **Settings** (gear icon, top-right, or **Cmd+,** / **Ctrl+,**).
2. Set **SPE Rules Path** to your custom folder.
3. The rule count preview updates to show how many rules loaded.
4. Click **Save Settings**.

### Step 4 — Test with Re-lint

Click **Re-lint** in the toolbar (top of the editor area). The linter reloads from disk and immediately rescans the current document with your updated rules. Check the findings overlay to confirm your new patterns are firing as expected.

### Tips

- Keep your `penalty_score` between 0.3 and 1.0. Scores below 0.3 may not generate visible findings.
- The `suggested_fix` field is optional but shown in the finding tooltip — it is worth filling in for patterns where the right fix is non-obvious.
- YAML is whitespace-sensitive. Use spaces (not tabs) for indentation.

### See also

- [SPE Rules Path](settings-spe-path)
- [SPE YAML Rules](data-files-spe-yaml)
- [How the SPE Works](spe-how-it-works)
