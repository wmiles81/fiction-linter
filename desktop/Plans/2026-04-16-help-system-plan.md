# Help System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a searchable in-app help tab, context-sensitive right-click popups, and an external HTML user manual — all from a single set of 52 markdown source files.

**Architecture:** Help content lives as markdown files with YAML frontmatter in `desktop/help/`. A main-process IPC handler reads and parses them into an index. The renderer caches the index and uses it for the HelpTab (nav tree + rendered content), HelpPopup (right-click summary), and search. A Node build script generates a standalone HTML manual from the same source. No external dependencies beyond what the app already uses (remark/rehype, js-yaml).

**Tech Stack:** Electron 34, React 18, remark/rehype (existing), js-yaml (existing), Vitest + React Testing Library.

**Spec:** `desktop/Plans/2026-04-16-help-system-spec.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `desktop/help/**/*.md` | 52 help topic source files (YAML frontmatter + markdown body) |
| `electron/helpLoader.js` | Reads `help/` directory, parses frontmatter, returns topic index |
| `electron/helpLoader.test.js` | Unit tests for help loading + parsing |
| `src/components/HelpTab.jsx` | Help tab: nav tree (left), content pane (right), search |
| `src/components/HelpTab.test.jsx` | Tests: renders nav, selects topic, search filters |
| `src/components/HelpPopup.jsx` | Right-click context mini-popup |
| `src/components/HelpPopup.test.jsx` | Tests: renders summary, dismiss on Escape, "More..." link |
| `scripts/build-manual.js` | Generates `manual/index.html` from help markdown |

### Modified Files

| File | Changes |
|------|---------|
| `electron/main.js` | `help:load` IPC handler using helpLoader |
| `electron/preload.js` | Expose `loadHelp()` |
| `src/App.jsx` | ? icon, F1 handler, contextmenu for `data-help-id`, help tab opening |
| `src/components/editor/EditorToolbar.jsx` | Add `data-help-id` to format bar buttons |
| `src/components/StatusBar.jsx` | Add `data-help-id` to metrics |
| `src/styles.css` | HelpTab + HelpPopup styles |
| `electron/menu.js` | Help menu items |
| `src/test/setup.js` | Stubs for help IPC |
| `package.json` | `build:manual` script, `help/**` in electron-builder files |

---

## Task 1: Seed Help Content (5 representative topics)

Create 5 markdown files to test infrastructure against. These are fully-written topics that exercise all frontmatter fields.

**Files:**
- Create: `desktop/help/getting-started/01-opening-a-manuscript.md`
- Create: `desktop/help/toolbar/ai-scan.md`
- Create: `desktop/help/editor/fix-now.md`
- Create: `desktop/help/spe-rules/how-spe-works.md`
- Create: `desktop/help/keyboard-shortcuts/shortcuts.md`

- [ ] **Step 1: Create help directory structure**

```bash
mkdir -p desktop/help/{getting-started,toolbar,format-bar,file-tree,editor,status-bar,settings,themes,data-files,spe-rules,licensing,keyboard-shortcuts,images}
```

- [ ] **Step 2: Write getting-started/01-opening-a-manuscript.md**

```markdown
---
id: getting-started-opening
title: Opening a Manuscript
category: Getting Started
order: 1
summary: Open a folder containing your manuscript files to start linting. The app remembers your last folder across restarts.
keywords: open, folder, file tree, manuscript, browse, directory
---

## Opening a Manuscript

Fiction Linter works with folders of manuscript files. To get started:

1. Click **Open** in the top-left panel header, or use **Cmd+Shift+O** (Mac) / **Ctrl+Shift+O** (Windows/Linux).
2. Select a folder that contains your manuscript files (.md, .txt, .docx, or .gdoc).
3. The file tree appears on the left, showing all files in the folder.

### Supported file types

| Extension | What happens when you click it |
|-----------|-------------------------------|
| `.md`, `.markdown` | Opens as editable markdown |
| `.txt` | Opens as editable plain text |
| `.docx` | Imported via mammoth (converted to markdown) |
| `.gdoc` | Google Docs inline import (sign-in may be required) |
| Other files | Shown in the tree but grayed out (not editable) |

### Folder persistence

The app remembers the last folder you opened. When you relaunch, the file tree automatically shows that folder's contents — no need to re-open it.

### File tree navigation

- Click a **folder** to expand or collapse it.
- Click a **file** to open it in a new tab.
- The currently-open file is highlighted. Its parent folders are subtly highlighted as a breadcrumb trail.
- **Sidecar files** (`.findings.json`, `.annotation.md`) appear alongside your documents after you save or use Fix Later.

### See also

- [Supported File Types](file-tree-file-types)
- [Google Docs Import](file-tree-gdoc-import)
- [Word Document Import](file-tree-docx-import)
```

- [ ] **Step 3: Write toolbar/ai-scan.md**

```markdown
---
id: toolbar-ai-scan
title: AI Scan
category: Toolbar
order: 1
summary: Run an AI-powered scan across the current document to find show-vs-tell violations, weak phrasing, and other issues the deterministic linter cannot catch.
keywords: scan, ai, findings, openrouter, free model, chunking, rate limit, retry
---

## AI Scan

Click **AI Scan** in the toolbar (top center) to start a paragraph-by-paragraph AI analysis of the current document.

### How it works

1. The scanner splits your document into chunks of approximately 2,000 words, aligned to paragraph boundaries.
2. Each chunk is sent to your configured AI model (set in Settings).
3. The AI returns findings — flagged phrases with categories like "show-vs-tell," "weak phrasing," or "emotional telling."
4. Findings appear as colored underlines in the editor, just like the deterministic pattern findings.

### Progress and cancellation

- The button shows **AI Scan: 42%** while scanning.
- Click the button again while scanning to **cancel**.
- The status bar shows which chunk is being processed.

### Rate limiting

Free OpenRouter models may rate-limit at 10–20 requests per minute. When this happens:

- The scanner automatically retries with exponential backoff (3s, 6s, 12s).
- The status bar shows "Rate limited on chunk 4/16. Retrying in 6s..."
- After 3 retries, the chunk is marked as failed and the scan continues.

### Using free models

OpenRouter frequently offers powerful models at no cost. In Settings, use the **Free only** filter in the model picker to see what's available. Free models work well for AI Scan — the per-paragraph analysis doesn't require enormous context windows.

### After the scan

- Findings persist across restarts (saved in the `.findings.json` sidecar on save).
- Hover any finding to see the AI's explanation.
- Use **Fix Now** or **Fix Later** from the hover tooltip.

### See also

- [AI Provider Settings](settings-ai-provider)
- [Model Picker](settings-model-picker)
- [Fix Now](editor-fix-now)
- [Fix Later](editor-fix-later)
```

- [ ] **Step 4: Write editor/fix-now.md**

```markdown
---
id: editor-fix-now
title: Fix Now
category: Editor
order: 3
summary: Ask the AI for a rewrite of the flagged phrase and apply it immediately. The original text and replacement are logged to the annotation file.
keywords: fix, rewrite, replace, ai, annotation, undo
---

## Fix Now

When you hover a finding in the editor, a tooltip appears with **Fix Now** and **Fix Later** buttons.

Clicking **Fix Now**:

1. Sends the flagged phrase (plus surrounding context) to your AI model.
2. The AI returns three alternative phrasings.
3. The first alternative replaces the flagged text in your document.
4. Both the original and the replacement are logged to the `.annotation.md` sidecar file.
5. The finding's underline disappears — confirming the fix was applied.

### If the fix doesn't look right

Press **Cmd+Z** (Mac) or **Ctrl+Z** (Windows/Linux) immediately to undo. The original text is restored. The annotation file still records the attempt.

### Stale findings

If you've edited the document since the last scan, the flagged text may have shifted. Fiction Linter detects this and refuses the fix with a clear message: "Finding is stale — the document has changed since the scan." Run **Re-lint** or **AI Scan** again to refresh findings.

### See also

- [Fix Later](editor-fix-later)
- [Annotation File](data-files-annotation-md)
- [Hover Tooltips](editor-hover-tooltips)
```

- [ ] **Step 5: Write spe-rules/how-spe-works.md**

```markdown
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
```

- [ ] **Step 6: Write keyboard-shortcuts/shortcuts.md**

```markdown
---
id: shortcuts-reference
title: Keyboard Shortcuts
category: Keyboard Shortcuts
order: 1
summary: Complete list of keyboard shortcuts organized by context.
keywords: keyboard, shortcut, hotkey, accelerator, cmd, ctrl, keybinding
---

## Keyboard Shortcuts

All shortcuts use **Cmd** on macOS and **Ctrl** on Windows/Linux.

### Global

| Shortcut | Action |
|----------|--------|
| F1 | Open Help |
| Cmd+, | Open Settings |
| Cmd+Shift+O | Open Folder |
| Cmd+N | New Tab |
| Cmd+W | Close Tab |
| Cmd+L | Toggle Lint |
| Cmd+Shift+L | Toggle Findings Display |

### Editor

| Shortcut | Action |
|----------|--------|
| Cmd+S | Save |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Cmd+B | Bold |
| Cmd+I | Italic |
| Cmd+U | Underline |
| Cmd+A | Select All |

### Dialogs

| Shortcut | Action |
|----------|--------|
| Escape | Close dialog / dismiss popup |
| Enter | Activate (in License dialog) |
```

- [ ] **Step 7: Commit seed content**

```bash
git add desktop/help/
git commit -m "content: seed help topics (5 of 52) for infrastructure testing"
```

---

## Task 2: Help Loader (main process)

**Files:**
- Create: `electron/helpLoader.js`
- Create: `electron/helpLoader.test.js`

- [ ] **Step 1: Write failing tests**

Create `electron/helpLoader.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseHelpFile, loadHelpIndex } from './helpLoader.js';
import path from 'path';

describe('parseHelpFile', () => {
    it('extracts frontmatter and body from a markdown string', () => {
        const md = [
            '---',
            'id: test-topic',
            'title: Test Topic',
            'category: Testing',
            'order: 1',
            'summary: A test topic.',
            'keywords: test, unit',
            '---',
            '',
            '## Test Topic',
            '',
            'Body content here.'
        ].join('\n');
        const result = parseHelpFile(md);
        expect(result.id).toBe('test-topic');
        expect(result.title).toBe('Test Topic');
        expect(result.category).toBe('Testing');
        expect(result.order).toBe(1);
        expect(result.summary).toBe('A test topic.');
        expect(result.keywords).toEqual(['test', 'unit']);
        expect(result.body).toContain('## Test Topic');
        expect(result.body).toContain('Body content here.');
    });

    it('returns null for files without valid frontmatter', () => {
        expect(parseHelpFile('just some text')).toBeNull();
        expect(parseHelpFile('---\nbad yaml: [[[[')).toBeNull();
    });

    it('handles keywords as a comma-separated string', () => {
        const md = '---\nid: x\ntitle: X\ncategory: X\norder: 1\nsummary: X\nkeywords: one, two, three\n---\nBody';
        const result = parseHelpFile(md);
        expect(result.keywords).toEqual(['one', 'two', 'three']);
    });
});

describe('loadHelpIndex', () => {
    it('loads the seed help files and returns a sorted index', () => {
        const helpDir = path.join(__dirname, '..', 'help');
        const index = loadHelpIndex(helpDir);
        expect(index.length).toBeGreaterThanOrEqual(5);
        // Each entry has the required shape
        for (const topic of index) {
            expect(topic).toHaveProperty('id');
            expect(topic).toHaveProperty('title');
            expect(topic).toHaveProperty('category');
            expect(topic).toHaveProperty('order');
            expect(topic).toHaveProperty('summary');
            expect(topic).toHaveProperty('keywords');
            expect(topic).toHaveProperty('body');
        }
        // Sorted by category order then topic order
        const ids = index.map(t => t.id);
        const gettingStartedIdx = ids.indexOf('getting-started-opening');
        const toolbarIdx = ids.indexOf('toolbar-ai-scan');
        expect(gettingStartedIdx).toBeLessThan(toolbarIdx);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd desktop && npx vitest run electron/helpLoader.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement helpLoader.js**

Create `electron/helpLoader.js`:
```js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Category display order — topics in unlisted categories sort to the end.
const CATEGORY_ORDER = [
    'Getting Started', 'Toolbar', 'Format Bar', 'File Tree',
    'Editor', 'Status Bar', 'Settings', 'Themes',
    'Data Files', 'SPE Rules', 'Licensing', 'Keyboard Shortcuts'
];

function parseHelpFile(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!fmMatch) return null;
    let frontmatter;
    try {
        frontmatter = yaml.load(fmMatch[1]);
    } catch {
        return null;
    }
    if (!frontmatter || !frontmatter.id || !frontmatter.title) return null;
    let keywords = frontmatter.keywords || [];
    if (typeof keywords === 'string') {
        keywords = keywords.split(',').map(k => k.trim()).filter(Boolean);
    }
    return {
        id: frontmatter.id,
        title: frontmatter.title,
        category: frontmatter.category || 'Uncategorized',
        order: Number(frontmatter.order) || 99,
        summary: frontmatter.summary || '',
        keywords,
        body: fmMatch[2].trim()
    };
}

function loadHelpIndex(helpDir) {
    if (!helpDir || !fs.existsSync(helpDir)) return [];
    const topics = [];
    const entries = fs.readdirSync(helpDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const catDir = path.join(helpDir, entry.name);
        const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md')).sort();
        for (const file of files) {
            const raw = fs.readFileSync(path.join(catDir, file), 'utf8');
            const topic = parseHelpFile(raw);
            if (topic) topics.push(topic);
        }
    }
    // Sort by category order, then by topic order within category
    topics.sort((a, b) => {
        const catA = CATEGORY_ORDER.indexOf(a.category);
        const catB = CATEGORY_ORDER.indexOf(b.category);
        const orderA = catA >= 0 ? catA : 999;
        const orderB = catB >= 0 ? catB : 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.order - b.order;
    });
    return topics;
}

module.exports = { parseHelpFile, loadHelpIndex, CATEGORY_ORDER };
```

- [ ] **Step 4: Run tests**

Run: `cd desktop && npx vitest run electron/helpLoader.test.js`
Expected: PASS

- [ ] **Step 5: Add IPC handler to main.js**

Near other IPC handlers:
```js
const { loadHelpIndex } = require('./helpLoader');

ipcMain.handle('help:load', async () => {
    // In packaged builds, help/ is relative to the app root.
    // In dev, it's relative to the desktop/ directory.
    const helpDir = app.isPackaged
        ? path.join(process.resourcesPath, 'help')
        : path.join(__dirname, '..', 'help');
    return loadHelpIndex(helpDir);
});
```

Add to preload.js:
```js
loadHelp: () => ipcRenderer.invoke('help:load'),
```

Add to test/setup.js:
```js
loadHelp: async () => ([
    { id: 'test-topic', title: 'Test', category: 'Test', order: 1, summary: 'A test.', keywords: [], body: '## Test\n\nBody.' }
]),
```

Add to package.json build.files array:
```json
"help/**/*"
```

- [ ] **Step 6: Run full suite + commit**

Run: `cd desktop && npm test`

```bash
git add electron/helpLoader.js electron/helpLoader.test.js electron/main.js electron/preload.js src/test/setup.js package.json
git commit -m "feat: help loader reads markdown topics, exposes via IPC"
```

---

## Task 3: HelpTab Component

**Files:**
- Create: `src/components/HelpTab.jsx`
- Create: `src/components/HelpTab.test.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests**

