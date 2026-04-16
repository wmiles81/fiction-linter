---
id: editor-severity-colors
title: Severity Colors
category: Editor
order: 5
summary: Three underline colors indicate how urgently a finding needs attention. Red means a craft-level problem, orange means a style weakness, blue means an informational note.
keywords: severity, colors, red, orange, blue, error, warning, info, show-vs-tell, emotional telling, weak, generic
---

## Severity Colors

Fiction Linter uses three underline colors to show how significant a finding is. Colors let you triage at a glance before reading every tooltip.

### Red — Error

Red underlines mark the most impactful issues: passages that break the craft-level principle of showing rather than telling, or that substitute reported emotion for dramatized feeling.

Common red findings:

- **Show-vs-tell** — "She felt terrified" instead of rendered physical reaction or action
- **Emotional telling** — labeling a character's internal state directly ("He was furious," "She was relieved")
- Somatic cliches that signal AI-generated prose ("His heart raced," "Her stomach dropped")

These are called **errors** because they typically weaken reader immersion and are worth fixing before submission.

### Orange — Warning

Orange underlines mark style weaknesses that soften prose without necessarily breaking it.

Common orange findings:

- **Weak phrasing** — hedging verbs ("seemed to," "appeared to"), throat-clearing ("it was clear that")
- **Generic descriptors** — vague modifiers ("very," "quite," "really," "extremely") with no specific image behind them
- AI-default vocabulary that signals unoriginal word choice

These are **warnings** — worth reviewing, but a judgment call per instance.

### Blue — Info

Blue underlines are low-urgency observations that may or may not need action.

Common blue findings:

- **Over-explanation** — restating something the reader already understands from context
- Redundant dialogue tags or stage business
- Structural notes from the line-editing protocol

Blue findings are **informational** — read the tooltip and decide whether the note applies to your specific passage.

### See also

- [Findings Overlay](editor-findings-overlay)
- [Hover Tooltips](editor-hover-tooltips)
- [AI Scan](toolbar-ai-scan)
