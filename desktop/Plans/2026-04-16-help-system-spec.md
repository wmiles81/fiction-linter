# Fiction Linter Desktop — Help System Spec

**Date:** 2026-04-16
**Status:** Draft — pending user review

---

## 1. Overview

Two deliverables from one source:

1. **In-app help tab** — opens in the editor tab bar like a document, with a topic navigation tree and searchable content. Context-sensitive: right-clicking any toolbar button shows a mini-popup with a summary and a "More..." link that opens the help tab at that section.

2. **External user manual** — a static HTML page generated from the same markdown source files, hosted on the product website. Always matches the current release.

Both are generated from a single set of markdown files with YAML frontmatter, so content is written once and rendered twice.

---

## 2. Help Content Source

### 2.1 File Structure

```
desktop/help/
  getting-started/
    01-opening-a-manuscript.md
    02-first-scan.md
    03-understanding-findings.md
  toolbar/
    ai-scan.md
    re-lint.md
    lint-toggle.md
    findings-toggle.md
    line-numbers.md
    next-finding.md
  format-bar/
    save.md
    undo-redo.md
    paragraph-style.md
    bold-italic-underline.md
    scene-break.md
    font-size.md
    wrap.md
  file-tree/
    opening-folders.md
    file-types.md
    gdoc-import.md
    docx-import.md
  editor/
    editing-text.md
    findings-overlay.md
    fix-now.md
    fix-later.md
    severity-colors.md
    hover-tooltips.md
  status-bar/
    status-messages.md
    word-char-counts.md
    cursor-position.md
  settings/
    spe-path.md
    ai-provider.md
    api-key.md
    model-picker.md
    hyperparameters.md
  themes/
    overview.md
    parchment.md
    midnight.md
    sepia.md
    high-contrast.md
  data-files/
    findings-json.md
    annotation-md.md
    spe-yaml-rules.md
  spe-rules/
    how-spe-works.md
    cliche-collider.md
    name-collider.md
    place-collider.md
    line-editing-protocol.md
    customizing-rules.md
  licensing/
    activation.md
    deactivation.md
    offline-use.md
  keyboard-shortcuts/
    shortcuts.md
```

### 2.2 File Format

Each markdown file has YAML frontmatter:

```markdown
---
id: toolbar-ai-scan
title: AI Scan
category: Toolbar
order: 1
summary: Run an AI-powered scan to find show-vs-tell violations, weak phrasing, and other issues the deterministic linter cannot catch.
keywords: scan, ai, findings, openrouter, free model, chunking
---

## AI Scan

Click **AI Scan** in the toolbar to start a paragraph-by-paragraph
AI analysis of the current document.

### How it works

The scanner splits your document into chunks of approximately 2,000
words (aligned to paragraph boundaries) and sends each chunk to your
configured AI model...

### Rate limiting and retries

Free OpenRouter models may rate-limit at 10-20 requests per minute...
```

Fields:
- `id` — unique identifier, used for deep-linking and context-sensitive lookup
- `title` — display name in the navigation tree and mini-popup header
- `category` — groups topics in the navigation tree (matches the directory name)
- `order` — sort position within the category (1, 2, 3...)
- `summary` — 1-2 sentence description shown in the right-click mini-popup
- `keywords` — space-separated terms for search indexing (in addition to title + body)

### 2.3 Content Guidelines

- Write for a fiction writer, not a developer. No jargon without explanation.
- Every UI element mentioned should include its visual location: "the **AI Scan** button in the toolbar (top center of the window)."
- Include screenshots or annotated references where helpful (images stored in `desktop/help/images/` and referenced as `![alt](images/filename.png)`).
- Keyboard shortcuts mentioned inline: "Press **Cmd+S** (Mac) or **Ctrl+S** (Windows/Linux) to save."
- Each topic is self-contained — a user arriving via right-click context help should understand the topic without reading prerequisites. Cross-reference other topics via links: `[see Model Picker](settings-model-picker)`.

