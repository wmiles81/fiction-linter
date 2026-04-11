# Fiction Linter Desktop Buildout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the existing Electron + React + Vite scaffold from "inert review" to "usable, shippable desktop app with AI-assisted revision," in seven review-able phases.

**Architecture:** Keep the framework-agnostic linting core at `src/shared/linting/` as the single source of truth. The desktop app is a thin React shell over it, same as the VS Code extension. All privileged work (fs, yaml parsing, network calls to AI providers) happens in the Electron main process and crosses the `contextBridge` as typed IPC. The renderer stays sandboxed.

**Tech Stack:** Electron 31, React 18, Vite 5, CodeMirror 6 (`@uiw/react-codemirror`), Vitest + Testing Library, electron-builder, `js-yaml` (main process only), Node 18+ built-in `fetch` for AI calls.

**Repo conventions:**
- Git root is `fiction-linter/` — all `git` commands run from there (or from any subdirectory; git finds its root).
- `npm` commands run from `fiction-linter/desktop/` unless noted otherwise.
- Commits use conventional format with `desktop:` or `core:` scope.
- File paths in this plan are relative to the repository root (`fiction-linter/`) unless otherwise stated.

---

## Phase Overview

| Phase | Goal | Ships without next phase? |
|-------|------|---------------------------|
| **0** | Test infrastructure (vitest + testing-library + jsdom) | No (prereq) |
| **1** | Fix `isInsideQuotes` multi-line bug in shared core | Yes — benefits VS Code extension |
| **2** | Debounce lint + click-on-issue → cursor jump | Yes — app becomes responsive |
| **3** | Replace textarea with CodeMirror 6 + inline diagnostics | Yes — UX parity with VS Code |
| **4** | Move YAML loading into main process | Yes — smaller renderer bundle |
| **5** | AI "Explain" and "Suggest rewrite" per finding | Yes — first user-facing AI feature |
| **6** | electron-builder packaging + `getDefaultSpePath` fix | Yes — distributable app |

Each phase ends with working, committed software. You can pause after any phase.

---

# Phase 0: Test Infrastructure

**Why first:** every subsequent phase writes tests. Without vitest running, TDD discipline falls apart on task 1.

**Files:**
- Create: `desktop/vitest.config.ts`
- Create: `desktop/src/test/setup.js`
- Create: `desktop/src/App.smoke.test.jsx`
- Modify: `desktop/package.json` (add devDeps, add `test` script)

## Task 0.1: Install test dependencies

- [ ] **Step 1: Install devDependencies**

Run from `fiction-linter/desktop/`:

```bash
cd fiction-linter/desktop
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

Expected: `package.json` devDependencies now include the six packages above; `package-lock.json` updates.

- [ ] **Step 2: Verify install**

```bash
npx vitest --version
```

Expected: prints a version like `2.x.x` (or whatever the latest stable is as of install).

## Task 0.2: Create vitest config

**File:** `desktop/vitest.config.ts`

- [ ] **Step 1: Create the config file**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../src/shared')
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.js'],
        include: [
            'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
            '../src/shared/**/*.{test,spec}.{ts,tsx}'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html']
        }
    }
});
```

**Why this config:** the `alias` mirrors `vite.config.ts` so `@shared/linting` resolves identically in tests and the app. The `include` pattern deliberately reaches into `../src/shared/` so shared-core tests live next to the TypeScript they test — not buried inside the desktop test tree.

## Task 0.3: Create test setup file

**File:** `desktop/src/test/setup.js`

- [ ] **Step 1: Create the setup file**

```js
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
});

// Stub window.api so components that call it in useEffect don't crash in tests.
// Individual tests can override specific methods via vi.spyOn.
if (typeof window !== 'undefined' && !window.api) {
    window.api = {
        chooseFolder: async () => null,
        listDirectory: async () => [],
        readFile: async () => ({ ok: false, error: 'stub' }),
        writeFile: async () => ({ ok: true }),
        getSettings: async () => ({
            spePath: '',
            ai: { provider: 'openrouter', model: '', apiKey: '', baseUrl: '' }
        }),
        saveSettings: async settings => settings,
        loadSpeData: async () => ({ cliches: {}, names: {}, places: {}, protocols: {} }),
        aiComplete: async () => ({ ok: false, error: 'stub' })
    };
}
```

**Why:** every test that renders `<App />` will trigger the `useEffect` that calls `window.api.getSettings()`. Without a stub, tests crash. Later phases add `loadSpeData` and `aiComplete` — they're stubbed here preemptively so test setup doesn't need to change as we add IPC methods.

## Task 0.4: Add the test script

**File:** `desktop/package.json`

- [ ] **Step 1: Add scripts**

Modify the `scripts` section of `desktop/package.json`. The existing block looks like:

```json
"scripts": {
    "dev": "VITE_DEV_SERVER_URL=http://localhost:5173 concurrently \"vite\" \"electron .\"",
    "build": "vite build",
    "start": "electron ."
}
```

Replace it with:

```json
"scripts": {
    "dev": "VITE_DEV_SERVER_URL=http://localhost:5173 concurrently \"vite\" \"electron .\"",
    "build": "vite build",
    "start": "electron .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
}
```

## Task 0.5: Write a smoke test

**File:** `desktop/src/App.smoke.test.jsx`

- [ ] **Step 1: Write the smoke test**

```jsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App (smoke)', () => {
    it('renders the top bar with brand title', async () => {
        render(<App />);
        expect(await screen.findByText('Fiction Linter')).toBeInTheDocument();
        expect(screen.getByText('Desktop Studio')).toBeInTheDocument();
    });

    it('shows the empty-tree hint before a folder is chosen', async () => {
        render(<App />);
        expect(
            await screen.findByText(/Pick a folder to start exploring/i)
        ).toBeInTheDocument();
    });

    it('shows the ready status in the footer', async () => {
        render(<App />);
        expect(await screen.findByText('Ready')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run the smoke test**

```bash
cd fiction-linter/desktop
npm test
```

Expected: `App (smoke)` block passes with 3 tests green. If it fails with "window.api is undefined", double-check that `src/test/setup.js` runs before the render — the `setupFiles` entry in `vitest.config.ts` is the only thing that wires it up.

## Task 0.6: Commit Phase 0

- [ ] **Step 1: Stage and commit**

```bash
cd fiction-linter
git add desktop/package.json desktop/package-lock.json desktop/vitest.config.ts desktop/src/test/setup.js desktop/src/App.smoke.test.jsx
git commit -m "$(cat <<'EOF'
desktop: add vitest + testing-library infra

Adds vitest configured with jsdom, testing-library, and a @shared
alias mirroring vite.config.ts so shared-core tests can live next
to their TypeScript source. Includes a stubbed window.api in the
test setup so components that call IPC in useEffect don't crash.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Verify the commit**

```bash
git log -1 --stat
```

Expected: one commit with 5 files changed.

---

# Phase 1: Fix `isInsideQuotes` Multi-line Bug (Shared Core)

**Why in Phase 1:** it's a bug in the shared core, so fixing it benefits both the desktop app and the VS Code extension. Doing it before the CodeMirror swap means the CodeMirror diagnostics benefit from the fix on day one.

