---
id: toolbar-lint-toggle
title: Lint Toggle
category: Toolbar
order: 3
summary: Enables or disables the deterministic linter. The button label always shows what will happen next — "Lint off" means linting is currently on.
keywords: lint, toggle, enable, disable, linter, on, off
---

## Lint Toggle

The **Lint on / Lint off** button in the toolbar (top center, in the second group of controls) switches the deterministic linter on and off.

### Understanding the label

The label shows the *next* action — what will happen when you click it:

| Label shows | Linting is currently | Click to… |
|-------------|---------------------|-----------|
| Lint off    | On (active)         | Turn linting off |
| Lint on     | Off (inactive)      | Turn linting back on |

This is the same "future state" convention used throughout the toolbar.

### When linting is on

The deterministic linter runs automatically as you type (with a short delay). Underline highlights appear on flagged phrases. The findings count in the status bar updates as you make changes.

### When linting is off

All deterministic underlines are cleared from the document. No new findings are generated while you type. AI Scan findings that were already present remain visible — they come from a separate system and are unaffected by this toggle.

Turning the linter off is useful when you want a distraction-free view of the prose without any markings, or when you are making large structural edits and do not want the scan running continuously.

### Re-enabling linting

Click **Lint on** to restore the linter. A fresh scan runs automatically within a fraction of a second.

### See also

- [Findings Toggle](toolbar-findings-toggle)
- [Re-lint](toolbar-re-lint)