---

## 3. In-App Help Tab

### 3.1 Help Tab Component

File: `src/components/HelpTab.jsx`

The help tab renders inside the existing editor tab area. When the user clicks the **?** icon, presses **F1**, or clicks "More..." in a context popup, a tab titled "Help" opens (or switches to if already open) showing:

```
┌─────────────────────────────────────────────────────┐
│  Help  ×                                            │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  🔍 Search   │  ## AI Scan                          │
│  ──────────  │                                      │
│              │  Click **AI Scan** in the toolbar     │
│  ▾ Getting   │  to start a paragraph-by-paragraph   │
│    Started   │  AI analysis of the current document. │
│    Opening   │                                      │
│    First sc  │  ### How it works                    │
│    Understa  │                                      │
│              │  The scanner splits your document... │
│  ▾ Toolbar   │                                      │
│    AI Scan ← │  ### Rate limiting and retries       │
│    Re-lint   │                                      │
│    Lint tog  │  Free OpenRouter models may rate-    │
│              │  limit at 10-20 requests per minute  │
│  ▸ Format    │                                      │
│  ▸ Editor    │                                      │
│  ▸ Settings  │                                      │
│  ▸ SPE Rules │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

- **Left pane**: navigation tree built from categories and topics. Categories are collapsible. Current topic is highlighted. Search box at the top filters topics by title + keywords + body text.
- **Right pane**: rendered markdown content (using the existing remark/rehype pipeline from `converters.js`).
- **Deep-linking**: when opened via context help or "More..." link, the topic ID scrolls the nav tree to the relevant item and renders its content.

### 3.2 Help Data Loading

At build time (or on first open), the app reads all markdown files from `desktop/help/`, parses frontmatter, and builds an index:

```js
[
  {
    id: 'toolbar-ai-scan',
    title: 'AI Scan',
    category: 'Toolbar',
    order: 1,
    summary: 'Run an AI-powered scan...',
    keywords: ['scan', 'ai', 'findings', ...],
    body: '## AI Scan\n\nClick **AI Scan**...'
  },
  ...
]
```

**Loading strategy**: the help markdown files are bundled with the app as static assets (included in electron-builder's `files` config). A main-process IPC handler (`help:load`) reads the directory, parses each file's frontmatter + body, and returns the index. The renderer caches it in memory — help content doesn't change during a session.

### 3.3 Search

Client-side search over the cached index. For each query:
1. Split query into lowercase terms
2. For each topic, check if ALL terms appear in `title + keywords.join(' ') + body` (case-insensitive)
3. Rank by: title match > keyword match > body match
4. Display matching topics in the nav tree, hiding non-matches

No external search library needed — the corpus is small (50-70 topics, each a few hundred words). A simple `includes()` check is fast enough.

### 3.4 Navigation Tree

Built from the help index:
- Group topics by `category`
- Sort categories by the order of their first topic's `order` field (or alphabetically as fallback)
- Within each category, sort by `order`
- Categories are collapsible; the category containing the current topic auto-expands

Category display order (matching the directory structure):
1. Getting Started
2. Toolbar
3. Format Bar
4. File Tree
5. Editor
6. Status Bar
7. Settings
8. Themes
9. Data Files
10. SPE Rules
11. Licensing
12. Keyboard Shortcuts

---

## 4. Context-Sensitive Help (Mini-Popup)

### 4.1 Trigger

**Right-click** on any toolbar button, format bar button, status bar metric, or other documented UI element.

The browser's default context menu is suppressed (`e.preventDefault()` on `contextmenu` event) and replaced with the help mini-popup.

### 4.2 Mini-Popup Component

File: `src/components/HelpPopup.jsx`

A small dark card (similar in style to the existing lint tooltip) anchored above the right-clicked element:

```
┌──────────────────────────────────┐
│  Re-lint                         │
│                                  │
│  Reloads SPE rules from disk     │
│  and re-runs the deterministic   │
│  pattern + name lint. Use after  │
│  editing your YAML rules.        │
│                                  │
│  More... →                       │
└──────────────────────────────────┘
```

- **Title**: topic `title` from frontmatter
- **Body**: topic `summary` from frontmatter
- **"More..." link**: opens/switches to the Help tab at this topic
- **Dismiss**: click outside, press Escape, or right-click another element
- **Positioning**: anchored to the element's bounding rect (same pattern as the lint tooltip — above the element, centered)

### 4.3 Topic ID Mapping

Each UI element that supports context help carries a `data-help-id` attribute matching a topic's `id` field:

```jsx
<button
    data-help-id="toolbar-ai-scan"
    onClick={handleToggleAiScan}
    ...