**The bug:** [src/shared/linting/PatternLinterCore.ts:58-69](../src/shared/linting/PatternLinterCore.ts#L58-L69) scans back only to the previous `\n` to count quote characters. If a quote opens on line N and closes on line N+2, text on line N+1 that's inside the quote is not recognized as dialogue.

**The fix:** scan back to the start of the current paragraph (either the start of the document, or the most recent double-newline). This handles the common case of multi-line dialogue within a paragraph without trying to solve cross-paragraph dialogue conventions (which get tangled in language-specific rules about continuing quotes).

**Files:**
- Create: `src/shared/linting/PatternLinterCore.test.ts`
- Modify: `src/shared/linting/PatternLinterCore.ts:58-69`

## Task 1.1: Write failing tests

**File:** `src/shared/linting/PatternLinterCore.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest';
import { PatternLinterCore } from './PatternLinterCore';
import { SPEData } from './types';

function makeData(): SPEData {
    return {
        cliches: {
            somatic_cliches: [
                {
                    phrase: 'shiver down his spine',
                    penalty_score: 5,
                    exclude_dialogue: true,
                    suggested_fix: 'use a specific sensory detail'
                }
            ]
        },
        names: {},
        places: {},
        protocols: {}
    };
}

describe('PatternLinterCore.isInsideQuotes (via lintText)', () => {
    const core = new PatternLinterCore();

    it('flags the phrase when it is outside any quotes', () => {
        const text = 'He felt a shiver down his spine as the door creaked.';
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain('shiver down his spine');
    });

    it('excludes the phrase when it is inside a single-line quoted dialogue', () => {
        const text = '"I felt a shiver down his spine," she whispered.';
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(0);
    });

    it('excludes the phrase when a multi-line quote opens before and closes after (same paragraph)', () => {
        const text = [
            '"This was the moment I always feared,"',
            'he said, voice trembling as a shiver down his spine',
            'made him clench his jaw. "I cannot face them now."'
        ].join('\n');
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(0);
    });

    it('flags the phrase when the opening quote is in a different paragraph', () => {
        const text = [
            '"This was the moment," he said.',
            '',
            'He stood alone, a shiver down his spine settling into dread.'
        ].join('\n');
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(1);
    });

    it('treats curly quotes the same as straight quotes', () => {
        const text = '\u201CI felt a shiver down his spine,\u201D she whispered.';
        const findings = core.lintText(text, makeData());
        expect(findings).toHaveLength(0);
    });
});
```

**Test design rationale:** five cases isolate the exact bug. Case 3 is the one currently failing (multi-line quote within a paragraph). Case 4 locks in the deliberate scoping decision — we do NOT treat cross-paragraph quotes as continuing dialogue. Case 5 protects against regressing curly-quote handling.

## Task 1.2: Run the tests to confirm the failure

- [ ] **Step 1: Run the shared-core tests**

```bash
cd fiction-linter/desktop
npm test -- PatternLinterCore
```

Expected: cases 1, 2, 4, and 5 pass. **Case 3 fails** with the finding count being 1 instead of 0 — that's the bug we're fixing.

If case 3 passes, the bug is either less severe than expected or the test is wrong; re-check the input text (the phrase `shiver down his spine` must span a line break from the opening quote).

## Task 1.3: Fix `isInsideQuotes`

**File:** `src/shared/linting/PatternLinterCore.ts:58-69`

- [ ] **Step 1: Replace the method**

Current implementation:

```ts
private isInsideQuotes(index: number, text: string): boolean {
    let quoteCount = 0;
    const lastNewline = text.lastIndexOf('\n', index);
    const searchStart = lastNewline === -1 ? 0 : lastNewline;

    for (let i = searchStart; i < index; i++) {
        if (text[i] === '"' || text[i] === '\u201C' || text[i] === '\u201D') {
            quoteCount++;
        }
    }
    return quoteCount % 2 !== 0;
}
```

Replace with:

```ts
private isInsideQuotes(index: number, text: string): boolean {
    // Scope quote counting to the current paragraph (bounded by blank lines
    // or document start). This handles multi-line quotes within a paragraph
    // without getting tangled in cross-paragraph dialogue conventions.
    const paragraphStart = text.lastIndexOf('\n\n', index);
    const searchStart = paragraphStart === -1 ? 0 : paragraphStart + 2;

    let quoteCount = 0;
    for (let i = searchStart; i < index; i++) {
        const ch = text[i];
        if (ch === '"' || ch === '\u201C' || ch === '\u201D') {
            quoteCount++;
        }
    }
    return quoteCount % 2 !== 0;
}
```

## Task 1.4: Run the tests to verify the fix

- [ ] **Step 1: Run shared-core tests**

```bash
cd fiction-linter/desktop
npm test -- PatternLinterCore
```

Expected: all 5 cases pass.

- [ ] **Step 2: Run the full test suite to confirm no regression**

```bash
npm test
```

Expected: all Phase 0 smoke tests + all Phase 1 shared-core tests pass.

## Task 1.5: Commit Phase 1

- [ ] **Step 1: Stage and commit**

```bash
cd fiction-linter
git add src/shared/linting/PatternLinterCore.ts src/shared/linting/PatternLinterCore.test.ts
git commit -m "$(cat <<'EOF'
core: fix isInsideQuotes scope for multi-line dialogue

The previous implementation scoped quote-counting to the current
line, which meant a phrase inside a multi-line quote was falsely
flagged. Scope now extends to the current paragraph (bounded by
blank lines or document start), which handles the common case
without tangling with cross-paragraph dialogue conventions.

Benefits both the VS Code extension and the desktop app via the
shared core.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 2: Debounce Lint + Click-to-Jump

**Why now:** both are small, prove the finding→position plumbing works end-to-end, and make the textarea-based app feel real before we rip it out in Phase 3.

**Files:**
- Modify: `desktop/src/App.jsx` (debounce useEffect, add `editorRef`, add `handleJumpToIssue`)
- Modify: `desktop/src/components/EditorPanel.jsx` (forwardRef so parent can focus + setSelectionRange)
- Modify: `desktop/src/components/IssueList.jsx` (accept `onJump` prop, wire button)
- Create: `desktop/src/App.debounce.test.jsx`
- Create: `desktop/src/components/IssueList.test.jsx`

## Task 2.1: Write the failing debounce test

**File:** `desktop/src/App.debounce.test.jsx`

- [ ] **Step 1: Write the test**

```jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatternLinterCore } from '@shared/linting';
import App from './App';

describe('App — lint debounce', () => {
    let lintSpy;

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        lintSpy = vi.spyOn(PatternLinterCore.prototype, 'lintText');

        // Minimal fs stubs — any YAML returns empty, manuscript returns some text.
        window.api.chooseFolder = async () => '/tmp';
        window.api.listDirectory = async () => [
            { name: 'story.md', path: '/tmp/story.md', isDirectory: false }
        ];
        window.api.readFile = async filePath => {
            if (filePath === '/tmp/story.md') {
                return { ok: true, contents: 'Initial content.' };
            }
            return { ok: true, contents: '{}' };
        };
        window.api.getSettings = async () => ({
            spePath: '/fake/spe',
            ai: { provider: '', model: '', apiKey: '', baseUrl: '' }
        });
    });

    afterEach(() => {
        lintSpy.mockRestore();
        vi.useRealTimers();
    });

    it('coalesces a burst of content changes into one lintText call per debounce window', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        render(<App />);
        await act(async () => { await Promise.resolve(); });

        // No content loaded yet → no lint calls.
        expect(lintSpy).not.toHaveBeenCalled();

        // Open folder, then click the file to load its content.
        await user.click(screen.getByRole('button', { name: /Open Folder/i }));
        await act(async () => { await Promise.resolve(); });
        await user.click(await screen.findByText('story.md'));
        await act(async () => { await Promise.resolve(); });

        // Debounce pending — still no lint calls.
        expect(lintSpy).not.toHaveBeenCalled();

        // Advance past the debounce window → exactly one lint call.
        await act(async () => { vi.advanceTimersByTime(350); });
        expect(lintSpy).toHaveBeenCalledTimes(1);

        // Type rapidly into the textarea.
        const textarea = screen.getByRole('textbox');
        await act(async () => { await user.type(textarea, 'XYZ'); });

        // Advance less than the debounce window → still only 1 call.
        await act(async () => { vi.advanceTimersByTime(100); });
        expect(lintSpy).toHaveBeenCalledTimes(1);

        // Advance past the window → one more call (total = 2, not 4).
        await act(async () => { vi.advanceTimersByTime(300); });
        expect(lintSpy).toHaveBeenCalledTimes(2);
    });
});
```

**Test design rationale:** spying on `PatternLinterCore.prototype.lintText` counts actual core invocations, which is what the debounce is meant to throttle. It does not depend on SPE rules, DOM output, or finding content — stub readFile returns `{}` for YAML and the spy still fires. The only assertion is call count, which is exactly what "debounce works" means operationally.

## Task 2.2: Run the test to confirm it fails

- [ ] **Step 1: Run**

```bash
cd fiction-linter/desktop
npm test -- App.debounce
```

Expected: test fails. The current lint effect runs synchronously, so `lintSpy` is called *before* `vi.advanceTimersByTime(350)` — the assertion `expect(lintSpy).not.toHaveBeenCalled()` after loading the file will fail. That's the signal that the debounce isn't in place yet.

## Task 2.3: Implement the debounce in App.jsx

**File:** `desktop/src/App.jsx:40-61`

- [ ] **Step 1: Replace the lint useEffect**

Current code:

```jsx
useEffect(() => {
    if (!content || !settings) {
        setIssues([]);
        return;
    }

    const findings = [
        ...patternCore.lintText(content, speData),
        ...nameCore.lintText(content, speData)
    ];

    const mapped = findings.map(finding => {
        const start = indexToLineCol(content, finding.start);
        return {
            ...finding,
            line: start.line,
            column: start.column
        };
    });

    setIssues(mapped);
}, [content, speData, patternCore, nameCore, settings]);
```

Replace with:

```jsx
useEffect(() => {
    if (!content || !settings) {
        setIssues([]);
        return;
    }

    const handle = setTimeout(() => {
        const findings = [
            ...patternCore.lintText(content, speData),
            ...nameCore.lintText(content, speData)
        ];

        const mapped = findings.map(finding => {
            const start = indexToLineCol(content, finding.start);
            return {
                ...finding,
                line: start.line,
                column: start.column
            };
        });

        setIssues(mapped);
    }, 300);

    return () => clearTimeout(handle);
}, [content, speData, patternCore, nameCore, settings]);
```

**Why 300ms:** short enough to feel instant on stop-typing, long enough to coalesce a full burst of typing. Matches the standard web-search autosuggest convention.

## Task 2.4: Run the debounce test

- [ ] **Step 1: Run**

```bash
npm test -- App.debounce
```

Expected: passes.

## Task 2.5: Add `onJump` prop to IssueList

**File:** `desktop/src/components/IssueList.jsx`

- [ ] **Step 1: Write a failing test for the jump button**

**File:** `desktop/src/components/IssueList.test.jsx`

```jsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IssueList from './IssueList';

const sampleIssues = [
    {
        start: 10,
        end: 18,
        message: 'Somatic Cliche: "released a breath". Penalty: 3.',
        severity: 'warning',
        line: 2,
        column: 4
    }
];

