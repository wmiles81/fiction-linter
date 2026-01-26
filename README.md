# Fiction Linter

**Fiction Linter** is a VS Code extension designed to act as a **Semantic Physics Engine (SPE)** for your fiction writing. It helps you avoid "First Probability" prose—generic, clichéd, or AI-sounding text—by rigorously checking your manuscript against a set of constraints.

## Features

-   **Pattern Linter**: Detects and flags:
    -   **Cliches**: Overused phrases (e.g., "shiver down spine", "released a breath").
    -   **AI Tells**: Structural patterns common in AI writing (e.g., "It is worth noting", "couldn't help but").
    -   **Weak Phrasing**: Vague descriptors or lack of sensory precision.
-   **Name & Place Validator**:
    -   Checks character names against a blocklist of overused AI names.
    -   Flags generic or clichéd place names (e.g., "Willow Creek", "Ironpeak").

## Visual Guide

The extension uses standard VS Code diagnostic colors to indicate the severity of the issue:

-   **<span style="color:red">Red Squiggles (Error)</span>**: **Strict Bans & AI Patterns**.
    -   *Examples*: "shiver down his spine", "It is worth noting that", "walls I've built".
    -   **Action**: These must be removed or rewritten.

-   **<span style="color:orange">Yellow Squiggles (Warning)</span>**: **Cliches, Tells, & Names**.
    -   *Examples*: "released a breath", "felt sad", "Kael", "Willow Creek".
    -   **Action**: Avoid these unless strictly necessary or contextually justified.

-   **<span style="color:blue">Blue Squiggles (Info)</span>**: **Weak Phrasing & Style**.
    -   *Examples*: "very", "just", "practiced ease".
    -   **Action**: Consider strengthening the prose with more specific descriptors.

## Configuration

**Zero Config:** By default, the extension comes with a bundled set of standard Semantic Physics Engine rules (Cliches, Names, etc.). You don't need to do anything to start linting!

**Advanced (Custom Rules):**
If you have your own customized SPE definitions (YAML files), you can point the extension to them:

1.  Open VS Code Settings (`Cmd+,`).
2.  Search for `Fiction Linter`.
3.  Set the `Spe Path` to the absolute path of your directory containing the `.yaml` files.
    *   Example: `/Users/yourname/projects/my-spe-config`

The extension looks for:
*   `cliche_collider.yaml`
*   `name_collider.yaml`
*   `place_collider.yaml`
*   `line_editing_protocol.yaml`

## Requirements

-   VS Code 1.100.0 or higher.
-   A local copy of the Semantic Physics Engine data files.

## Release Notes

### 0.0.1
-   Initial release.
-   Support for Cliche Collider, Name Collider, and Place Collider.

---
**Enjoy writing high-entropy fiction!**