Create `src/components/HelpTab.test.jsx`:
```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpTab from './HelpTab';

const sampleTopics = [
    { id: 'gs-open', title: 'Opening', category: 'Getting Started', order: 1, summary: 'Open files.', keywords: ['open'], body: '## Opening\n\nOpen your files.' },
    { id: 'gs-scan', title: 'First Scan', category: 'Getting Started', order: 2, summary: 'Run a scan.', keywords: ['scan'], body: '## First Scan\n\nRun your first scan.' },
    { id: 'tb-ai', title: 'AI Scan', category: 'Toolbar', order: 1, summary: 'AI scanning.', keywords: ['ai'], body: '## AI Scan\n\nClick AI Scan.' }
];

describe('HelpTab', () => {
    it('renders a navigation tree with categories and topics', () => {
        render(<HelpTab topics={sampleTopics} initialTopicId={null} />);
        expect(screen.getByText('Getting Started')).toBeInTheDocument();
        expect(screen.getByText('Toolbar')).toBeInTheDocument();
        expect(screen.getByText('Opening')).toBeInTheDocument();
        expect(screen.getByText('AI Scan')).toBeInTheDocument();
    });

    it('renders topic content when a topic is clicked', async () => {
        const user = userEvent.setup();
        render(<HelpTab topics={sampleTopics} initialTopicId={null} />);
        await user.click(screen.getByText('AI Scan'));
        expect(screen.getByText('Click AI Scan.')).toBeInTheDocument();
    });

    it('renders the initial topic when initialTopicId is set', () => {
        render(<HelpTab topics={sampleTopics} initialTopicId="tb-ai" />);
        expect(screen.getByText('Click AI Scan.')).toBeInTheDocument();
    });

    it('filters topics when search text is entered', async () => {
        const user = userEvent.setup();
        render(<HelpTab topics={sampleTopics} initialTopicId={null} />);
        const searchInput = screen.getByPlaceholderText(/search/i);
        await user.type(searchInput, 'scan');
        // "First Scan" and "AI Scan" match; "Opening" does not
        expect(screen.getByText('First Scan')).toBeInTheDocument();
        expect(screen.getByText('AI Scan')).toBeInTheDocument();
        expect(screen.queryByText('Opening')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Implement HelpTab**

Create `src/components/HelpTab.jsx`:
```jsx
import { useState, useMemo, useEffect } from 'react';
import { markdownToHtml } from './editor/converters';