describe('IssueList', () => {
    it('renders a jump button for each issue and calls onJump on click', async () => {
        const onJump = vi.fn();
        const user = userEvent.setup();

        render(<IssueList issues={sampleIssues} onJump={onJump} />);

        const jumpButton = screen.getByRole('button', { name: /Jump to/i });
        await user.click(jumpButton);

        expect(onJump).toHaveBeenCalledWith(sampleIssues[0]);
    });

    it('renders a helpful empty-state when there are no issues', () => {
        render(<IssueList issues={[]} onJump={() => {}} />);
        expect(screen.getByText(/No lint findings yet/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- IssueList
```

Expected: the `renders a jump button` test fails — the current component renders `<div className="issue-card">` without a button.

- [ ] **Step 3: Rewrite IssueList**

Replace the full file:

```jsx
import React from 'react';

const severityLabels = {
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
};

function IssueList({ issues, onJump }) {
    if (!issues.length) {
        return (
            <section className="issues-panel empty">
                <h3>Lint Report</h3>
                <p>No lint findings yet. Load a file to see feedback.</p>
            </section>
        );
    }

    return (
        <section className="issues-panel">
            <h3>Lint Report</h3>
            <div className="issues-list">
                {issues.map((issue, index) => (
                    <div className={`issue-card ${issue.severity}`} key={`${issue.start}-${index}`}>
                        <div className="issue-meta">
                            <span className="issue-severity">{severityLabels[issue.severity] || 'Info'}</span>
                            <span className="issue-location">Line {issue.line}, Col {issue.column}</span>
                        </div>
                        <div className="issue-message">{issue.message}</div>
                        <div className="issue-actions">
                            <button
                                type="button"
                                className="ghost-button"
                                onClick={() => onJump?.(issue)}
                                aria-label={`Jump to line ${issue.line}, column ${issue.column}`}
                            >
                                Jump to {issue.line}:{issue.column}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default IssueList;
```

- [ ] **Step 4: Run the IssueList tests**

```bash
npm test -- IssueList
```

Expected: passes.

## Task 2.6: Forward a ref through EditorPanel

**File:** `desktop/src/components/EditorPanel.jsx`

- [ ] **Step 1: Rewrite EditorPanel with forwardRef**

```jsx
import React, { forwardRef } from 'react';

const EditorPanel = forwardRef(function EditorPanel({ file, content, dirty, onChange, onSave }, ref) {
    return (
        <section className="editor-panel">
            <div className="editor-header">
                <div>
                    <h2>{file ? file.name : 'No file selected'}</h2>
                    <p className="editor-path">{file ? file.path : 'Pick a file from the left panel.'}</p>
                </div>
                <div className="editor-actions">
                    <button className="primary-button" onClick={onSave} disabled={!file || !dirty}>
                        {dirty ? 'Save changes' : 'Saved'}
                    </button>
                </div>
            </div>
            <textarea
                ref={ref}
                className="editor-textarea"
                value={content}
                placeholder="Select a file to start editing."
                onChange={event => onChange(event.target.value)}
                spellCheck={false}
            />
        </section>
    );
});

export default EditorPanel;
```

**Why forwardRef:** the parent (`App.jsx`) needs direct access to the underlying `<textarea>` to call `focus()` and `setSelectionRange(start, end)`. React's idiomatic escape hatch for this is `forwardRef` — no ref-passing-via-prop hacks.

## Task 2.7: Wire the jump handler in App.jsx

**File:** `desktop/src/App.jsx`

- [ ] **Step 1: Add the ref import and jump handler**

At the top of `App.jsx`, add `useRef` to the React import:

```jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
```

Inside the `App` function, after the other `useState` calls, add:

```jsx
const editorRef = useRef(null);
```

Add the jump handler alongside the other `handle*` functions:

```jsx
const handleJumpToIssue = issue => {
    const textarea = editorRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(issue.start, issue.end);
    // Best-effort scroll — textarea doesn't expose a built-in "scroll to selection",
    // but focusing + selection typically scrolls the caret into view on most browsers.
};
```

- [ ] **Step 2: Pass the ref to EditorPanel and the handler to IssueList**

In the JSX, change:

```jsx
<EditorPanel
    file={currentFile}
    content={content}
    ...
/>
<IssueList issues={issues} />
```

to:

```jsx
<EditorPanel
    ref={editorRef}
    file={currentFile}
    content={content}
    ...
/>
<IssueList issues={issues} onJump={handleJumpToIssue} />
```

## Task 2.8: Run the full test suite

- [ ] **Step 1: Run all tests**

```bash
cd fiction-linter/desktop
npm test
```

Expected: all tests from Phase 0, Phase 1, and Phase 2 pass.

## Task 2.9: Manual smoke check

- [ ] **Step 1: Start the dev server**

```bash
cd fiction-linter/desktop
npm run dev
```

- [ ] **Step 2: Manually verify**

1. Open the app.
2. Click "Open Folder" and select a folder with a `.md` file containing `released a breath`.
3. Click the file in the tree.
4. Confirm the finding appears in the Lint Report.
5. Click "Jump to …" on the finding.
6. **Expected:** the textarea receives focus and the phrase is highlighted/selected.
7. Type rapidly in the textarea — the finding count should not flicker on every keystroke; it should settle ~300ms after you stop typing.

- [ ] **Step 3: Stop the dev server**

Ctrl+C in the dev terminal.

## Task 2.10: Commit Phase 2

- [ ] **Step 1: Stage and commit**

```bash
cd fiction-linter
git add desktop/src/App.jsx desktop/src/App.debounce.test.jsx desktop/src/components/EditorPanel.jsx desktop/src/components/IssueList.jsx desktop/src/components/IssueList.test.jsx
git commit -m "$(cat <<'EOF'
desktop: debounce lint + click-on-issue to jump

Lint now re-runs 300ms after the last keystroke instead of on
every input event, eliminating stutter on large files. Issues in
the lint report now have a "Jump to …" button that focuses the
editor and selects the offending range, validating the
finding→position plumbing end-to-end.

EditorPanel now uses forwardRef so the parent can reach the
textarea directly for focus+setSelectionRange — no prop drilling.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 3: CodeMirror 6 + Inline Diagnostics

**Why now:** Phase 2 made the textarea-based app usable. Phase 3 makes it feel native — inline red/yellow/blue squiggles matching the VS Code extension, gutter markers, and a proper jump-into-view. This is the biggest UX unlock in the plan.

**Design decisions committed:**
- **Library:** `@uiw/react-codemirror` (well-maintained React wrapper; avoids hand-rolling the Editor + EditorView lifecycle).
- **Language:** `@codemirror/lang-markdown` (most manuscripts are markdown).
- **Theme:** start with the light default; theming to match `styles.css` is a Phase 3.5 polish if needed.
- **Extension pattern:** a single custom `linter` extension fed by a React state prop that holds the current findings. We don't re-run linting *inside* CodeMirror; the React debounced lint from Phase 2 is still the source of truth, and we push the resulting diagnostics into CodeMirror via a `StateEffect`.

**Why push-based, not pull-based:** CodeMirror's `linter()` extension accepts a function that's called on its own schedule. Having it call `patternCore.lintText` would duplicate the debounce logic and fight React's state machine. Instead, we keep React as the orchestrator and treat CodeMirror as a dumb display surface for diagnostics. This keeps Phase 2's debounce, click-to-jump, and `IssueList` entirely working.

**Files:**
- Modify: `desktop/package.json` (add CodeMirror deps)
- Modify: `desktop/src/components/EditorPanel.jsx` (rewrite to use CodeMirror)
- Create: `desktop/src/components/lintBridge.js` — React↔CodeMirror diagnostics bridge
- Create: `desktop/src/components/lintBridge.test.js`
- Modify: `desktop/src/App.jsx` (change `handleJumpToIssue` to dispatch into the editor view)
- Modify: `desktop/src/styles.css` (CodeMirror scoped overrides)

## Task 3.1: Install CodeMirror dependencies

- [ ] **Step 1: Install**

```bash
cd fiction-linter/desktop
npm install @uiw/react-codemirror @codemirror/lang-markdown @codemirror/lint @codemirror/state @codemirror/view
```

Expected: five new entries in `dependencies`.

## Task 3.2: Write the lintBridge test

**File:** `desktop/src/components/lintBridge.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { findingsToDiagnostics } from './lintBridge';

describe('findingsToDiagnostics', () => {
    it('maps severity to CodeMirror diagnostic severity names', () => {
        const findings = [
            { start: 0, end: 4, message: 'a', severity: 'error' },
            { start: 5, end: 9, message: 'b', severity: 'warning' },
            { start: 10, end: 14, message: 'c', severity: 'info' }
        ];
        const diags = findingsToDiagnostics(findings);
        expect(diags).toHaveLength(3);
        expect(diags[0]).toMatchObject({ from: 0, to: 4, severity: 'error', message: 'a' });
        expect(diags[1]).toMatchObject({ from: 5, to: 9, severity: 'warning', message: 'b' });
        expect(diags[2]).toMatchObject({ from: 10, to: 14, severity: 'info', message: 'c' });
    });

    it('defaults missing severity to info', () => {
        const diags = findingsToDiagnostics([{ start: 0, end: 1, message: 'x' }]);
        expect(diags[0].severity).toBe('info');
    });

    it('returns an empty array for undefined or empty inputs', () => {
        expect(findingsToDiagnostics(undefined)).toEqual([]);
        expect(findingsToDiagnostics([])).toEqual([]);
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- lintBridge
```

Expected: fails — `lintBridge.js` does not exist yet.

## Task 3.3: Implement lintBridge

**File:** `desktop/src/components/lintBridge.js`

- [ ] **Step 1: Create the module**

```js
import { linter } from '@codemirror/lint';
import { StateEffect, StateField } from '@codemirror/state';

/**
 * Convert shared-core LintFinding objects to CodeMirror Diagnostic objects.
 *
 * LintFinding shape: { start, end, message, severity, source }
 * Severity is one of 'error' | 'warning' | 'info'.
 */
export function findingsToDiagnostics(findings) {
    if (!Array.isArray(findings)) return [];
    return findings.map(finding => ({
        from: finding.start,
        to: finding.end,
        severity: finding.severity || 'info',
        message: finding.message,
        source: finding.source || 'Fiction Linter'
    }));
}

/**
 * A StateEffect carries a new list of diagnostics into the editor.
 * We dispatch this from React whenever the debounced lint produces a new
 * findings array.
 */
export const setDiagnosticsEffect = StateEffect.define();

/**
 * A StateField holds the current diagnostics. The linter() extension reads
 * from it when the editor re-renders.
 */
export const diagnosticsField = StateField.define({
    create() {
        return [];
    },
    update(current, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setDiagnosticsEffect)) {
                return effect.value;
            }
        }
        return current;
    }
});

/**
 * A linter extension that reads diagnostics from the state field.
 * Returning the current diagnostics is synchronous — we never re-run linting
 * inside CodeMirror; React is the orchestrator.
 */
export const pushLinter = linter(view => view.state.field(diagnosticsField));

/**
 * Convenience bundle: all three extensions a consumer needs to wire
 * push-based diagnostics into a CodeMirror instance.
 */
export const lintBridgeExtensions = [diagnosticsField, pushLinter];
```

- [ ] **Step 2: Run the test**

```bash
npm test -- lintBridge
```

Expected: passes.

## Task 3.4: Rewrite EditorPanel with CodeMirror

**File:** `desktop/src/components/EditorPanel.jsx`

- [ ] **Step 1: Replace the whole file**

```jsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import {
    lintBridgeExtensions,
    setDiagnosticsEffect,
    findingsToDiagnostics
} from './lintBridge';

const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '15px'
    },
    '.cm-scroller': {
        fontFamily: '"Fraunces", Georgia, serif',
        lineHeight: '1.6'
    },
    '.cm-content': {
        padding: '24px 20px'
    }
});

const EditorPanel = forwardRef(function EditorPanel(
    { file, content, dirty, issues, onChange, onSave },
    ref
) {
    const viewRef = useRef(null);

    useImperativeHandle(ref, () => ({
        jumpTo(finding) {
            const view = viewRef.current;
            if (!view) return;
            const from = Math.max(0, Math.min(finding.start, view.state.doc.length));
            const to = Math.max(from, Math.min(finding.end, view.state.doc.length));
            view.dispatch({
                selection: { anchor: from, head: to },
                scrollIntoView: true,
                effects: EditorView.scrollIntoView(from, { y: 'center' })
            });
            view.focus();
        }
    }));

    const handleCreateEditor = view => {
        viewRef.current = view;
    };

    // Push current issues into the editor state whenever they change.
    React.useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
            effects: setDiagnosticsEffect.of(findingsToDiagnostics(issues || []))
        });
    }, [issues]);

    return (
        <section className="editor-panel">
            <div className="editor-header">
                <div>
                    <h2>{file ? file.name : 'No file selected'}</h2>
                    <p className="editor-path">{file ? file.path : 'Pick a file from the left panel.'}</p>
                </div>
                <div className="editor-actions">
                    <button className="primary-button" onClick={onSave} disabled={!file || !dirty}>
                        {dirty ? 'Save changes' : 'Saved'}
                    </button>
                </div>
            </div>
            <div className="editor-surface">
                <CodeMirror
                    value={content}
                    onChange={onChange}
                    onCreateEditor={handleCreateEditor}
                    extensions={[markdown(), editorTheme, ...lintBridgeExtensions]}
                    basicSetup={{
                        lineNumbers: true,
                        foldGutter: false,
                        highlightActiveLine: true,
                        autocompletion: false
                    }}
                    height="100%"
                />
            </div>
        </section>
    );
});

export default EditorPanel;
```

**Why `useImperativeHandle`:** CodeMirror doesn't expose a DOM ref that's directly compatible with `textarea.setSelectionRange`. We need to dispatch transactions into the `EditorView`. Rather than exposing the raw view to the parent (leaky), we expose a narrow `{ jumpTo(finding) }` interface. The parent treats the editor as a black box with one action.

## Task 3.5: Update App.jsx to use the new ref API

**File:** `desktop/src/App.jsx`

- [ ] **Step 1: Pass issues into EditorPanel and update the jump handler**

Find:

```jsx
const handleJumpToIssue = issue => {
    const textarea = editorRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(issue.start, issue.end);
};
```

Replace with:

```jsx
const handleJumpToIssue = issue => {
    editorRef.current?.jumpTo(issue);
};
```

Find the `<EditorPanel>` tag in the JSX and add an `issues={issues}` prop:

```jsx
<EditorPanel
    ref={editorRef}
    file={currentFile}
    content={content}
    dirty={dirty}
    issues={issues}
    onChange={value => {
        setContent(value);
        if (currentFile) {
            setDirty(true);
        }
    }}
    onSave={handleSave}
/>
```

## Task 3.6: Adjust the debounce test for CodeMirror

**File:** `desktop/src/App.debounce.test.jsx`

Phase 2's debounce test relies on `screen.getByRole('textbox')` plus `user.type` to trigger content changes. CodeMirror 6's contentDOM also has role `textbox`, but `user.type` against a CodeMirror contenteditable in jsdom is known to be unreliable. Since the test's job is to verify call counts on `PatternLinterCore.prototype.lintText`, we can bypass the DOM entirely and simulate content changes by driving `EditorPanel`'s onChange directly through React state.

- [ ] **Step 1: Replace the typing section**

Find this block in `App.debounce.test.jsx`:

```jsx
// Type rapidly into the textarea.
const textarea = screen.getByRole('textbox');
await act(async () => { await user.type(textarea, 'XYZ'); });

// Advance less than the debounce window → still only 1 call.
await act(async () => { vi.advanceTimersByTime(100); });
expect(lintSpy).toHaveBeenCalledTimes(1);

// Advance past the window → one more call (total = 2, not 4).
await act(async () => { vi.advanceTimersByTime(300); });
expect(lintSpy).toHaveBeenCalledTimes(2);
```

Replace with:

```jsx
// Simulate a burst of content changes by re-opening the file with
// different content. This drives App's `setContent` without
// poking CodeMirror's contenteditable (unreliable in jsdom).
window.api.readFile = async () => ({ ok: true, contents: 'Updated content one.' });
await act(async () => {
    await user.click(screen.getByText('story.md'));
});
window.api.readFile = async () => ({ ok: true, contents: 'Updated content two.' });
await act(async () => {
    await user.click(screen.getByText('story.md'));
});

// Advance less than the debounce window → still only 1 call.
await act(async () => { vi.advanceTimersByTime(100); });
expect(lintSpy).toHaveBeenCalledTimes(1);

// Advance past the window → one more call for the latest content.
await act(async () => { vi.advanceTimersByTime(300); });
expect(lintSpy).toHaveBeenCalledTimes(2);
```

**Why this works:** every file click pipes fresh content through `setContent → useEffect → setTimeout`. Two rapid clicks with fresh content is a "burst of content changes" for debounce purposes, and the call count assertion is unchanged. Nothing touches CodeMirror's DOM.

**Fallback:** if the test still flakes, delete the burst section entirely and keep only the initial-load assertion. That's weaker but not worthless — it still proves the debounce fires once, which is the regression we care about most.

## Task 3.7: Minimal CSS for the editor surface

**File:** `desktop/src/styles.css`

- [ ] **Step 1: Append to styles.css**

```css
/* --- CodeMirror surface (Phase 3) --- */
.editor-surface {
    flex: 1;
    min-height: 0;
    display: flex;
    background: var(--g-bg, #ffffff);
}

.editor-surface .cm-editor {
    flex: 1;
    min-width: 0;
}

.editor-surface .cm-editor.cm-focused {
    outline: none;
}
```

If `editor-panel` is currently a flex column, this "just works". If it's not, also add:

```css
.editor-panel {
    display: flex;
    flex-direction: column;
}
```

(Only add if the existing `.editor-panel` rule doesn't already set `flex-direction: column` — check first.)

## Task 3.8: Run the full test suite

- [ ] **Step 1: Run**

```bash
cd fiction-linter/desktop
npm test
```

Expected: all tests pass. If `App.debounce.test.jsx` fails due to CodeMirror contenteditable quirks, see the note in Task 3.6.

## Task 3.9: Manual smoke check

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify**

1. Open a folder, select a `.md` file with known lint issues.
2. **Expected:** red/yellow/blue underlines appear inline under the offending phrases. Gutter markers appear for each severity.
3. Hover an underline → tooltip shows the full message.
4. Click "Jump to …" on an issue in the Lint Report → editor scrolls to and highlights the range.
5. Type rapidly → no stutter; diagnostics refresh ~300ms after you stop.

- [ ] **Step 3: Stop the dev server**

## Task 3.10: Commit Phase 3

- [ ] **Step 1: Stage and commit**

```bash
cd fiction-linter
git add desktop/package.json desktop/package-lock.json desktop/src/components/EditorPanel.jsx desktop/src/components/lintBridge.js desktop/src/components/lintBridge.test.js desktop/src/App.jsx desktop/src/App.debounce.test.jsx desktop/src/styles.css
git commit -m "$(cat <<'EOF'
desktop: swap textarea for CodeMirror 6 with inline diagnostics

The editor is now CodeMirror 6 via @uiw/react-codemirror, with
markdown syntax and a push-based linter bridge. React remains the
orchestrator — the debounced lint effect dispatches a StateEffect
into the editor view whenever findings change, so CodeMirror
never re-runs linting on its own schedule.

EditorPanel exposes a narrow { jumpTo(finding) } interface via
useImperativeHandle, so App.jsx doesn't need to know the editor's
internals. Click-to-jump from IssueList now scrolls the range
into view and focuses the editor.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 4: YAML Loading in Main Process

**Why now:** the renderer currently calls `fs:readFile` four times (once per yaml file) and parses each with a renderer-side `js-yaml` import. That bundles a YAML parser into the browser bundle for no reason and costs extra IPC round-trips on every settings change. Moving it to main is mechanical and independently valuable.

**Files:**
- Modify: `desktop/electron/main.js` (add `spe:load` handler)
- Modify: `desktop/electron/preload.js` (expose `loadSpeData`)
- Modify: `desktop/src/App.jsx` (replace `loadSpeData` helper with `window.api.loadSpeData`)
- Modify: `desktop/package.json` (move `js-yaml` from implicit usage to main-only awareness — it stays in `dependencies`, but the renderer no longer imports it)

## Task 4.1: Add `spe:load` IPC handler

**File:** `desktop/electron/main.js`

- [ ] **Step 1: Add the js-yaml import**

At the top of the file (after `const fs = require('fs');`):

```js
const yaml = require('js-yaml');
```

- [ ] **Step 2: Add the handler**

After the existing `ipcMain.handle('settings:set', ...)` block, append:

```js
const SPE_FILES = [
    { key: 'cliches', name: 'cliche_collider.yaml' },
    { key: 'names', name: 'name_collider.yaml' },
    { key: 'places', name: 'place_collider.yaml' },
    { key: 'protocols', name: 'line_editing_protocol.yaml' }
];

ipcMain.handle('spe:load', async (_event, spePath) => {
    const empty = { cliches: {}, names: {}, places: {}, protocols: {} };
    if (!spePath || !fs.existsSync(spePath)) {
        return empty;
    }

    const result = { ...empty };
    for (const file of SPE_FILES) {
        const filePath = path.join(spePath, file.name);
        if (!fs.existsSync(filePath)) continue;
        try {
            const contents = fs.readFileSync(filePath, 'utf8');
            result[file.key] = yaml.load(contents) || {};
        } catch (error) {
            // Preserve empty default for this key; log to main console.
            console.error(`spe:load failed for ${file.name}:`, error);
            result[file.key] = {};
        }
    }
    return result;
});
```

**Why the constant at module level:** the file list is the exact same set as what's currently in `App.jsx`. Centralizing it in main makes "add a new YAML" a one-place change and puts the authoritative list next to the parser.

## Task 4.2: Expose `loadSpeData` via preload

**File:** `desktop/electron/preload.js`

- [ ] **Step 1: Add the new method**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    chooseFolder: () => ipcRenderer.invoke('dialog:chooseFolder'),
    listDirectory: dirPath => ipcRenderer.invoke('fs:listDirectory', dirPath),
    readFile: filePath => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, contents) => ipcRenderer.invoke('fs:writeFile', { filePath, contents }),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: settings => ipcRenderer.invoke('settings:set', settings),
    loadSpeData: spePath => ipcRenderer.invoke('spe:load', spePath)
});
```

## Task 4.3: Replace the renderer-side loader in App.jsx

**File:** `desktop/src/App.jsx`

- [ ] **Step 1: Remove the js-yaml import**

Delete this line at the top:

```jsx
import yaml from 'js-yaml';
```

- [ ] **Step 2: Replace `loadSpeData`**

Find the current helper:

```jsx
async function loadSpeData(spePath) {
    const files = [
        { key: 'cliches', name: 'cliche_collider.yaml' },
        { key: 'names', name: 'name_collider.yaml' },
        { key: 'places', name: 'place_collider.yaml' },
        { key: 'protocols', name: 'line_editing_protocol.yaml' }
    ];

    const result = { ...emptyData };

    for (const file of files) {
        const response = await window.api.readFile(joinPath(spePath, file.name));
        if (!response.ok) {
            continue;
        }
        try {
            result[file.key] = yaml.load(response.contents) || {};
        } catch (error) {
            result[file.key] = {};
        }
    }

    return result;
}
```

Delete it entirely.

- [ ] **Step 3: Update the effect that calls it**

Find:

```jsx
useEffect(() => {
    if (!settings?.spePath) return;
    loadSpeData(settings.spePath).then(setSpeData);
}, [settings?.spePath]);
```

Replace with:

```jsx
useEffect(() => {
    if (!settings?.spePath) return;
    window.api.loadSpeData(settings.spePath).then(setSpeData);
}, [settings?.spePath]);
```

- [ ] **Step 4: Delete the now-unused `joinPath` helper**

Find and delete this function (it was only used by the old `loadSpeData`):

```jsx
function joinPath(basePath, leaf) {
    if (!basePath) return leaf;
    const needsSeparator = !basePath.endsWith('/') && !basePath.endsWith('\\');
    const separator = basePath.includes('\\') ? '\\' : '/';
    return `${basePath}${needsSeparator ? separator : ''}${leaf}`;
}
```

(If your linter complains about the unused import for `joinPath`, it was never imported — it was a local helper. Just delete the function definition.)

## Task 4.4: Update the test setup's stub to match

**File:** `desktop/src/test/setup.js`

- [ ] **Step 1: Confirm `loadSpeData` is already stubbed**

The Phase 0 setup already included `loadSpeData: async () => ({ cliches: {}, ... })` — nothing to do here. If for some reason it's missing, add it to the stubbed `window.api` object.

## Task 4.5: Run the test suite

- [ ] **Step 1: Run**

```bash
cd fiction-linter/desktop
npm test
```

Expected: all tests pass. The tests that use `window.api.loadSpeData` in Phase 2's debounce test should already work because they stub it.

## Task 4.6: Manual smoke check

- [ ] **Step 1: Dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify**

1. Open a folder containing a manuscript that triggers known lint rules.
2. Confirm findings still appear (proves main-side YAML loading works).
3. Open settings, change `spePath` to an invalid path, save.
4. Confirm the app does NOT crash — `spe:load` should return empty data and the lint report should empty out.
5. Restore the settings spePath, reload, confirm findings come back.

- [ ] **Step 3: Stop the dev server**

## Task 4.7: Commit Phase 4

- [ ] **Step 1: Stage and commit**

```bash
cd fiction-linter
git add desktop/electron/main.js desktop/electron/preload.js desktop/src/App.jsx
git commit -m "$(cat <<'EOF'
desktop: move YAML parsing to main process via spe:load IPC

The renderer no longer imports js-yaml or calls fs:readFile
four times per settings change. spe:load lives in main.js, reads
and parses all four SPE files in one call, and returns a
structured object. Invalid/missing paths return empty data
instead of crashing the renderer.

Shrinks the renderer bundle and consolidates the file list in
one place.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 5: AI — Explain + Suggest Rewrite

**Why this scope:** the existing `settings.ai` plumbing (provider, model, apiKey, baseUrl) already maps perfectly to OpenAI-compatible chat completions endpoints. The smallest useful feature that exercises all four fields is *per-finding* actions: click "Explain" to get a one-paragraph explanation of why the finding is flagged; click "Suggest rewrite" to get 2-3 candidate rewrites of the sentence containing the finding.

**Scope boundaries we're NOT crossing in this phase:**
- No streaming — single-shot response, displayed when complete. Streaming is a polish task.
- No chat history — each click is an independent request. No conversation state.
- No model picker UI beyond the existing single `model` text input.
- No token counting, no cost display. Optional future work.
- No retry-on-failure. If a request fails, show the error and let the user click again.

**Architecture:**
- The API key never enters the renderer. The renderer sends `{ kind: 'explain' | 'rewrite', finding, context }` to main. Main reads `settings.ai` from disk (*not* from the renderer-supplied payload) and calls the provider. This prevents accidental leakage of the key into logs or React devtools.
- The provider is assumed OpenAI-compatible. This covers OpenAI, OpenRouter, Ollama, LM Studio, llama.cpp server, and Anthropic via compatibility gateways. A future task could add native Anthropic support; for now, users who want Anthropic point at an OpenAI-compatible proxy.

**Files:**
- Create: `desktop/electron/aiClient.js` — the provider call (pure function, testable without Electron)
- Create: `desktop/electron/aiClient.test.js`
- Create: `desktop/electron/prompts.js` — the system + user prompt templates
- Modify: `desktop/electron/main.js` (add `ai:complete` handler)
- Modify: `desktop/electron/preload.js` (expose `aiComplete`)
- Modify: `desktop/src/components/IssueList.jsx` (add Explain and Rewrite buttons, show response inline)
- Modify: `desktop/src/test/setup.js` (update `aiComplete` stub shape)
- Create: `desktop/src/components/IssueList.ai.test.jsx`

## Task 5.1: Write the prompt templates

**File:** `desktop/electron/prompts.js`

**Module format note:** Electron main uses CommonJS (`require`). This file uses `module.exports` so `main.js` can `require` it directly. Vitest handles CJS imports via built-in interop — the matching tests use `require` the same way.

- [ ] **Step 1: Create the file**

```js
/**
 * Prompt templates for the Fiction Linter AI actions.
 *
 * These templates are intentionally short and opinionated. They assume the
 * receiving model is an OpenAI-compatible chat completions endpoint.
 */

const SYSTEM_EXPLAIN =
    'You are a line editor for literary fiction. A linting tool has flagged a phrase. ' +
    'Explain in 2-3 sentences why the flagged phrase weakens the prose. Be specific and concrete. ' +
    'Do not suggest rewrites. Do not moralize. Do not pad the response with preamble.';

const SYSTEM_REWRITE =
    'You are a line editor for literary fiction. A linting tool has flagged a phrase in a sentence. ' +
    'Return exactly three alternative rewrites of the sentence, each on its own line, ' +
    'prefixed with "1.", "2.", "3.". Preserve the author\'s meaning and voice. ' +
    'Do not add commentary, preamble, or explanations.';

function buildExplainMessages({ finding, snippet }) {
    return [
        { role: 'system', content: SYSTEM_EXPLAIN },
        {
            role: 'user',
            content: [
                `Flagged: ${finding.message}`,
                `Severity: ${finding.severity || 'info'}`,
                '',
                'Surrounding sentence:',
                snippet
            ].join('\n')
        }
    ];
}

function buildRewriteMessages({ finding, snippet }) {
    return [
        { role: 'system', content: SYSTEM_REWRITE },
        {
            role: 'user',
            content: [
                `Flagged: ${finding.message}`,
                '',
                'Original sentence:',
                snippet
            ].join('\n')
        }
    ];
}

module.exports = {
    buildExplainMessages,
    buildRewriteMessages,
    SYSTEM_EXPLAIN,
    SYSTEM_REWRITE
};
```

**Why `finding.message` and not a separate `phrase` field:** the `LintFinding` type in [types.ts](../../../src/shared/linting/types.ts) has no `phrase` field — the phrase is already embedded in `message` as `Category: "phrase". Penalty: N. Fix: ...`. The model parses that fine, and we avoid a shared-core change that this phase doesn't need.

## Task 5.2: Write the aiClient test

**File:** `desktop/electron/aiClient.test.js`

- [ ] **Step 1: Write the failing test**

```js
const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest');
const { callChatCompletion } = require('./aiClient');

describe('callChatCompletion', () => {
    const realFetch = global.fetch;

    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = realFetch;
    });

    it('POSTs to {baseUrl}/chat/completions with a bearer token', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                choices: [{ message: { role: 'assistant', content: 'hello' } }]
            })
        });

        const result = await callChatCompletion({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'sk-test-abc',
            model: 'openai/gpt-4.1-mini',
            messages: [{ role: 'user', content: 'hi' }]
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://api.example.com/v1/chat/completions');
        expect(options.method).toBe('POST');
        expect(options.headers['Authorization']).toBe('Bearer sk-test-abc');
        expect(options.headers['Content-Type']).toBe('application/json');
        const body = JSON.parse(options.body);
        expect(body.model).toBe('openai/gpt-4.1-mini');
        expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);

        expect(result).toEqual({ ok: true, content: 'hello' });
    });

    it('trims trailing slash on baseUrl', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: 'x' } }] })
        });

        await callChatCompletion({
            baseUrl: 'https://api.example.com/v1/',
            apiKey: 'k',
            model: 'm',
            messages: []
        });

        expect(global.fetch.mock.calls[0][0]).toBe('https://api.example.com/v1/chat/completions');
    });

    it('returns { ok: false, error } on non-2xx', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: { message: 'unauthorized' } })
        });

        const result = await callChatCompletion({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'bad',
            model: 'm',
            messages: []
        });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('401');
    });

    it('returns { ok: false, error } on network failure', async () => {
        global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

        const result = await callChatCompletion({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'k',
            model: 'm',
            messages: []
        });

        expect(result.ok).toBe(false);
        expect(result.error).toContain('ECONNREFUSED');
    });

    it('returns { ok: false } when baseUrl or apiKey is missing', async () => {
        const result = await callChatCompletion({
            baseUrl: '',
            apiKey: '',
            model: 'm',
            messages: []
        });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/missing/i);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd fiction-linter/desktop
npm test -- aiClient
```

Expected: fails — `aiClient.js` does not exist.

## Task 5.3: Implement aiClient

**File:** `desktop/electron/aiClient.js`

- [ ] **Step 1: Create the file**

```js
/**
 * Thin OpenAI-compatible chat completions client.
 *
 * Uses Node's built-in fetch (Electron 31 bundles a recent Node).
 * Intentionally dependency-free so it's trivially unit-testable.
 */

async function callChatCompletion({ baseUrl, apiKey, model, messages, temperature }) {
    if (!baseUrl || !apiKey) {
        return { ok: false, error: 'Missing baseUrl or apiKey.' };
    }

    const trimmedBase = baseUrl.replace(/\/+$/, '');
    const url = `${trimmedBase}/chat/completions`;

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: typeof temperature === 'number' ? temperature : 0.7
            })
        });
    } catch (err) {
        return { ok: false, error: `Network error: ${err.message}` };
    }

    if (!response.ok) {
        let detail = '';
        try {
            const payload = await response.json();
            detail = payload?.error?.message || JSON.stringify(payload).slice(0, 300);
        } catch {
            detail = await response.text().catch(() => '');
        }
        return { ok: false, error: `${response.status} ${detail}`.trim() };
    }

    try {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content ?? '';
        return { ok: true, content };
    } catch (err) {
        return { ok: false, error: `Invalid response: ${err.message}` };
    }
}