>
    AI Scan
</button>
```

The `contextmenu` handler:
1. Walks up from `e.target` looking for the nearest `[data-help-id]` ancestor
2. If found, looks up the topic by ID in the cached index
3. Renders the mini-popup with the topic's title + summary
4. If not found, falls back to the browser's default context menu

### 4.4 Elements that get `data-help-id`

| Element | `data-help-id` |
|---------|----------------|
| AI Scan button | `toolbar-ai-scan` |
| Re-lint button | `toolbar-re-lint` |
| Lint on/off toggle | `toolbar-lint-toggle` |
| Show/Hide findings toggle | `toolbar-findings-toggle` |
| Line #s toggle | `toolbar-line-numbers` |
| Next button | `toolbar-next-finding` |
| Theme picker | `themes-overview` |
| Settings gear | `settings-overview` |
| Save button (format bar) | `format-save` |
| Undo/Redo buttons | `format-undo-redo` |
| Paragraph style dropdown | `format-paragraph-style` |
| B/I/U buttons | `format-bold-italic-underline` |
| Scene break button | `format-scene-break` |
| A-/A+ buttons | `format-font-size` |
| Wrap toggle | `format-wrap` |
| Word/char count | `status-word-char-counts` |
| Cursor position | `status-cursor-position` |
| Findings count | `status-findings-count` |
| ? icon (help button) | — (opens help tab directly, no popup) |

---

## 5. Help Access Points

| Trigger | Action |
|---------|--------|
| **? icon** in top bar (right side, next to theme picker) | Opens Help tab at table of contents |
| **F1** key (global) | Same as ? icon |
| **Right-click** any element with `data-help-id` | Shows mini-popup with summary + "More..." |
| **Help → Fiction Linter Help** menu item | Opens Help tab |
| **Help → Online Documentation** menu item | Opens external HTML manual in browser via `shell.openExternal` |
| **"More..."** link in mini-popup | Opens Help tab scrolled to that topic |

---

## 6. External User Manual

### 6.1 Build Process

A Node script (`scripts/build-manual.js`) reads all markdown files from `desktop/help/`, concatenates them in category + order sequence, and renders through remark/rehype into a single styled HTML page.

The output is a self-contained HTML file (`manual/index.html`) with:
- Embedded CSS (same theme as the Parchment theme for visual consistency)
- Table of contents with anchor links
- All topic content rendered as sections
- Print-friendly CSS (`@media print` rules)
- No external dependencies (works offline once downloaded)

### 6.2 Manual Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Fiction Linter Desktop — User Manual</title>
  <style>/* embedded CSS */</style>
</head>
<body>
  <header>
    <h1>Fiction Linter Desktop</h1>
    <p>User Manual — v1.0.0</p>
  </header>
  <nav id="toc">
    <h2>Table of Contents</h2>
    <ul>
      <li><a href="#getting-started">Getting Started</a>
        <ul>
          <li><a href="#toolbar-ai-scan">AI Scan</a></li>
          ...
        </ul>
      </li>
      ...
    </ul>
  </nav>
  <main>
    <section id="getting-started">
      <h2>Getting Started</h2>
      ...
    </section>
    ...
  </main>
</body>
</html>
```

### 6.3 Hosting

