---
id: spe-how-it-works
title: How the SPE Works
category: SPE Rules
order: 1
summary: The Semantic Physics Engine uses deterministic regex matching to flag cliches, weak phrasing, AI tells, forbidden names, and generic locations in your prose.
keywords: spe, semantic physics engine, regex, pattern, deterministic, linting, rules
---

## How the SPE Works

The **Semantic Physics Engine (SPE)** is the deterministic linting system behind Fiction Linter. Unlike the AI Scan (which sends text to a language model), the SPE runs entirely on your machine, instantly, with no API calls.

### What it checks

The SPE scans your prose against four sets of rules:

| Rule Set | File | What it catches |
|----------|------|-----------------|
| **Cliche Collider** | `cliche_collider.yaml` | Overused phrases ("shiver down spine"), AI structural patterns ("It is worth noting"), weak descriptors ("very"), emotional tells ("felt sad") |
| **Name Collider** | `name_collider.yaml` | High-frequency AI-default character names (Kael, Luna, Aria, Blackwood) |
| **Place Collider** | `place_collider.yaml` | Generic AI-generated locations (Willow Creek, Ironpeak, Kingdom of Eldoria) |
| **Line Editing Protocol** | `line_editing_protocol.yaml` | Editorial guidelines and banned patterns for line editing |

### How matching works

Each rule is a regex pattern with word boundaries. When the pattern matches text in your document, a finding is generated with:

- **Severity**: error (must fix), warning (should fix), or info (consider fixing)
- **Category**: which rule set flagged it
- **Message**: why it was flagged and what to do about it

### Customizing rules

You can point Fiction Linter at your own SPE rule files:

1. Open **Settings** (gear icon, top right).
2. Set the **SPE Rules Path** to a folder containing your YAML files.
3. The rule count preview shows how many rules loaded.
4. Click **Re-lint** to apply the new rules immediately.

### See also

- [Cliche Collider](spe-cliche-collider)
- [Name Collider](spe-name-collider)
- [Customizing Rules](spe-customizing-rules)
- [SPE Rules Path](settings-spe-path)