module.exports = { callChatCompletion };
```

- [ ] **Step 2: Run the tests**

```bash
npm test -- aiClient
```

Expected: all 5 test cases pass.

## Task 5.4: Add `ai:complete` IPC handler

**File:** `desktop/electron/main.js`

- [ ] **Step 1: Add the imports**

Near the top of the file (with other `require`s):

```js
const { callChatCompletion } = require('./aiClient');
const { buildExplainMessages, buildRewriteMessages } = require('./prompts');
```

- [ ] **Step 2: Add the handler**

After the `spe:load` handler, append:

```js
ipcMain.handle('ai:complete', async (_event, payload) => {
    const { kind, finding, snippet } = payload || {};
    if (kind !== 'explain' && kind !== 'rewrite') {
        return { ok: false, error: `Unknown kind: ${kind}` };
    }
    if (!finding || !snippet) {
        return { ok: false, error: 'Missing finding or snippet.' };
    }

    // Read settings from disk — do NOT trust payload. Keeps the key
    // out of renderer-supplied data entirely.
    const settings = readSettings();
    const messages = kind === 'explain'
        ? buildExplainMessages({ finding, snippet })
        : buildRewriteMessages({ finding, snippet });

    return callChatCompletion({
        baseUrl: settings.ai.baseUrl,
        apiKey: settings.ai.apiKey,
        model: settings.ai.model,
        messages
    });
});
```

## Task 5.5: Expose `aiComplete` via preload

**File:** `desktop/electron/preload.js`

- [ ] **Step 1: Add the method**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    chooseFolder: () => ipcRenderer.invoke('dialog:chooseFolder'),
    listDirectory: dirPath => ipcRenderer.invoke('fs:listDirectory', dirPath),
    readFile: filePath => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, contents) => ipcRenderer.invoke('fs:writeFile', { filePath, contents }),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: settings => ipcRenderer.invoke('settings:set', settings),
    loadSpeData: spePath => ipcRenderer.invoke('spe:load', spePath),
    aiComplete: payload => ipcRenderer.invoke('ai:complete', payload)
});
```