The HTML file is:
- Uploaded to the product website (linked from Help → Online Documentation)
- Regenerated on each release (`npm run build:manual` in the release workflow)
- Version-stamped in the header so users know which release it documents

### 6.4 Build Script

Add to `package.json` scripts:
```json
"build:manual": "node scripts/build-manual.js"
```

---

## 7. Help Content Topics (Complete List)

### Getting Started (3 topics)
1. **Opening a Manuscript** — how to use Open Folder, file tree navigation, supported file types (.md, .txt, .docx, .gdoc), folder persistence across restarts
2. **Your First Scan** — running the deterministic lint (auto on open), running AI Scan, what the underline colors mean
3. **Understanding Findings** — severity levels (error/warning/info), hover tooltips, Fix Now vs Fix Later, the annotation file, the findings JSON

### Toolbar (6 topics)
4. **AI Scan** — what it does, chunking, rate-limit retries, progress indicator, cancel, free models
5. **Re-lint** — reloads SPE rules from disk, forces deterministic re-scan, when to use it
6. **Lint Toggle** — enables/disables the deterministic linter, label shows future state
7. **Findings Toggle** — shows/hides underline overlays without disabling the linter
8. **Line Numbers** — toggles the gutter, paragraph-level numbering, scroll sync
9. **Next Finding** — cycles through all findings in document order, wraps at end

### Format Bar (7 topics)
10. **Save** — writes markdown to disk + findings.json sidecar, Cmd+S shortcut
11. **Undo / Redo** — standard undo/redo via document.execCommand
12. **Paragraph Style** — dropdown for Paragraph, Heading 1/2/3
13. **Bold, Italic, Underline** — inline formatting, Cmd+B/I/U shortcuts
14. **Scene Break** — inserts a horizontal rule (--- in markdown)
15. **Font Size** — A-/A+ buttons, 12-28px range, persists across sessions
16. **Wrap** — toggles soft line wrapping in the editor

### File Tree (4 topics)
17. **Opening Folders** — Open button, folder persistence, ancestor highlighting
18. **Supported File Types** — which files are clickable (.md, .txt, .docx, .gdoc) vs disabled
19. **Google Docs Import** — .gdoc pointer files, sign-in flow, inline import, session persistence
20. **Word Document Import** — .docx via mammoth, HTML-to-markdown conversion, table handling

### Editor (6 topics)
21. **Editing Text** — contenteditable WYSIWYG, markdown round-trip, paste handling
22. **Findings Overlay** — CSS Custom Highlight API, severity colors (red/orange/blue)
23. **Fix Now** — AI rewrite, phrase-level replacement, annotation logging, stale-finding guard
24. **Fix Later** — logs finding to annotation file without changing text
25. **Severity Colors** — error (red) = show-vs-tell / emotional telling, warning (orange) = weak / generic, info (blue) = over-explanation
26. **Hover Tooltips** — anchored to flagged range, hover-bridge for button access, Fix Now / Fix Later buttons

### Status Bar (3 topics)
27. **Status Messages** — what the messages mean (scan progress, save confirmation, error diagnostics)
28. **Word & Character Counts** — computed from editor content, selection metrics
29. **Cursor Position & Findings Count** — Ln X:Y display, total findings count

### Settings (5 topics)
30. **SPE Rules Path** — Browse button, rule count preview, bundled defaults, custom rules
31. **AI Provider** — OpenRouter, OpenAI, Anthropic, Ollama selection
32. **API Key** — where to paste it, security (stored in Electron userData, never sent to our servers)
33. **Model Picker** — sort modes (provider, cost, context, newest, free only), FREE badge, context window display
34. **Hyperparameters** — temperature, top_p, max_tokens, reasoning_effort — what each does for fiction writing

### Themes (5 topics)
35. **Theme Overview** — four themes, how to switch, persistence
36. **Parchment** — warm afternoon desk, the default
37. **Midnight** — dark navy/amber for late-night writing
38. **Sepia** — aged-book tan/burgundy for long drafts
39. **High Contrast** — maximum legibility, WCAG-level

