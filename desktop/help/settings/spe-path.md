---
id: settings-spe-path
title: SPE Rules Path
category: Settings
order: 1
summary: Point Fiction Linter at a folder of custom SPE YAML files, or leave blank to use the rules bundled with the app.
keywords: spe, rules, path, yaml, custom, browse, defaults, cliche_collider, name_collider, place_collider
---

## SPE Rules Path

The **SPE Rules Path** field is the first setting in the **Studio Settings** dialog (open it with **Cmd+,** on Mac or **Ctrl+,** on Windows/Linux, or by clicking the gear icon in the top-right corner of the window).

### Bundled defaults

Leave the field blank and Fiction Linter uses the rules that ship with the app — `cliche_collider.yaml`, `name_collider.yaml`, `place_collider.yaml`, and `line_editing_protocol.yaml`. These cover hundreds of somatic cliches, AI-default character names, generic locations, and editorial patterns. Most writers can start here without changing anything.

### Using your own rules

If you maintain a personal `SPE-Config` folder:

1. Click **Browse…** next to the path field.
2. Select the folder that contains your YAML files.
3. The field fills in automatically.
4. A rule count preview appears below the field — for example, "Loaded: 47 cliche rules, 312 name rules, 89 place rules, 14 protocol entries." If the count reads zero, double-check that the folder contains files with the expected names.
5. Click **Save Settings**.

Changes take effect immediately — you do not need to restart the app. If you want to re-lint your current document with the new rules, click **Re-lint** in the toolbar.

### Reverting to defaults

Clear the path field and click **Save Settings** to switch back to the bundled rules.

### See also

- [How the SPE Works](spe-how-it-works)
- [SPE YAML Rules](data-files-spe-yaml)
- [Customizing Rules](spe-customizing-rules)