## Task 5.6: Write the IssueList AI test

**File:** `desktop/src/components/IssueList.ai.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IssueList from './IssueList';

const sampleIssue = {
    start: 10,
    end: 18,
    message: 'Somatic Cliche: "released a breath". Penalty: 3.',
    severity: 'warning',
    line: 2,
    column: 4
};

describe('IssueList — AI actions', () => {
    beforeEach(() => {
        window.api.aiComplete = vi.fn();
    });

    it('calls aiComplete with kind=explain when Explain is clicked', async () => {
        window.api.aiComplete.mockResolvedValue({ ok: true, content: 'Because it is tired.' });
        const user = userEvent.setup();

        render(
            <IssueList
                issues={[sampleIssue]}
                onJump={() => {}}
                getSnippet={() => 'He released a breath he had been holding.'}
            />
        );

        await user.click(screen.getByRole('button', { name: /Explain/i }));

        expect(window.api.aiComplete).toHaveBeenCalledWith({
            kind: 'explain',
            finding: sampleIssue,
            snippet: 'He released a breath he had been holding.'
        });
        expect(await screen.findByText(/Because it is tired/)).toBeInTheDocument();
    });

    it('shows a loading state then the rewrite content', async () => {
        let resolveFn;
        window.api.aiComplete.mockImplementation(
            () => new Promise(r => { resolveFn = r; })
        );
        const user = userEvent.setup();

        render(
            <IssueList
                issues={[sampleIssue]}
                onJump={() => {}}
                getSnippet={() => 'Snippet.'}
            />
        );

        await user.click(screen.getByRole('button', { name: /Suggest rewrite/i }));
        expect(screen.getByText(/Thinking/i)).toBeInTheDocument();

        resolveFn({ ok: true, content: '1. Alpha\n2. Bravo\n3. Charlie' });
        expect(await screen.findByText(/Alpha/)).toBeInTheDocument();
    });

    it('displays an error when aiComplete fails', async () => {
        window.api.aiComplete.mockResolvedValue({ ok: false, error: '401 unauthorized' });
        const user = userEvent.setup();

        render(
            <IssueList
                issues={[sampleIssue]}
                onJump={() => {}}
                getSnippet={() => 'Snippet.'}
            />
        );

        await user.click(screen.getByRole('button', { name: /Explain/i }));
        expect(await screen.findByText(/401 unauthorized/)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- IssueList.ai
```