function HelpTab({ topics, initialTopicId }) {
    const [selectedId, setSelectedId] = useState(initialTopicId || null);
    const [search, setSearch] = useState('');
    const [renderedHtml, setRenderedHtml] = useState('');
    const [expandedCategories, setExpandedCategories] = useState(new Set());

    // Group topics by category, preserving order
    const grouped = useMemo(() => {
        const map = new Map();
        for (const t of topics || []) {
            if (!map.has(t.category)) map.set(t.category, []);
            map.get(t.category).push(t);
        }
        return map;
    }, [topics]);

    // Auto-expand the category containing the selected topic
    useEffect(() => {
        if (!selectedId) return;
        const topic = (topics || []).find(t => t.id === selectedId);
        if (topic) {
            setExpandedCategories(prev => new Set(prev).add(topic.category));
        }
    }, [selectedId, topics]);

    // Initial topic
    useEffect(() => {
        if (initialTopicId) setSelectedId(initialTopicId);
    }, [initialTopicId]);

    // Render selected topic's markdown to HTML
    useEffect(() => {
        const topic = (topics || []).find(t => t.id === selectedId);
        if (!topic) { setRenderedHtml(''); return; }
        let cancelled = false;
        markdownToHtml(topic.body).then(html => {
            if (!cancelled) setRenderedHtml(html);
        });
        return () => { cancelled = true; };
    }, [selectedId, topics]);

    // Search filter
    const filtered = useMemo(() => {
        if (!search.trim()) return null; // null = show all
        const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
        return new Set(
            (topics || [])
                .filter(t => {
                    const haystack = `${t.title} ${t.keywords.join(' ')} ${t.body}`.toLowerCase();
                    return terms.every(term => haystack.includes(term));
                })
                .map(t => t.id)
        );
    }, [search, topics]);

    const toggleCategory = (cat) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    return (
        <div className="help-tab">
            <div className="help-nav">
                <input
                    type="text"
                    className="help-search"
                    placeholder="Search help..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="help-tree">
                    {[...grouped.entries()].map(([category, catTopics]) => {
                        const visibleTopics = filtered
                            ? catTopics.filter(t => filtered.has(t.id))
                            : catTopics;
                        if (filtered && visibleTopics.length === 0) return null;
                        const isExpanded = expandedCategories.has(category) || !!filtered;
                        return (
                            <div key={category} className="help-category">
                                <button
                                    className="help-category-header"
                                    onClick={() => toggleCategory(category)}
                                >
                                    <span>{isExpanded ? '\u25BE' : '\u25B8'}</span>
                                    <span>{category}</span>
                                </button>
                                {isExpanded ? (
                                    <div className="help-category-items">
                                        {visibleTopics.map(t => (
                                            <button
                                                key={t.id}
                                                className={`help-topic-item ${t.id === selectedId ? 'selected' : ''}`}
                                                onClick={() => setSelectedId(t.id)}
                                            >
                                                {t.title}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="help-content">
                {renderedHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                ) : (
                    <div className="help-empty">
                        <h2>Fiction Linter Help</h2>
                        <p>Select a topic from the navigation tree, or search for a keyword.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default HelpTab;
```

- [ ] **Step 3: Add CSS**

Append to `src/styles.css`:
```css
/* Help tab — two-pane layout inside the editor area */
.help-tab {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--g-bg, #ffffff);
}

.help-nav {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--g-border, #d7d2c5);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: var(--g-panel-bg, #faf8f4);
    padding: 12px;
}

.help-search {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--g-border, #d7d2c5);
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 12px;
    background: var(--g-bg, #ffffff);
    color: var(--g-text, #2a2620);
    box-sizing: border-box;
}

.help-tree {
    flex: 1;
    overflow-y: auto;
}

.help-category-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    font-size: 12px;
    font-weight: 700;
    color: var(--g-accent, #4a7a4a);
    cursor: pointer;
    padding: 4px 0;
    font-family: inherit;
    text-align: left;
}

.help-category-items {
    padding-left: 16px;
}

.help-topic-item {
    display: block;
    width: 100%;
    background: none;
    border: none;
    font-size: 12px;
    color: var(--g-text-muted, #6b655b);
    cursor: pointer;
    padding: 3px 6px;
    border-radius: 4px;
    text-align: left;
    font-family: inherit;
}

.help-topic-item:hover {
    background: var(--g-surface-hover, rgba(0,0,0,0.04));
}

.help-topic-item.selected {
    background: var(--g-accent-bg, #e8f0e8);
    color: var(--g-accent, #4a7a4a);
    font-weight: 600;
}

.help-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--g-text, #2a2620);
}

.help-content h2 { font-size: 20px; margin: 0 0 12px; }
.help-content h3 { font-size: 16px; margin: 20px 0 8px; }
.help-content table { border-collapse: collapse; width: 100%; margin: 12px 0; }
.help-content th, .help-content td { border: 1px solid var(--g-border, #d7d2c5); padding: 6px 10px; font-size: 13px; text-align: left; }
.help-content th { background: var(--g-panel-bg, #faf8f4); font-weight: 600; }
.help-content code { background: rgba(0,0,0,0.05); padding: 1px 5px; border-radius: 3px; font-size: 12px; }

.help-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--muted);
}
```

- [ ] **Step 4: Run tests + commit**

Run: `cd desktop && npx vitest run src/components/HelpTab.test.jsx`
Then: `npm test`

```bash
git add src/components/HelpTab.jsx src/components/HelpTab.test.jsx src/styles.css
git commit -m "feat: HelpTab component with nav tree, search, and content rendering"
```

---

## Task 4: HelpPopup Component

**Files:**
- Create: `src/components/HelpPopup.jsx`
- Create: `src/components/HelpPopup.test.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests**

Create `src/components/HelpPopup.test.jsx`:
```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpPopup from './HelpPopup';

describe('HelpPopup', () => {
    const topic = { id: 'test', title: 'Test Topic', summary: 'A test summary.' };

    it('renders the topic title and summary', () => {
        render(<HelpPopup topic={topic} position={{ x: 100, y: 100 }} onClose={() => {}} onMore={() => {}} />);
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
        expect(screen.getByText('A test summary.')).toBeInTheDocument();
    });

    it('has a More... button that calls onMore', async () => {
        const onMore = vi.fn();
        const user = userEvent.setup();
        render(<HelpPopup topic={topic} position={{ x: 100, y: 100 }} onClose={() => {}} onMore={onMore} />);
        await user.click(screen.getByText(/more/i));
        expect(onMore).toHaveBeenCalledWith('test');
    });

    it('calls onClose when Escape is pressed', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(<HelpPopup topic={topic} position={{ x: 100, y: 100 }} onClose={onClose} onMore={() => {}} />);
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Implement HelpPopup**

Create `src/components/HelpPopup.jsx`:
```jsx
import { useEffect } from 'react';

function HelpPopup({ topic, position, onClose, onMore }) {
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    useEffect(() => {
        const handler = (e) => {
            if (!e.target.closest('.help-popup')) onClose();
        };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [onClose]);

    if (!topic) return null;

    return (
        <div
            className="help-popup"
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            <div className="help-popup-title">{topic.title}</div>
            <div className="help-popup-summary">{topic.summary}</div>
            <button
                type="button"
                className="help-popup-more"
                onClick={() => onMore(topic.id)}
            >
                More... {'\u203A'}
            </button>
        </div>
    );
}

export default HelpPopup;
```

- [ ] **Step 3: Add CSS**

Append to `src/styles.css`:
```css
/* Help popup — context-sensitive mini-tooltip */
.help-popup {
    position: fixed;
    z-index: 2000;
    max-width: 320px;
    padding: 12px 16px;
    background: rgba(28, 27, 25, 0.94);
    color: #fff;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    transform: translate(-50%, -100%);
    margin-top: -8px;
    font-size: 13px;
    line-height: 1.5;
}

.help-popup-title {
    font-weight: 700;
    color: #7dc4a0;
    margin-bottom: 6px;
}

.help-popup-summary {
    color: #e0e0e0;
    margin-bottom: 8px;
}

.help-popup-more {
    background: none;
    border: none;
    color: #7dc4a0;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
}

.help-popup-more:hover {
    text-decoration: underline;
}
```

- [ ] **Step 4: Run tests + commit**

```bash
git add src/components/HelpPopup.jsx src/components/HelpPopup.test.jsx src/styles.css
git commit -m "feat: HelpPopup component for right-click context help"
```

---

## Task 5: Wire Help into App.jsx

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/editor/EditorToolbar.jsx`
- Modify: `src/components/StatusBar.jsx`

- [ ] **Step 1: Add help state and loading**

In App.jsx, add state:
```js
const [helpTopics, setHelpTopics] = React.useState([]);
const [helpPopup, setHelpPopup] = React.useState(null); // { topic, position }
```

Add useEffect to load help topics:
```js
useEffect(() => {
    window.api.loadHelp?.().then(topics => {
        if (topics) setHelpTopics(topics);
    }).catch(() => {});
}, []);
```

- [ ] **Step 2: Add ? icon in the top bar**

In the `<div className="top-actions">`, add before ThemePicker:
```jsx
<button
    className="icon-button"
    onClick={handleOpenHelp}
    aria-label="Help"
    title="Help (F1)"
>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
</button>
```

- [ ] **Step 3: Add handleOpenHelp + F1 handler**

```js
const handleOpenHelp = (topicId = null) => {
    // Open help as a special tab
    const existingHelp = tabs.find(t => t.name === 'Help' && !t.path);
    if (existingHelp) {
        setActiveTab(existingHelp.id);
    } else {
        openFile({ path: null, name: 'Help', markdownSource: '' });
    }
    // If a specific topic was requested, the HelpTab will handle scrolling
    // via a state update after the tab renders.
};
```

Add F1 handler in the menu-action effect or as a global keydown:
```js
useEffect(() => {
    const handler = (e) => {
        if (e.key === 'F1') {
            e.preventDefault();
            handleOpenHelp();
        }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
}, []);
```

- [ ] **Step 4: Add contextmenu handler for data-help-id**

```js
useEffect(() => {
    const handler = (e) => {
        const helpEl = e.target.closest('[data-help-id]');
        if (!helpEl) return; // default context menu
        e.preventDefault();
        const helpId = helpEl.getAttribute('data-help-id');
        const topic = helpTopics.find(t => t.id === helpId);
        if (!topic) return;
        const rect = helpEl.getBoundingClientRect();
        setHelpPopup({
            topic,
            position: { x: rect.left + rect.width / 2, y: rect.top - 8 }
        });
    };
    window.addEventListener('contextmenu', handler);
    return () => window.removeEventListener('contextmenu', handler);
}, [helpTopics]);
```

- [ ] **Step 5: Render HelpPopup + HelpTab conditionally**

Import HelpPopup and HelpTab. Render the popup:
```jsx
{helpPopup ? (
    <HelpPopup
        topic={helpPopup.topic}
        position={helpPopup.position}
        onClose={() => setHelpPopup(null)}
        onMore={(topicId) => {
            setHelpPopup(null);
            handleOpenHelp(topicId);
        }}
    />
) : null}
```

In the right panel, when the active tab is Help (name === 'Help' && path === null), render HelpTab instead of Editor:
```jsx
{activeTab?.name === 'Help' && !activeTab?.path ? (
    <HelpTab topics={helpTopics} initialTopicId={null} />
) : tabs.length === 0 ? (
    <WelcomeScreen onOpenFolder={handleChooseFolder} />
) : (
    <Editor ... />
)}
```

- [ ] **Step 6: Add data-help-id attributes to toolbar buttons**

In `src/App.jsx`, add `data-help-id` to each toolbar button. Example:
```jsx
<button data-help-id="toolbar-ai-scan" ...>AI Scan</button>
<button data-help-id="toolbar-re-lint" ...>Re-lint</button>
<button data-help-id="toolbar-lint-toggle" ...>Lint off</button>
<button data-help-id="toolbar-findings-toggle" ...>Hide findings</button>
<button data-help-id="toolbar-line-numbers" ...>Line #s</button>
<button data-help-id="toolbar-next-finding" ...>Next</button>
```

In `EditorToolbar.jsx`:
```jsx
<button data-help-id="format-save" ...>Save</button>
<button data-help-id="format-undo-redo" ...>Undo</button>
<button data-help-id="format-undo-redo" ...>Redo</button>
<select data-help-id="format-paragraph-style" ...>...</select>
<button data-help-id="format-bold-italic-underline" ...>B</button>
<button data-help-id="format-scene-break" ...>—</button>
<div data-help-id="format-font-size" ...>A-/A+</div>
<button data-help-id="format-wrap" ...>Wrap</button>
```

In `StatusBar.jsx`, wrap the metrics in spans with `data-help-id`:
```jsx
<span data-help-id="status-word-char-counts" className="status-bar-metric">...</span>
<span data-help-id="status-cursor-position" className="status-bar-metric">...</span>
<span data-help-id="status-findings-count" className="status-bar-metric">...</span>
```

- [ ] **Step 7: Run tests + commit**

```bash
git add src/App.jsx src/components/editor/EditorToolbar.jsx src/components/StatusBar.jsx
git commit -m "feat: wire help system — ? icon, F1, right-click popups, help tab"
```

---

## Task 6: Menu Updates

**Files:**
- Modify: `electron/menu.js`

- [ ] **Step 1: Update Help menu**

In the Help submenu, replace the single documentation item with:
```js
{
    label: 'Fiction Linter Help',
    accelerator: 'F1',
    click: () => sendToRenderer('menu:action', { action: 'open-help' })
},
{
    label: 'Online Documentation',
    click: () => {
        const { shell } = require('electron');
        shell.openExternal('https://ocotilloquillpress.com/docs/fiction-linter');
    }
},
```

- [ ] **Step 2: Handle open-help in App.jsx's onMenuAction**

Already handled — the existing `case 'open-help'` opens a URL. Change it to call `handleOpenHelp()` instead:
```js
case 'open-help':
    handleOpenHelp();
    break;
```

- [ ] **Step 3: Commit**

```bash
git add electron/menu.js src/App.jsx
git commit -m "feat: Help menu opens in-app help tab, Online Documentation opens browser"
```

---

## Task 7: Write Remaining Help Content (47 topics)

This is a content authoring task. The subagent reads the spec's topic list (Section 7), references the actual codebase for accuracy, and writes each markdown file with proper frontmatter.

**Files:** Create 47 markdown files in `desktop/help/` subdirectories.

The subagent should:
1. Read the spec at `desktop/Plans/2026-04-16-help-system-spec.md`, Section 7 for the complete topic list with descriptions.
2. For each topic, reference the relevant source file to verify the actual behavior (e.g., for "Model Picker" → read `src/components/ModelPicker.jsx`).
3. Follow the content guidelines in spec Section 2.3 (write for fiction writers, include visual location, mention shortcuts).
4. Use the seed topics in `desktop/help/` as style references.
5. Each file must have the full YAML frontmatter: `id`, `title`, `category`, `order`, `summary`, `keywords`.

**Categories and file counts:**
- `toolbar/`: 5 more (re-lint, lint-toggle, findings-toggle, line-numbers, next-finding)
- `format-bar/`: 7 files
- `file-tree/`: 4 files
- `editor/`: 5 more (editing-text, findings-overlay, fix-later, severity-colors, hover-tooltips)
- `status-bar/`: 3 files
- `settings/`: 5 files
- `themes/`: 5 files
- `data-files/`: 3 files
- `spe-rules/`: 5 more (cliche-collider, name-collider, place-collider, line-editing-protocol, customizing-rules)
- `licensing/`: 3 files
- `getting-started/`: 2 more (02-first-scan.md, 03-understanding-findings.md)

- [ ] **Step 1: Write all 47 remaining topic files**

Each following the pattern:
```markdown
---
id: <unique-id>
title: <Title>
category: <Category>
order: <N>
summary: <1-2 sentences for the right-click popup>
keywords: <comma-separated search terms>
---

## <Title>

<Full help content, 100-300 words per topic>
```

- [ ] **Step 2: Verify all 52 files parse correctly**

```bash
cd desktop && node -e "
const { loadHelpIndex } = require('./electron/helpLoader');
const path = require('path');
const idx = loadHelpIndex(path.join(__dirname, 'help'));
console.log('Topics loaded:', idx.length);
const cats = [...new Set(idx.map(t => t.category))];
console.log('Categories:', cats.join(', '));
if (idx.length < 52) console.error('MISSING TOPICS:', 52 - idx.length);
"
```
Expected: `Topics loaded: 52`

- [ ] **Step 3: Run full test suite**

Run: `cd desktop && npm test`
Expected: All pass (the helpLoader test checks >= 5 topics, so 52 passes)

- [ ] **Step 4: Commit**

```bash
git add desktop/help/
git commit -m "content: complete help system — 52 topics across 12 categories"
```

---

## Task 8: External Manual Build Script

**Files:**
- Create: `scripts/build-manual.js`
- Modify: `package.json`

- [ ] **Step 1: Create the build script**

Create `scripts/build-manual.js`:
```js
#!/usr/bin/env node
/**
 * Generates a self-contained HTML user manual from the help markdown files.
 * Usage: node scripts/build-manual.js
 * Output: manual/index.html
 */
const fs = require('fs');
const path = require('path');
const { loadHelpIndex, CATEGORY_ORDER } = require('../electron/helpLoader');
const { unified } = require('unified');
const remarkParse = require('remark-parse');
const remarkRehype = require('remark-rehype');
const rehypeStringify = require('rehype-stringify');

const HELP_DIR = path.join(__dirname, '..', 'help');
const OUT_DIR = path.join(__dirname, '..', 'manual');
const VERSION = require('../package.json').version;

async function renderMarkdown(md) {
    const file = await unified()
        .use(remarkParse.default || remarkParse)
        .use(remarkRehype.default || remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify.default || rehypeStringify)
        .process(md);
    return String(file);
}

async function main() {
    const topics = loadHelpIndex(HELP_DIR);
    if (topics.length === 0) {
        console.error('No topics found in', HELP_DIR);
        process.exit(1);
    }
    console.log(`Building manual from ${topics.length} topics...`);

    // Group by category
    const grouped = new Map();
    for (const t of topics) {
        if (!grouped.has(t.category)) grouped.set(t.category, []);
        grouped.get(t.category).push(t);
    }

    // Build TOC
    let toc = '<nav id="toc"><h2>Table of Contents</h2><ul>';
    for (const [cat, catTopics] of grouped) {
        toc += `<li><a href="#cat-${slugify(cat)}">${cat}</a><ul>`;
        for (const t of catTopics) {
            toc += `<li><a href="#${t.id}">${t.title}</a></li>`;
        }
        toc += '</ul></li>';
    }
    toc += '</ul></nav>';

    // Build content
    let content = '';
    for (const [cat, catTopics] of grouped) {
        content += `<section id="cat-${slugify(cat)}"><h2>${cat}</h2>`;
        for (const t of catTopics) {
            const html = await renderMarkdown(t.body);
            content += `<article id="${t.id}">${html}</article>`;
        }
        content += '</section>';
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiction Linter Desktop — User Manual</title>
<style>
body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #2a2620; line-height: 1.6; }
h1 { font-size: 28px; margin-bottom: 4px; }
h2 { font-size: 22px; border-bottom: 1px solid #d7d2c5; padding-bottom: 6px; margin-top: 40px; }
h3 { font-size: 17px; margin-top: 24px; }
nav ul { list-style: none; padding-left: 0; }
nav ul ul { padding-left: 20px; list-style: disc; }
nav a { color: #4a7a4a; text-decoration: none; }
nav a:hover { text-decoration: underline; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; }
th, td { border: 1px solid #d7d2c5; padding: 6px 10px; text-align: left; font-size: 14px; }
th { background: #faf8f4; }
code { background: #f5f5f5; padding: 1px 5px; border-radius: 3px; font-size: 13px; }
article { margin-bottom: 32px; }
.version { color: #6b655b; font-size: 14px; }
.copyright { color: #999; font-size: 12px; margin-top: 60px; border-top: 1px solid #d7d2c5; padding-top: 12px; }
@media print { nav { page-break-after: always; } }
</style>
</head>
<body>
<header>
<h1>Fiction Linter Desktop</h1>
<p class="version">User Manual — v${VERSION}</p>
<p>Ocotillo Quill Press LLC</p>
</header>
${toc}
<main>${content}</main>
<footer class="copyright">
<p>Copyright 2025 Ocotillo Quill Press LLC. All rights reserved.</p>
</footer>
</body>
</html>`;

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
    console.log(`Manual written to manual/index.html (${topics.length} topics, ${Math.round(html.length / 1024)}KB)`);
}

function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
```

- [ ] **Step 2: Add build:manual script to package.json**

```json
"build:manual": "node scripts/build-manual.js"
```

- [ ] **Step 3: Add manual/ to .gitignore**

The manual is a build artifact — generated from source, not committed.

- [ ] **Step 4: Test the build**

```bash
cd desktop && npm run build:manual
```
Expected: `manual/index.html` generated, opens in browser showing all 52 topics.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-manual.js package.json .gitignore
git commit -m "feat: build-manual script generates standalone HTML user manual"
```

---

## Self-Review

**Spec coverage:**
- Section 2 (source format) → Task 1 (seed) + Task 7 (all content) ✅
- Section 3 (help tab) → Task 3 ✅
- Section 4 (popup) → Task 4 + Task 5 (data-help-id wiring) ✅
- Section 5 (access points: ?, F1, right-click, menu) → Task 5 + Task 6 ✅
- Section 6 (external manual) → Task 8 ✅
- Section 7 (52 topics) → Task 1 (5) + Task 7 (47) ✅
- Section 8 (file manifest) → all covered ✅
- Section 9 (implementation order) → tasks follow spec order ✅

**Placeholder scan:** Task 7 is a content-writing task, not a code task. The frontmatter specs are exact (not placeholder). The body content is written by the subagent by referencing the spec and codebase — this is a structured writing brief, not a "fill in later."

**Type consistency:** `parseHelpFile` returns `{ id, title, category, order, summary, keywords, body }` → same shape used in HelpTab props → same shape in HelpPopup's `topic` prop → same shape in the test stubs. `loadHelpIndex` returns an array of these. All consistent.
