# Fiction Linter

<p align="center">
  <img src="images/banner.jpg" alt="The future writes in ink and code" width="600">
</p>

**Fiction Linter** is a VS Code extension designed to act as a **Semantic Physics Engine (SPE)** for your fiction writing. It helps you avoid "First Probability" prose—generic, clichéd, or AI-sounding text—by rigorously checking your manuscript against a set of constraints.

## Installation

### From the VS Code Extension Marketplace

1.  Open VS Code.
2.  Go to the **Extensions** view (`Cmd+Shift+X` on macOS / `Ctrl+Shift+X` on Windows/Linux).
3.  Search for **"Fiction Linter"**.
4.  Click **Install**.

Or install from the command line:

```bash
code --install-extension ocotillo-quill-press-llc.fiction-linter
```

### From a Local `.vsix` File

If you have a pre-built `.vsix` package (e.g., `fiction-linter-1.0.1.vsix`):

**Option A — Via the VS Code UI:**

1.  Open the **Extensions** view (`Cmd+Shift+X` / `Ctrl+Shift+X`).
2.  Click the **`···`** menu (top-right of the Extensions panel).
3.  Select **"Install from VSIX…"**.
4.  Browse to and select the `.vsix` file.
5.  Reload VS Code when prompted.

**Option B — Via the command line:**

```bash
code --install-extension path/to/fiction-linter-1.0.1.vsix
```

> **Tip:** To build a `.vsix` from source, run `npx @vscode/vsce package` from the project root. This requires [Node.js](https://nodejs.org/) and will produce a `.vsix` file you can share or install.

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

## AI Features
This extension includes AI-powered tools to help you fix prose issues:
*   **Fix with AI**: Click "Quick Fix" on any squiggly line to have AI rewrite the sentence.
*   **Deep Scan (AI Scan)**:
    *   **Button**: Click the **`$(search) AI Scan`** button in the status bar (bottom left).
    *   **Scope**:
        *   **Chapter Mode**: If your cursor is inside a chapter (marked by `## Chapter X`), it scans *only* that chapter.
        *   **Full Mode**: If no characters are detected, it scans the entire document.
    *   **Progressive**: Scans in background chunks (default 5 paragraphs) so you can keep working.
    *   **Cancel**: Click the button again (`$(sync~spin) Stop Scan`) to cancel immediately.

**Configuration:**
The extension attempts to use available VS Code Copilot models first. If none are found, you can configure a direct connection to OpenAI:
1.  `fiction-linter.openAiKey`: Your OpenAI API Key.
2.  `fiction-linter.modelName`: (Optional) Model to use (default: `gpt-4`).
3.  `fiction-linter.apiBaseUrl`: (Optional) Custom endpoint (default: OpenAI).
4.  `fiction-linter.autoAiScanChunkSize`: Number of paragraphs to scan at once (default: 5). Increase for faster scans if your API limits allow.

## Requirements

-   VS Code 1.100.0 or higher.
-   A local copy of the Semantic Physics Engine data files.

## Release Notes

### 0.1.5
-   **AI Scan Button**: Added status bar button to trigger progressive AI scanning.
-   **Chapter Detection**: Scans are now scoped to the current chapter.
-   **Bug Fixes**: Improved Markdown activation and stability.

### 0.0.1
-   Initial release.
-   Support for Cliche Collider, Name Collider, and Place Collider.

---
**Enjoy writing high-entropy fiction!**