Expected: fails — IssueList has no Explain/Rewrite buttons yet.

## Task 5.7: Add AI actions to IssueList

**File:** `desktop/src/components/IssueList.jsx`

- [ ] **Step 1: Rewrite the component**

```jsx
import React, { useState } from 'react';

const severityLabels = {
    error: 'Error',
    warning: 'Warning',
    info: 'Info'
};

function IssueList({ issues, onJump, getSnippet }) {
    const [responses, setResponses] = useState({});

    const callAi = async (issue, kind) => {
        const key = `${issue.start}-${issue.end}-${kind}`;
        setResponses(prev => ({ ...prev, [key]: { loading: true } }));

        try {
            const snippet = getSnippet?.(issue) ?? issue.message;
            const result = await window.api.aiComplete({ kind, finding: issue, snippet });
            setResponses(prev => ({
                ...prev,
                [key]: result.ok
                    ? { content: result.content }
                    : { error: result.error || 'Request failed.' }
            }));
        } catch (err) {
            setResponses(prev => ({
                ...prev,
                [key]: { error: err.message }
            }));
        }
    };

    if (!issues.length) {
        return (
            <section className="issues-panel empty">
                <h3>Lint Report</h3>
                <p>No lint findings yet. Load a file to see feedback.</p>
            </section>
        );
    }

    return (
        <section className="issues-panel">
            <h3>Lint Report</h3>
            <div className="issues-list">
                {issues.map((issue, index) => {
                    const explainKey = `${issue.start}-${issue.end}-explain`;
                    const rewriteKey = `${issue.start}-${issue.end}-rewrite`;
                    const explain = responses[explainKey];
                    const rewrite = responses[rewriteKey];

                    return (
                        <div className={`issue-card ${issue.severity}`} key={`${issue.start}-${index}`}>
                            <div className="issue-meta">
                                <span className="issue-severity">{severityLabels[issue.severity] || 'Info'}</span>
                                <span className="issue-location">Line {issue.line}, Col {issue.column}</span>
                            </div>
                            <div className="issue-message">{issue.message}</div>
                            <div className="issue-actions">
                                <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => onJump?.(issue)}
                                    aria-label={`Jump to line ${issue.line}, column ${issue.column}`}
                                >
                                    Jump to {issue.line}:{issue.column}
                                </button>
                                <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => callAi(issue, 'explain')}
                                    disabled={explain?.loading}
                                >
                                    {explain?.loading ? 'Thinking…' : 'Explain'}
                                </button>
                                <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => callAi(issue, 'rewrite')}
                                    disabled={rewrite?.loading}
                                >
                                    {rewrite?.loading ? 'Thinking…' : 'Suggest rewrite'}
                                </button>
                            </div>
                            {explain && !explain.loading ? (
                                <div className="issue-ai-response">
                                    <div className="ai-label">Explanation</div>
                                    <div className="ai-body">{explain.content || explain.error}</div>
                                </div>
                            ) : null}
                            {rewrite && !rewrite.loading ? (
                                <div className="issue-ai-response">
                                    <div className="ai-label">Suggested rewrites</div>
                                    <pre className="ai-body">{rewrite.content || rewrite.error}</pre>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default IssueList;
```

