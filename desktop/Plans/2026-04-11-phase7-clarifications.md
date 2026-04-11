# Phase 7 UX Feedback — Clarifications Needed

> Fill in answers under each question. Short notes are fine — a word or a sentence is enough for most. For #3 you have an A/B/C choice; for the others I've pre-written the most likely defaults so you can skim past any you're OK with as-is.
>
> Once this is filled in, I'll produce `2026-04-11-phase7-plan.md` in the same structure as the last plan.

---

## 0. The unfinished item

Your original list cut off mid-sentence:

> 11. add an editor bar above the viewport.
> 12.

**What was #12?**

```
Your answer: n/a, just thinking and nothing entered.
```

---

## 1. Preview-mode editing (your item #3) — THE BIG ONE

> "markdown should be displayed and edited in **preview mode**."

This is the one architectural decision on the list. Pick **A**, **B**, or **C**:

### Option A — Split view
- Source (raw markdown) on the left, live-rendered preview on the right.
- You still edit raw text; the preview pane mirrors it as you type.
- **Cost:** ~1 day. CodeMirror stays exactly as is. `react-markdown` renders the preview.
- **Lint impact:** zero. Squiggles and click-to-jump still work in the source pane.

### Option B — Toggle source ↔ preview
- One pane. A button flips between raw CodeMirror editor and a rendered read-only preview.
- You edit in source mode, flip to preview to read.
- **Cost:** ~1 day. Similar to A but one pane with a mode switch.
- **Lint impact:** squiggles work in source mode; preview is read-only.

### Option C — Full WYSIWYG
- You never see raw markdown. You type `**` and it becomes bold visually, like a word processor.
- Uses Milkdown or TipTap (ProseMirror-based rich-text editors with markdown round-tripping).
- **Cost:** ~3-5 days plus non-trivial rework.
- **Lint impact:** **kills the Phase 3 lint bridge.** The shared core's `LintFinding { start, end }` uses plain-text character offsets. ProseMirror uses node+offset. Every finding needs re-mapping; "jump to issue" becomes "highlight this rendered span." Real cost, not a polish item.

