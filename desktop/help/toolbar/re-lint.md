---
id: toolbar-re-lint
title: Re-lint
category: Toolbar
order: 2
summary: Reloads your SPE rules from disk and immediately re-runs the deterministic linter over the current document. Use after editing your YAML rule files.
keywords: re-lint, relint, reload, rules, spe, deterministic, pattern, refresh, yaml
---

## Re-lint

Click **Re-lint** in the toolbar (top center, to the right of AI Scan) to reload your SPE rules from disk and re-run the full deterministic scan on the current document.

### When to use it

The deterministic linter loads your rule files once when the app starts. If you edit your YAML rules in another editor and want the changes to take effect immediately — without restarting Fiction Linter — click **Re-lint**.

It also helps if the initial load failed silently (for example, because your SPE path wasn't configured yet when the app launched).

### What it does

1. Reads all YAML rule files from the path set in **Settings → SPE Rules Path**.
2. Counts the rules found across all four colliders (Cliché, Name, Place, and Line Editing Protocol).
3. Triggers a fresh lint pass against the current document content.
4. Reports the rule count in the status bar at the bottom of the window: `Re-lint: reloaded 412 rules. Findings will refresh shortly.`

Findings update within a fraction of a second (the lint pass has a short debounce).

### If Re-lint is greyed out or reports zero rules

- The linter must be enabled. If the **Lint off** button is visible in the toolbar, linting is currently off — turn it on first.
- If Re-lint reports `0 rules loaded`, check that your SPE path is set correctly in Settings and that the folder contains files like `cliche_collider.yaml`.

### See also

- [SPE Rules Path](settings-spe-path)
- [Lint Toggle](toolbar-lint-toggle)
- [Customizing Rules](spe-rules-customizing-rules)