**Why `getSnippet` as a prop:** IssueList doesn't own the document text, so it can't extract the surrounding sentence itself. The parent (`App.jsx`) is the only component that knows the `content`. Passing a `getSnippet(issue) → string` callback keeps IssueList pure and testable (the test passes a stub, the real app passes a real extractor).

## Task 5.8: Wire `getSnippet` through App.jsx

**File:** `desktop/src/App.jsx`

- [ ] **Step 1: Add a snippet extractor**

Inside the `App` function, add:

```jsx
const getSnippet = issue => {
    // Extract the surrounding sentence for the finding. A "sentence" here is
    // a simple heuristic: from the previous sentence terminator (., !, ?, \n)
    // to the next one. Good enough for an AI prompt.
    const before = content.slice(0, issue.start);
    const after = content.slice(issue.end);

    const prevBreak = Math.max(
        before.lastIndexOf('. '),
        before.lastIndexOf('! '),
        before.lastIndexOf('? '),
        before.lastIndexOf('\n')
    );
    const nextBreak = (() => {
        const candidates = [
            after.indexOf('. '),
            after.indexOf('! '),
            after.indexOf('? '),
            after.indexOf('\n')
        ].filter(i => i !== -1);
        return candidates.length ? Math.min(...candidates) : after.length;
    })();

    const startIdx = prevBreak === -1 ? 0 : prevBreak + 2;
    const endIdx = issue.end + nextBreak + 1;
    return content.slice(startIdx, Math.min(endIdx, content.length)).trim();
};
```

- [ ] **Step 2: Pass `getSnippet` to IssueList**

In the JSX, change:

```jsx
<IssueList issues={issues} onJump={handleJumpToIssue} />
```

to:

```jsx
<IssueList issues={issues} onJump={handleJumpToIssue} getSnippet={getSnippet} />
```

## Task 5.9: Update the test setup aiComplete stub

**File:** `desktop/src/test/setup.js`

- [ ] **Step 1: Ensure aiComplete is stubbed with the new shape**

The existing stub returns `{ ok: false, error: 'stub' }` — this is the right default (tests that care will override it). No changes needed unless the Phase 0 setup skipped it; double-check the file matches what was specified in Phase 0 Task 0.3.

## Task 5.10: Add CSS for the AI response blocks

**File:** `desktop/src/styles.css`

- [ ] **Step 1: Append**

```css
.issue-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
}

.issue-ai-response {
    margin-top: 10px;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.04);
    border-left: 3px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
}

.ai-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.7;
    margin-bottom: 4px;
}

.ai-body {
    font-family: inherit;
    font-size: 13px;
    white-space: pre-wrap;
    margin: 0;
}
```

## Task 5.11: Run the test suite

- [ ] **Step 1: Run**

```bash
cd fiction-linter/desktop
npm test
```

Expected: all tests green across phases 0-5.

## Task 5.12: Manual smoke check with a real API key

- [ ] **Step 1: Set up credentials**

Open the app (`npm run dev`), open Settings, and fill in:
- Provider: `openrouter` (or your provider of choice)
- Model: a small cheap model (e.g. `openai/gpt-4.1-mini`, `openrouter/auto`, or `ollama/llama3` if running locally)
- Base URL: `https://openrouter.ai/api/v1` (or `http://localhost:11434/v1` for Ollama)
- API Key: your key (left blank for local Ollama)

Save.

- [ ] **Step 2: Trigger an AI action**

1. Open a manuscript with a known finding.
2. Click "Explain" on a finding.
3. **Expected:** button shows "Thinking…", then an explanation appears below the card after a few seconds.
4. Click "Suggest rewrite" on the same finding.
5. **Expected:** three numbered alternatives appear below.
6. Click "Explain" on a different finding — responses should be independent per finding, not cross-contaminated.

- [ ] **Step 3: Test the error path**

1. Open Settings, set API Key to `invalid`, save.
2. Click "Explain" on a finding.
3. **Expected:** an error message appears in the response block (e.g. `401 ...`).
4. Fix the key, retry — the old error should clear when the new response arrives (the `responses[key]` replaces it).

## Task 5.13: Commit Phase 5

- [ ] **Step 1: Stage and commit**

```bash
cd fiction-linter
git add desktop/electron/aiClient.js desktop/electron/aiClient.test.js desktop/electron/prompts.js desktop/electron/main.js desktop/electron/preload.js desktop/src/components/IssueList.jsx desktop/src/components/IssueList.ai.test.jsx desktop/src/App.jsx desktop/src/styles.css
git commit -m "$(cat <<'EOF'
desktop: add per-finding AI explain + rewrite actions

Each lint finding now has Explain and Suggest rewrite buttons
that call an OpenAI-compatible chat completions endpoint via the
new ai:complete IPC handler. The API key lives only in main
process settings — the renderer never sees it and the handler
reads credentials from disk rather than from the renderer payload.

aiClient.js is a dependency-free wrapper around Node 18+ fetch,
tested in isolation. prompts.js holds the system/user templates
for the two actions. IssueList keeps per-finding response state
keyed by {start, end, kind} so multiple findings don't clobber
each other.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 6: electron-builder Packaging

**Why last:** everything else works in `npm run dev`. Packaging is the step that transforms the scaffold into a distributable app, and it's where the latent `getDefaultSpePath()` bug (`app.getAppPath()` resolves into `app.asar` when packaged) finally gets exposed.

**Decisions committed:**
- **Tool:** `electron-builder` (simpler than electron-forge for a first pass; no webpack config to write).
- **Targets:** macOS only for the first pass (the user is on Darwin). Windows/Linux are a one-line addition to the config later.
- **Signing:** unsigned. Users will need to right-click → Open the first time. Signing + notarization is future work that requires Apple Developer credentials.
- **Bundled resources:** `resources/spe_defaults/` is copied into the app bundle via `extraResources`, so the default rule pack ships with the app.

**Files:**
- Modify: `desktop/package.json` (add `electron-builder` devDep + `build` config + `dist` scripts)
- Modify: `desktop/electron/main.js:7-9` (fix `getDefaultSpePath`)
- Create: `desktop/electron/main.spePath.test.js` (regression test for the fix)

## Task 6.1: Install electron-builder

- [ ] **Step 1: Install**

```bash
cd fiction-linter/desktop
npm install --save-dev electron-builder
```

## Task 6.2: Add build config to package.json

**File:** `desktop/package.json`

- [ ] **Step 1: Add the build block**

Append to `package.json` (after the `devDependencies` block — top level, not nested):

```json
"build": {
    "appId": "com.ocotilloquill.fictionlinter.desktop",
    "productName": "Fiction Linter",
    "directories": {
        "output": "release"
    },
    "files": [
        "electron/**/*",
        "dist/**/*",
        "package.json"
    ],
    "extraResources": [
        {
            "from": "../resources/spe_defaults",
            "to": "spe_defaults",
            "filter": ["**/*.yaml"]
        }
    ],
    "mac": {
        "category": "public.app-category.productivity",
        "target": [
            { "target": "dmg", "arch": ["arm64", "x64"] }
        ],
        "identity": null
    }
}
```

- [ ] **Step 2: Add the dist script**

In the `scripts` block, add:

```json
"dist": "npm run build && electron-builder --mac"
```

The full `scripts` block should now read:

```json
"scripts": {
    "dev": "VITE_DEV_SERVER_URL=http://localhost:5173 concurrently \"vite\" \"electron .\"",
    "build": "vite build",
    "start": "electron .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "dist": "npm run build && electron-builder --mac"
}
```

**Note on `identity: null`:** this explicitly disables code signing. Without it, electron-builder will complain about a missing Developer ID on macOS. `null` tells it "we know, ship unsigned."

## Task 6.3: Write the failing regression test for `getDefaultSpePath`

**File:** `desktop/electron/main.spePath.test.js`

- [ ] **Step 1: Write the test**

```js
const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest');
const path = require('path');