**My read of your wording** ("displayed AND edited in preview mode" — you sound like you don't want to see the markdown syntax while typing) → probably **C**, but confirm.

```
Your choice (A / B / C): C, this will be a commercial release.

Notes / variations: See Arcwright for potential implementation.
```

---

## 2. Lint controls (your item #2)

> "Need to control start of linting. Lint display need to shut off if needed"

Two different things in one sentence — which do you want?

- **(a) Manual trigger:** Linting does NOT run automatically on content change. A "Lint now" button in the editor bar runs it on demand. Good for large files where 300ms debounce isn't enough.
- **(b) Display toggle:** Linting still runs automatically, but a toggle hides all the display (squiggles + Lint Report panel). Useful when you want to focus on writing without seeing findings but still have them computed.
- **(c) Both:** Master "Enable linting" toggle in settings (gates whether the core runs at all) + a "Lint now" button for manual trigger + a display toggle in the editor bar.

**My default if you don't specify:** (c) — covers the most cases with three independent controls.

```
Your choice (a / b / c or custom): I mean an enable button like the extension. Also, when writing the text popups can be distracting, so turning off the linter would keep the indicators live on the page, but no text unless the user turn it back on.
```

---

## 3. Line wrap vs. folding (your item #6)

> "lines displayed in the view port should be continuous, with a fold option, set to true by default, available"

Two plausible readings:

- **(X) Soft line wrap:** Long lines wrap at the viewport edge instead of scrolling horizontally. "Fold" = the wrap toggle. Default on.
- **(Y) Section folding:** Collapse markdown headers/sections (click a `##` header to hide everything under it until the next `##`). Default: everything expanded.
- **(Z) Both:** soft wrap by default (X), plus section folding available (Y) as a separate toggle.

**My read:** "continuous lines" strongly suggests (X) soft wrap — "continuous" meaning text flows across the viewport width instead of extending right. But "fold option" is odd wording for wrap-toggle. If you meant section folding, say so.

**My default if you don't specify:** (X) soft wrap on by default, toggle in editor bar.

```
Your choice (X / Y / Z): X, right now it looks like an extra line is added when a line is wrapped
```

---

## 4. Model picker data source (your item #8)

> "The model select in settings should be a list box, with thinking models in red, and the model price per million tokens in/out, right justified."

### 4a. Where does the model list come from?
- **(i) Hardcoded in `desktop/src/data/models.js`:** fast, no network at settings open, but needs manual updates as providers add models.
- **(ii) Live fetch from OpenRouter's `/models` endpoint:** always current; works only for OpenRouter users. Returns pricing, context length, modality. Other providers (raw OpenAI, Ollama, LM Studio, Anthropic) wouldn't see a fetched list.
- **(iii) Per-provider strategy:** OpenRouter → fetched; OpenAI → hardcoded small list; Ollama → fetch from local `/api/tags`; Anthropic → hardcoded list. Most flexible, most code.
- **(iv) User-pastes-a-list:** a text area in advanced settings where they paste their own JSON. Escape hatch, not a primary UX.

**My default:** (ii) if the user's provider is `openrouter` (based on the settings.ai.provider field), otherwise fall back to a small hardcoded list with a "refresh" button that tries the provider's models endpoint if available.

```
Your choice (i / ii / iii / iv / custom):iii roughly. all lists loaded from provider when key is provided.
```

### 4b. What counts as a "thinking model" (shown in red)?
- **(α) Narrow:** only models with explicit thinking capability like `claude-sonnet-4-5:thinking`, `claude-opus-4:thinking` (the `:thinking` suffix on OpenRouter).
- **(β) Broader reasoning category:** the narrow set plus `o1`, `o1-mini`, `o3`, `o3-mini`, `deepseek-r1`, `qwen-*-reasoning`, etc. Based on a hardcoded allowlist of reasoning-model IDs.
- **(γ) By pricing heuristic:** any model above a price threshold (e.g. >$3/1M output tokens). Imprecise.

**My default:** (β) — maintain a curated list of known reasoning model IDs in `data/thinkingModels.js` and match against it.

```
Your choice (α / β / γ): The models that have thinking as an adjutable hyperparameter, or those that have tools as an option
```

### 4c. Column layout
For clarity, the listbox rows would look like:

```
claude-sonnet-4-5                            $3.00 / $15.00
claude-sonnet-4-5:thinking                   $3.00 / $15.00    ← red
openai/gpt-4.1-mini                          $0.15 / $0.60
openai/o1-mini                               $1.10 / $4.40     ← red
deepseek/deepseek-r1                         $0.55 / $2.19     ← red
```

Right-aligned prices, left-aligned model IDs, thinking rows in red text. Good?

```
Confirm layout (yes / changes): Yes, we should add the ability to adjust hyperparameters for the selected model
```

---

## 5. File tabs (your item #9)

> "selected files should be tabbed above the viewport with just the file name showing"

### 5a. Persistence
- **(p) Ephemeral:** tabs clear on app restart. Simpler. Matches common text editors' "recent files" model.
- **(q) Persistent:** open tabs reopen on next launch (like VS Code). Requires writing tab state to `userData/tabs.json` on every change.

**My default:** (q) persistent — this is a fiction manuscript tool, you'll be closing and reopening the app with the same project repeatedly.

```
Your choice (p / q):q
```

### 5b. Close behavior
- Click small × on the tab itself
- Middle-click the tab
- Keyboard shortcut (cmd+w)
- All of the above

**My default:** × + middle-click. Cmd+W adds later if you want.

```
Your choice:Click small × on the tab itself. This is standard
```

### 5c. What happens when you click a file in the tree with tabs already open?
- **(r) Always opens a new tab** (and switches to it)
- **(s) Re-uses the current tab if the file isn't already open, opens a new tab only if switching**
- **(t) VS Code behavior: single-click opens a "preview tab" (italicized, reused on next single-click); double-click pins it as a real tab**

**My default:** (r) — simplest. Tabs only grow when you open new files. If the same file is already open, switch to that tab instead of duplicating.

```
Your choice (r / s / t):r
```

---

## 6. Editor bar contents (your item #11)

> "add an editor bar above the viewport"

My proposed toolbar, left-to-right:

| Control | Behavior |
|---|---|
| **Save** | Save current file. Disabled when not dirty. (Already exists in EditorPanel — moves into the bar.) |
| **Undo** / **Redo** | Undo/redo editor state. CodeMirror has built-in history; just wire to UI buttons. |
| **Wrap** toggle | Turn soft wrap on/off (from your #6). |
| **Source ↔ Preview** toggle | Depends on your answer to #3. If you pick A (split view), no toggle needed. If B or C, this toggle exists. |
| **Lint** toggle | Show/hide lint display (from your #2). |
| **Lint now** | Manual lint trigger (from your #2, if you chose manual or both). |

Anything missing?

```
Additional controls you want: This will also function as an editor, so we need <New>, Some of these should go to the File menu. We need to manage font styles, not huge: paragraph; heading 1,2,3; bold, italic, underline; scene break. in general the standard bar, no text color needed.  see arcwright.

Things to remove:
```

---

## 7. Word/Google Docs conversion (your item #4)

> "word and gdoc files should be converted to markdown, and then displayed in the viewport."

### 7a. Scope for Phase 7

- **`.docx` (Word):** yes, clean path via [mammoth.js](https://github.com/mwilliamson/mammoth.js). Runs in the renderer (or main process) without native deps. Converts `.docx` → HTML, then I'd add a turndown pass to get HTML → markdown.
- **`.doc` (old Word):** no clean JS-only path. Would need a native binary (libreoffice, textutil, etc.) or skip.
- **`.rtf`:** maybe via a small RTF-to-markdown converter, but the ecosystem is thin.
- **`.gdoc`:** the tricky one. `.gdoc` files on disk are just JSON pointers to cloud documents. Actual conversion requires the Google Drive API with OAuth — adds a whole authentication flow, scopes, token storage, etc. Real work.

**My default:** Phase 7 scope = `.docx` only. Defer `.doc`, `.rtf`, `.gdoc` as future work. Non-`.md` files show a banner "Import as markdown?" button instead of displaying raw contents.

```
Your choice (confirm or expand scope): Maybe we just make markdown our native format. I have copied gdoc directly into md. The user will be working in the preview editor anyway.
```

### 7b. Round-trip behavior

When you open a `.docx`, edit it in the editor, and save:

- **(k) Save as sibling `.md` file** (leaves the original `.docx` untouched). Safe and non-destructive. Creates `manuscript.md` next to `manuscript.docx`.
- **(l) Save back as `.docx`** (round-trip through turndown + back to docx). Risky — lossy conversions can mangle formatting.
- **(m) Prompt the user on save** — "Save as .md (recommended) or .docx?"

**My default:** (k). The docx is source material; the fiction-linter workflow output is markdown.

```
Your choice (k / l / m): k
```

---

## 8. Line spacing target (your item #7)

> "the line spacing in all the panels and dialog boxes is too high"

I'll do a global audit of `styles.css` and pull `line-height` values down. My default target:

- Body/panel text: `1.25` (from whatever it is now — probably `1.5` or `1.6`)
- Tree rows: `1.2`
- Issue cards: `1.3`
- Modal labels: `1.2`
- Editor (CodeMirror theme): `1.5` → `1.4` (the plan's current theme sets `1.6`)

Tighter on chrome, still readable for prose in the editor.

```
Target too tight / too loose / about right: in the editor, lines should wrap at 1.2, with blank lines between paragraphs.
```

---

## 9. Things I'm NOT asking about — quick confirmations

These I'll just interpret and do unless you object:

- **#1 file tree overflow:** CSS fix — `overflow-y: auto` + `min-height: 0` on `.left-panel` and `.tree-root`. OK? ☐
- **#5 "Open Folder" next to "Files":** move the button from the top-bar into the left-panel header row. OK? ☐
- **#10 clear all tabs:** right-aligned "× Clear all" button on the tab bar. OK? ☐

```
Objections or changes:good
```

---

## 10. Proposed execution order

Once I have your answers, the Phase 7 plan will batch these into review-able sub-phases:

1. **Quick-wins (CSS/layout):** #1, #5, #7, #10 (partial — clear-all button shell)
2. **Editor bar + simple toggles:** #11, #2 display toggle, #6 wrap toggle
3. **Lint control expansion:** #2 "Lint now" button, #2 master enable toggle
4. **File tabs:** #9 (full — with state management + #10 clear-all wired up)
5. **Model picker:** #8
6. **Docx import:** #4
7. **Preview mode:** #3 (LAST — so earlier work is stable before we potentially re-architect the editor)

Object to the ordering here if anything should move:

```
Ordering changes: no issues
```

---

## Fill and return

When you've filled this in, save the file or just tell me "done". I'll read your annotations and turn them into a proper Phase 7 plan in `Plans/2026-04-11-phase7-plan.md` with the same structure as the last one (phased, TDD-ordered, complete code blocks, reviewable per-phase).