### Data Files (3 topics)
40. **Findings JSON** — schema, when it's written (on save), deterministic ordering, word numbers, how to use for diffing/CI
41. **Annotation Markdown** — format, Fix Now/Fix Later entries, handing to an AI for review
42. **SPE YAML Rules** — file names, structure, how to add/edit patterns

### SPE Rules (6 topics)
43. **How the SPE Works** — deterministic regex matching, the PatternLinterCore + NameValidatorCore pipeline, SPE as "Semantic Physics Engine"
44. **Cliche Collider** — what it catches (somatic cliches, AI tells, weak descriptors, banned phrases), severity mapping, examples
45. **Name Collider** — forbidden first/last names, why these are flagged (high-frequency AI defaults), how to customize
46. **Place Collider** — generic town/city/fantasy location names, alternatives
47. **Line Editing Protocol** — editorial guidelines, banned AI patterns, rules vs examples
48. **Customizing Rules** — creating your own YAML, adding patterns, testing with Re-lint

### Licensing (3 topics)
49. **Activation** — entering a key, LemonSqueezy validation, persistence
50. **Deactivation** — transferring to another machine, Help → Deactivate License
51. **Offline Use** — 30-day grace window, re-validation on reconnect

### Keyboard Shortcuts (1 topic)
52. **Shortcuts Reference** — complete table of all keyboard shortcuts by context (global, editor, dialogs)

**Total: 52 topics across 12 categories.**

---

## 8. File Manifest

### New Files

| File | Purpose |
|------|---------|
| `desktop/help/**/*.md` | 52 help topic source files |
| `desktop/help/images/` | Screenshots and annotated images |
| `src/components/HelpTab.jsx` | Help tab with nav tree + content pane |
| `src/components/HelpTab.test.jsx` | Tests for help tab rendering + search |
| `src/components/HelpPopup.jsx` | Context-sensitive mini-popup |
| `src/components/HelpPopup.test.jsx` | Tests for popup rendering + dismiss |
| `scripts/build-manual.js` | Generates standalone HTML manual from help markdown |
| `manual/index.html` | Generated output (not committed — build artifact) |

### Modified Files

| File | Changes |
|------|---------|
| `electron/main.js` | IPC handler `help:load` reads help directory and returns parsed index |
| `electron/preload.js` | Expose `loadHelpTopics()` and `getHelpTopic(id)` |
| `src/App.jsx` | ? icon in top bar, F1 handler, contextmenu handler for `data-help-id`, open help tab |
| `src/store/useEditorStore.js` | Open the help tab as a non-file tab (`path: null, name: 'Help'`) — same pattern as untitled tabs, no schema change |
| `src/test/setup.js` | Stubs for help IPC methods |
| `src/styles.css` | HelpTab layout + HelpPopup styles |
| `electron/menu.js` | Add "Fiction Linter Help" and "Online Documentation" to Help menu |
| `package.json` | `build:manual` script, help files in electron-builder `files` config |
| Various toolbar/format-bar components | Add `data-help-id` attributes to buttons |

---

## 9. Implementation Order

1. **Help content authoring** — write all 52 markdown files with frontmatter
2. **Help data loading** — IPC handler to read + parse the help directory
3. **Help tab component** — nav tree, search, content rendering
4. **Context-sensitive popup** — `data-help-id` attributes, contextmenu handler, popup component
5. **? icon + F1 hotkey** — top bar icon, global keyboard shortcut
6. **Menu updates** — Help menu items
7. **External manual build script** — `scripts/build-manual.js`
8. **Polish** — cross-references between topics, screenshots, final review

---

## 10. What's NOT in This Spec

- Video tutorials (post-v1.0)
- Interactive walkthroughs / guided tours (post-v1.0)
- In-app feedback / "Was this helpful?" (post-v1.0)
- Localization / translation (post-v1.0)
- AI-powered help search ("ask a question about the app") (post-v1.0)
