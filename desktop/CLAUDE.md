# CLAUDE.md — Fiction Linter Desktop

Project-scoped instructions for Claude Code when working under `fiction-linter/desktop/`.

## What this is

An Electron + React + Vite desktop shell for the Fiction Linter. It reuses the framework-agnostic linting core at `../src/shared/linting/` via the Vite alias `@shared` (see [vite.config.ts](vite.config.ts)). The VS Code extension in `../src/` is the sibling consumer of the same core — changes to the shared core should be evaluated against both consumers.

## Commands

| Task | Command |
|------|---------|
| Install | `cd fiction-linter/desktop && npm install` |
| Dev (Vite + Electron) | `npm run dev` |
| Build renderer | `npm run build` |
| Run packaged app | `npm start` |

Vite serves on `:5173`. Electron loads the dev URL when `VITE_DEV_SERVER_URL` is set, otherwise falls back to `dist/index.html`.

## Session notes convention

This project keeps per-session working notes in [Sessions/](Sessions/). The convention:

1. **File naming:** `Sessions/YYYY-MM-DD.md` (e.g. `Sessions/2026-04-11.md`). If more than one session happens on the same day, suffix with `-2`, `-3`, etc.
2. **Template:** Copy [Sessions/SESSION-TEMPLATE.md](Sessions/SESSION-TEMPLATE.md) — do not edit the template itself.
3. **When Claude writes one:** When the user says any of **"wrap up"**, **"end session"**, **"save session notes"**, or **"close out the session"**, Claude should:
   - Create `Sessions/YYYY-MM-DD.md` (today's date — check the `# currentDate` in the system context, don't guess)
   - Fill it in from the template based on **what actually happened** in the conversation — not a generic summary
   - Use real file paths as clickable markdown links
   - Keep the "Verified" section honest: only check boxes for things that were actually run, not things that looked right in a diff
   - Leave "Open questions / next steps" populated so the next session has a launch point
4. **When to update an existing file:** If a session file for today already exists and we're continuing that work, append to it rather than creating a new one — unless the user explicitly starts a new session.
5. **What NOT to put in session notes:**
   - Code that already exists in the repo (the diff is authoritative)
   - Generic summaries of "what the project is" (that's this file's job)
   - Praise or filler

## Architectural guardrails

- **Don't duplicate logic from `@shared/linting` in the desktop renderer.** If something needs to change in how findings are produced, change the core — both the VS Code extension and the desktop app benefit.
- **Renderer stays sandboxed.** File system access goes through `window.api` (see [electron/preload.js](electron/preload.js)). Do not turn on `nodeIntegration` or disable `contextIsolation`.
- **Settings live in Electron's `userData` dir**, not in the project tree. See `readSettings` / `writeSettings` in [electron/main.js](electron/main.js).
- **The desktop shell is JSX, not TSX** for now — but it consumes `.ts` from `@shared` via Vite's transparent TS handling. If we decide to convert to TSX, that's a deliberate migration, not a drive-by change.