// Mock electron before requiring the helper.
const mockApp = {
    isPackaged: false,
    getAppPath: () => '/fake/project/desktop'
};

vi.mock('electron', () => ({
    app: mockApp,
    BrowserWindow: class {},
    ipcMain: { handle: vi.fn() },
    dialog: { showOpenDialog: vi.fn() }
}));

// We cannot require main.js directly because it calls app.whenReady().then(createWindow)
// at module load. Instead, we extract the helper into a separate module in Task 6.4
// and import that. See the note below.

const { getDefaultSpePath } = require('./spePath');

describe('getDefaultSpePath', () => {
    beforeEach(() => {
        mockApp.isPackaged = false;
    });

    it('resolves to ../resources/spe_defaults in dev mode', () => {
        mockApp.isPackaged = false;
        mockApp.getAppPath = () => '/fake/project/desktop';
        const result = getDefaultSpePath({ app: mockApp, resourcesPath: '/irrelevant' });
        expect(result).toBe(path.resolve('/fake/project/desktop', '..', 'resources', 'spe_defaults'));
    });

    it('resolves to process.resourcesPath/spe_defaults when packaged', () => {
        mockApp.isPackaged = true;
        const result = getDefaultSpePath({
            app: mockApp,
            resourcesPath: '/Applications/Fiction Linter.app/Contents/Resources'
        });
        expect(result).toBe('/Applications/Fiction Linter.app/Contents/Resources/spe_defaults');
    });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- spePath
```

Expected: fails — `./spePath` module does not exist.

## Task 6.4: Extract `getDefaultSpePath` into its own module

**File:** `desktop/electron/spePath.js` (new)

- [ ] **Step 1: Create the module**

```js
const path = require('path');

/**
 * Resolve the default SPE rules directory.
 *
 * In dev mode, the project's `resources/spe_defaults/` sits next to
 * `desktop/` — `app.getAppPath()` returns the desktop directory, so
 * walking up one level + `resources/spe_defaults` is correct.
 *
 * In packaged mode, the resources are copied into the app bundle via
 * electron-builder's `extraResources` config. At runtime they live at
 * `process.resourcesPath/spe_defaults`. `app.getAppPath()` would point
 * inside `app.asar`, which is wrong.
 *
 * Accepts its dependencies as a parameter for testability.
 */
function getDefaultSpePath({ app, resourcesPath } = {}) {
    const _app = app || require('electron').app;
    const _resources = resourcesPath || process.resourcesPath;

    if (_app.isPackaged) {
        return path.join(_resources, 'spe_defaults');
    }
    return path.resolve(_app.getAppPath(), '..', 'resources', 'spe_defaults');
}

module.exports = { getDefaultSpePath };
```

## Task 6.5: Wire the module into main.js

**File:** `desktop/electron/main.js:7-9`

- [ ] **Step 1: Remove the inline function and import the module**

Delete the existing function:

```js
function getDefaultSpePath() {
    return path.resolve(app.getAppPath(), '..', 'resources', 'spe_defaults');
}
```

Add near the top of the file with other `require`s:

```js
const { getDefaultSpePath: resolveDefaultSpePath } = require('./spePath');
```

Add a thin wrapper to preserve the zero-arg call style used in `readSettings` / `writeSettings`:

```js
function getDefaultSpePath() {
    return resolveDefaultSpePath();
}
```

(Kept as a wrapper so the existing call sites don't need to change — a judgment call in the "DRY vs minimal-diff" tradeoff, favoring minimal diff here.)

## Task 6.6: Run the tests

- [ ] **Step 1: Run**

```bash
cd fiction-linter/desktop
npm test
```

Expected: all tests green, including the two new `spePath` cases.

## Task 6.7: Try packaging the app

- [ ] **Step 1: Run the dist script**

```bash
npm run dist
```

Expected output: electron-builder produces a `.dmg` in `desktop/release/`. First run may take several minutes as it downloads Electron binaries for arm64 + x64.

**Common failures and fixes:**

| Failure | Cause | Fix |
|---------|-------|-----|
| `Cannot find module '../resources/spe_defaults'` | `extraResources.from` path wrong | Path is relative to `desktop/`, so `../resources/...` is correct. Double-check spelling. |
| `Code signing requested but no identity found` | `identity: null` missing | Confirm the `mac.identity` field is present in build config. |
| Build succeeds but app crashes on launch | `files` glob missing `electron/` | Ensure `"electron/**/*"` is in the `files` array. |
| App opens but finds no SPE rules | `getDefaultSpePath` fix didn't ship | Check `release/mac-arm64/Fiction Linter.app/Contents/Resources/` — should contain `spe_defaults/` with yamls. |

- [ ] **Step 2: Open the packaged app**

Double-click the `.dmg` in `release/`, drag to Applications, open it. Right-click → Open on first launch (unsigned).

- [ ] **Step 3: Verify the packaged app works**

1. Open a folder with a test manuscript.
2. Confirm the default SPE rules load and findings appear — this proves the `extraResources` + `getDefaultSpePath` fix both work end-to-end.
3. Quit the packaged app.

## Task 6.8: Add `release/` to gitignore

**File:** `fiction-linter/.gitignore`

- [ ] **Step 1: Append to gitignore**

```
desktop/release/
desktop/node_modules/
desktop/dist/
```

(Check existing `.gitignore` first — `node_modules/` may already be there for the VS Code extension; add only what's missing.)

## Task 6.9: Commit Phase 6

- [ ] **Step 1: Stage and commit**

```bash
cd fiction-linter
git add desktop/package.json desktop/package-lock.json desktop/electron/spePath.js desktop/electron/main.js desktop/electron/main.spePath.test.js .gitignore
git commit -m "$(cat <<'EOF'
desktop: electron-builder packaging + spePath fix

Adds electron-builder dev dep, a mac-dmg build config, and the
npm run dist script. SPE defaults are bundled as extraResources
and land at process.resourcesPath/spe_defaults in the packaged
app.

Extracts getDefaultSpePath into its own testable module and
teaches it to return process.resourcesPath-relative paths when
app.isPackaged. The previous implementation walked up from
app.getAppPath(), which points inside app.asar for packaged
builds — a latent bug that only surfaced at packaging time.

Unsigned macOS build for now; signing requires an Apple Developer
identity and is tracked as future work.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Post-Plan Checklist

After Phase 6 ships:

- [ ] All commits pushed to the fiction-linter repo.
- [ ] A session note at `Sessions/YYYY-MM-DD.md` documenting the run, with **Verified** checkboxes for everything actually run (`npm test`, `npm run dev`, `npm run dist`, manual open of packaged app).
- [ ] The next-steps list in the session note should call out the deliberately-deferred work:
  - Streaming AI responses
  - Signed + notarized macOS build (requires Apple Developer Program)
  - Windows + Linux targets (one-line build config addition)
  - Chat-style AI with conversation history
  - Native Anthropic API client (alternative to OpenAI-compatible proxy)
  - File watching + external edit detection
  - TSX migration for `desktop/src/`
  - Theme to match `styles.css` variables
  - Keyboard shortcut for Open Folder / Save / Jump
- [ ] Update `desktop/CLAUDE.md` if any conventions shifted during execution (unlikely but possible).

---

# Notes for the Executor

- **TDD discipline matters most on phases 1, 2, 5, and 6.** Those are the phases with logic that can quietly regress. Phase 3 is largely an integration swap; Phase 4 is plumbing. Don't skimp on the tests for 1/2/5/6 even if the code looks obvious.
- **Don't skip the manual smoke checks.** Every phase has one at the end. They exist because `npm test` covers units, not the full Electron app behavior. Half the plan's risk lives in the gap between "tests pass" and "the app works when you click on it."
- **Commit per phase, not per task.** Each task's final step is "(continue to next task)" except the last task in a phase, which is the commit. This keeps the history bisectable at the phase level.
- **If a phase exceeds 90 minutes of real work, pause and re-scope.** Phases 3 and 5 are the most likely to blow past estimates (CodeMirror theming rabbit holes, AI prompt iteration).
