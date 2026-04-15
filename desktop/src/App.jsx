import React, { useEffect, useMemo, useRef } from 'react';
import { PatternLinterCore, NameValidatorCore } from '@shared/linting';
import { scanDocument, findNextIssue } from './lib/aiScanner';
import FileTree from './components/FileTree';
import Editor from './components/editor/Editor';
import { htmlToMarkdown } from './components/editor/converters';
import SettingsDialog from './components/SettingsDialog';
import PanelResizer from './components/PanelResizer';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import ThemePicker from './components/ThemePicker';
import { getFileKind } from './lib/fileEligibility';
import { useAppStore } from './store/useAppStore';
import { useEditorStore } from './store/useEditorStore';
import { useLintStore } from './store/useLintStore';

function App() {
    const settings = useAppStore(state => state.settings);
    const speData = useAppStore(state => state.speData);
    const status = useAppStore(state => state.status);
    const rootPath = useAppStore(state => state.rootPath);
    const tree = useAppStore(state => state.tree);
    const setSettings = useAppStore(state => state.setSettings);
    const setSpeData = useAppStore(state => state.setSpeData);
    const setStatus = useAppStore(state => state.setStatus);
    const setRootPath = useAppStore(state => state.setRootPath);
    const setTree = useAppStore(state => state.setTree);
    const updateNode = useAppStore(state => state.updateNode);
    const showLineNumbers = useAppStore(state => state.showLineNumbers);
    const setShowLineNumbers = useAppStore(state => state.setShowLineNumbers);

    const tabs = useEditorStore(state => state.tabs);
    const activeTabId = useEditorStore(state => state.activeTabId);
    const openFile = useEditorStore(state => state.openFile);
    const updateContent = useEditorStore(state => state.updateContent);
    const markSaved = useEditorStore(state => state.markSaved);
    const closeTab = useEditorStore(state => state.closeTab);
    const closeAllTabs = useEditorStore(state => state.closeAllTabs);
    const setActiveTab = useEditorStore(state => state.setActiveTab);
    const hydrate = useEditorStore(state => state.hydrate);

    const lintEnabled = useLintStore(state => state.enabled);
    const showFindings = useLintStore(state => state.showFindings);
    const issues = useLintStore(state => state.issues);
    const aiIssues = useLintStore(state => state.aiIssues);
    const scanProgress = useLintStore(state => state.scanProgress);
    const setIssues = useLintStore(state => state.setIssues);
    const setAiIssues = useLintStore(state => state.setAiIssues);
    const clearAiIssues = useLintStore(state => state.clearAiIssues);
    const setScanProgress = useLintStore(state => state.setScanProgress);
    const setLintEnabled = useLintStore(state => state.setEnabled);
    const setShowFindings = useLintStore(state => state.setShowFindings);

    const [editorState, setEditorState] = React.useState({
        line: 1,
        column: 1,
        selection: null
    });

    const [showSettings, setShowSettings] = React.useState(false);
    const [wrap, setWrap] = React.useState(true);
    const [leftPanelWidth, setLeftPanelWidth] = React.useState(() => {
        if (typeof window === 'undefined') return 260;
        try {
            const stored = window.localStorage.getItem('fl.leftPanelWidth');
            return stored ? Math.max(160, parseInt(stored, 10)) : 260;
        } catch {
            // Locked-down environments (private mode, storage disabled, etc.)
            // — fall back to the default width.
            return 260;
        }
    });

    const handleResize = (newWidth) => {
        setLeftPanelWidth(newWidth);
        try {
            window.localStorage.setItem('fl.leftPanelWidth', String(newWidth));
        } catch { /* quota, private mode, etc. — non-fatal */ }
    };

    const editorRef = useRef(null);

    const patternCore = useMemo(() => new PatternLinterCore(), []);
    const nameCore = useMemo(() => new NameValidatorCore(), []);

    // Derived from the active tab — the Phase 0-6 "currentFile/content/dirty"
    // trio now lives inside useEditorStore's tabs[].
    const activeTab = tabs.find(t => t.id === activeTabId) ?? null;
    const content = activeTab?.markdownSource ?? '';
    const currentFile = activeTab
        ? { name: activeTab.name, path: activeTab.path }
        : null;
    const dirty = activeTab?.dirty ?? false;

    useEffect(() => {
        window.api.getSettings().then(setSettings);
    }, [setSettings]);

    useEffect(() => {
        hydrate();
    }, [hydrate]);

    // Paint the persisted theme onto <html data-theme> as soon as React
    // mounts. The store constructor already reads localStorage synchronously
    // during module init; this just pushes that value to the DOM attribute
    // so CSS theme selectors activate.
    useEffect(() => {
        useAppStore.getState().hydrateTheme();
    }, []);

    // Restore the last-opened folder on startup. Reads from TWO sources in
    // order: localStorage (fast, same-origin) and the main-process
    // settings.json (durable, survives storage resets). Either is enough;
    // both exist for belt-and-suspenders reliability.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        let cancelled = false;
        (async () => {
            let stored = null;
            try {
                stored = window.localStorage.getItem('fl.rootPath');
            } catch { /* private mode — fall through to settings.json */ }
            if (!stored) {
                // localStorage empty or unavailable — ask the main process.
                try {
                    const s = await window.api.getSettings();
                    stored = s?.lastRootPath || null;
                } catch { /* IPC failed — give up, just show empty tree */ }
            }
            if (!stored || cancelled) return;
            const entries = await window.api.listDirectory(stored);
            if (cancelled) return;
            // listDirectory returns [] for both "empty directory" and
            // "missing directory" — treat either as success; the user can
            // click Open to pick a new folder if the previous one is gone.
            setRootPath(stored);
            setTree(buildNodes(entries));
        })();
        return () => { cancelled = true; };
        // Intentionally empty deps — runs once on mount. setRootPath/setTree
        // from zustand are stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Phase 7.5 review follow-up: flush the persist debounce on window close so
    // dirty untitled tabs do not lose their last 0-400ms of content if the user
    // quits during the debounce window.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = () => {
            useEditorStore.getState().flushPersist?.();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, []);

    useEffect(() => {
        if (!window.api?.onMenuAction) return;
        const unsubscribe = window.api.onMenuAction((payload) => {
            const action = payload?.action;
            switch (action) {
                case 'new-file':
                    useEditorStore.getState().newEmptyTab();
                    break;
                case 'open-folder':
                    handleChooseFolder();
                    break;
                case 'save':
                    handleSave();
                    break;
                case 'save-as':
                    setStatus('Save As not yet implemented.');
                    break;
                case 'close-tab':
                    if (activeTabId) closeTab(activeTabId);
                    break;
                case 'open-settings':
                    setShowSettings(true);
                    break;
                case 'toggle-lint':
                    setLintEnabled(!lintEnabled);
                    break;
                case 'toggle-findings':
                    setShowFindings(!showFindings);
                    break;
                case 'find':
                    setStatus('Find not yet implemented.');
                    break;
                case 'open-help':
                    window.open('https://github.com/wmiles81/fiction-linter', '_blank');
                    break;
                default:
                    break;
            }
        });
        return unsubscribe;
    }, [activeTabId, lintEnabled, showFindings]);

    useEffect(() => {
        if (!settings?.spePath) return;
        window.api.loadSpeData(settings.spePath).then((data) => {
            setSpeData(data);
            // Surface silent "zero rules loaded" failures. Without this,
            // a missing / mistyped / emptied SPE path would just leave the
            // user with 0 findings and no explanation — they'd assume the
            // linter is broken rather than "the rules directory is empty".
            // Only nags once (via setStatus), doesn't spam.
            const ruleCount =
                Object.keys(data?.cliches || {}).length +
                Object.keys(data?.names || {}).length +
                Object.keys(data?.places || {}).length +
                Object.keys(data?.protocols || {}).length;
            if (ruleCount === 0) {
                setStatus(
                    `No SPE rules loaded from ${settings.spePath} — ` +
                    `Settings → SPE Rules Path, or click Re-lint after fixing.`
                );
            }
        });
    }, [settings?.spePath, setSpeData, setStatus]);

    useEffect(() => {
        if (!lintEnabled || !content || !settings) {
            setIssues([]);
            return;
        }

        const handle = setTimeout(() => {
            // Lint against the editor's PLAIN TEXT representation (the same
            // string lintOverlay uses for offset mapping), NOT the markdown
            // source. Markdown syntax markers (**, #, etc.) shift offsets
            // relative to the rendered text — feeding markdown offsets into
            // the DOM-based highlight overlay produces wrong-position
            // highlights and crashes the Range API on out-of-bounds offsets.
            //
            // Falls back to `content` (the markdown) if the editor is not
            // mounted yet — only matters on the very first lint cycle.
            const lintInput = editorRef.current?.getPlainText?.() || content;

            const findings = [
                ...patternCore.lintText(lintInput, speData),
                ...nameCore.lintText(lintInput, speData)
            ];

            const mapped = findings.map(finding => {
                const loc = indexToLineCol(lintInput, finding.start);
                return {
                    ...finding,
                    line: loc.line,
                    column: loc.column
                };
            });

            setIssues(mapped);
        }, 300);

        return () => clearTimeout(handle);
    }, [lintEnabled, content, speData, patternCore, nameCore, settings, setIssues]);

    // Drop stale AI findings whenever content changes. An AI finding is
    // stale when the text at its offsets no longer matches the substring
    // the AI flagged — pattern findings regenerate on each lint, but AI
    // findings persist until the next scan. Without this cleanup the
    // overlay keeps showing squiggles on shifted offsets, and Fix Now
    // can corrupt the document ("LiLike" bug — finding said "Like" but
    // after edits the offsets now point to "ke", and replacement leaves
    // the unreplaced "Li" prefix behind).
    //
    // 150ms debounce matches the same intuition as the pattern lint: we
    // want a quiet moment after typing before rebuilding overlays.
    useEffect(() => {
        if (aiIssues.length === 0) return;
        const handle = setTimeout(() => {
            const plain = editorRef.current?.getPlainText?.() || content;
            const fresh = aiIssues.filter(i => {
                if (!i.text) return true; // legacy finding without expected text — trust it
                return plain.slice(i.start, i.end) === i.text;
            });
            if (fresh.length !== aiIssues.length) {
                setAiIssues(fresh);
            }
        }, 150);
        return () => clearTimeout(handle);
    }, [content, aiIssues, setAiIssues]);

    // Shared between "user clicked Open" and "app restarted with persisted
    // rootPath." Lists the directory, updates store, and persists to BOTH
    // localStorage AND the main-process settings.json so the next launch
    // auto-restores. Belt-and-suspenders: localStorage can be wiped by
    // devtools or storage-partition changes; settings.json is durable.
    const loadFolder = async (folderPath) => {
        if (!folderPath) return;
        const entries = await window.api.listDirectory(folderPath);
        // listDirectory returns [] both when the dir is empty and when it
        // doesn't exist. Peek at existence via a parent-dir listing would be
        // overkill — an empty list just shows "empty tree" which is correct.
        setRootPath(folderPath);
        setTree(buildNodes(entries));
        try {
            window.localStorage.setItem('fl.rootPath', folderPath);
        } catch { /* private mode, quota — non-fatal */ }
        window.api.setLastRootPath?.(folderPath);
    };

    const handleChooseFolder = async () => {
        const selected = await window.api.chooseFolder();
        if (!selected) return;
        await loadFolder(selected);
    };

    const handleToggleNode = async nodePath => {
        const target = findNode(tree, nodePath);
        if (!target || !target.isDirectory) return;

        if (target.children) {
            updateNode(nodePath, node => ({ ...node, expanded: !node.expanded }));
            return;
        }

        const entries = await window.api.listDirectory(target.path);
        updateNode(nodePath, node => ({
            ...node,
            expanded: true,
            children: buildNodes(entries)
        }));
    };

    const handleSelectFile = async node => {
        if (node.isDirectory) return;

        // Dispatch on the file's kind so .docx and .gdoc take their own paths
        // instead of being treated as plain text. getFileKind also acts as a
        // belt-and-suspenders eligibility check — the FileTree should already
        // have prevented clicks on truly ineligible files.
        const kind = getFileKind(node.name);

        if (kind === 'text') {
            const result = await window.api.readFile(node.path);
            if (!result.ok) {
                setStatus(result.error || 'Unable to read file.');
                return;
            }
            openFile({
                path: node.path,
                name: node.name,
                markdownSource: result.contents
            });
            setStatus('Loaded file.');
            return;
        }

        if (kind === 'docx') {
            // Read the .docx via main process (mammoth → HTML), then convert
            // HTML to markdown via the same unified pipeline the editor uses
            // for paste handling. Open as a tab whose path is the SIBLING .md
            // path so Save writes to a new .md file rather than corrupting
            // the original .docx.
            setStatus(`Importing ${node.name}…`);
            const result = await window.api.readDocx(node.path);
            if (!result.ok) {
                setStatus(result.error || 'Unable to import .docx.');
                return;
            }
            try {
                const markdown = await htmlToMarkdown(result.html || '');
                // Replace the trailing extension (case-insensitive) with .md
                const mdPath = node.path.replace(/\.docx$/i, '.md');
                const mdName = node.name.replace(/\.docx$/i, '.md');
                openFile({
                    path: mdPath,
                    name: mdName,
                    markdownSource: markdown
                });
                const warningCount = (result.messages || []).filter(m => m.type === 'warning').length;
                setStatus(
                    warningCount > 0
                        ? `Imported ${node.name} as ${mdName} (${warningCount} conversion warnings; Save writes to .md sibling)`
                        : `Imported ${node.name} as ${mdName} (Save writes to .md sibling)`
                );
            } catch (err) {
                setStatus(`Conversion failed: ${err.message}`);
            }
            return;
        }

        if (kind === 'gdoc') {
            // .gdoc files are JSON pointers to cloud documents. Main fetches
            // the actual content via Electron net.request with a persistent
            // session partition (persist:google-auth). Three possible
            // outcomes:
            //   - kind: 'imported'       → cookies in the session were valid
            //                              (or the doc is public). HTML
            //                              export returned successfully.
            //                              Convert to markdown and open as
            //                              a tab.
            //   - kind: 'auth-required'  → no cookies (or expired). Prompt
            //                              the user to sign in via the
            //                              gdoc:auth IPC, which opens an
            //                              interactive sign-in window
            //                              sharing the same session
            //                              partition. After successful
            //                              sign-in, retry the fetch once.
            //   - !ok                    → real error (file missing, parse
            //                              failure, network failure). Show
            //                              the error in the status bar.

            const importGdocResult = async (result) => {
                try {
                    const markdown = await htmlToMarkdown(result.html || '');
                    // The .gdoc filename is sometimes "Untitled.gdoc" because
                    // Drive sync writes a placeholder. Use the basename
                    // returned from main (the .gdoc filename minus extension)
                    // and append .md so Save targets a sibling .md file
                    // rather than corrupting the pointer.
                    const baseName = result.baseName || node.name.replace(/\.gdoc$/i, '');
                    const dir = node.path.replace(/\/[^/]+$/, '');
                    const mdName = `${baseName}.md`;
                    const mdPath = `${dir}/${mdName}`;
                    openFile({
                        path: mdPath,
                        name: mdName,
                        markdownSource: markdown
                    });
                    setStatus(`Imported ${node.name} as ${mdName} (Save writes to .md sibling)`);
                } catch (err) {
                    setStatus(`Conversion failed: ${err.message}`);
                }
            };

            setStatus(`Opening ${node.name}…`);
            let result = await window.api.readGdoc(node.path);
            if (!result.ok) {
                setStatus(result.error || 'Unable to open .gdoc pointer.');
                return;
            }

            if (result.kind === 'imported') {
                await importGdocResult(result);
                return;
            }

            if (result.kind === 'auth-required') {
                // Try to sign in interactively. The gdoc:auth handler opens
                // a Google sign-in window using the same session partition
                // as the fetch — so cookies set during sign-in will be used
                // by the retry below. No OAuth client_id required.
                setStatus(`${node.name} requires Google sign-in. Opening sign-in window…`);
                const authResult = await window.api.gdocAuth();
                if (!authResult.ok) {
                    setStatus(`Sign-in cancelled: ${authResult.error || 'unknown error'}. ${node.name} not opened.`);
                    return;
                }
                // Retry once after successful sign-in.
                setStatus(`Signed in. Retrying ${node.name}…`);
                result = await window.api.readGdoc(node.path);
                if (!result.ok) {
                    setStatus(result.error || `Unable to open ${node.name} after sign-in.`);
                    return;
                }
                if (result.kind === 'imported') {
                    await importGdocResult(result);
                    return;
                }
                if (result.kind === 'auth-required') {
                    // Sign-in completed but the doc is STILL inaccessible —
                    // probably a permissions issue (different account, no
                    // access to that doc). Don't loop; surface the situation.
                    setStatus(
                        `${node.name} is not accessible to this Google account. ` +
                        `Check sharing permissions or sign in with a different account (Settings → Sign out of Google).`
                    );
                    return;
                }
            }

            // Unknown kind — should never happen, defensive.
            setStatus(`Unexpected gdoc result for ${node.name}.`);
            return;
        }

        // Fallthrough: should never happen because the FileTree disables
        // ineligible files, but defensive against future regressions.
        setStatus(`Cannot open ${node.name}: unsupported file type.`);
    };

    // "Next finding" jumps to the most severe finding after the cursor,
    // wrapping to the top of the document when the cursor is past the last
    // one. Uses the editor's current cursor offset (or 0 if nothing is
    // selected) so the navigation follows wherever the writer last clicked.
    // Manually force a fresh deterministic (regex) lint pass. Reloads SPE
    // rules from disk first — so if the user updated their SPE-Config
    // files in another editor, or the initial load failed silently
    // (spePath missing at startup, race with settings hydration), this
    // recovers without needing a full app restart. Reports rule + finding
    // counts to the status bar so the user sees the result.
    const handleRelint = async () => {
        if (!lintEnabled) {
            setStatus('Lint is disabled — turn Lint on, then Re-lint.');
            return;
        }
        if (!settings?.spePath) {
            setStatus('No SPE path set — open Settings → SPE Rules Path to configure one.');
            return;
        }
        setStatus('Reloading SPE rules…');
        try {
            const data = await window.api.loadSpeData(settings.spePath);
            const ruleCount =
                Object.keys(data?.cliches || {}).length +
                Object.keys(data?.names || {}).length +
                Object.keys(data?.places || {}).length +
                Object.keys(data?.protocols || {}).length;
            // Assigning a NEW object reference triggers the lint useEffect,
            // which re-runs pattern + name linting against the current
            // plain text and calls setIssues with the fresh results.
            setSpeData(data || { cliches: {}, names: {}, places: {}, protocols: {} });
            if (ruleCount === 0) {
                setStatus(
                    `Re-lint: 0 rules loaded from ${settings.spePath}. ` +
                    `Check that the folder contains cliche_collider.yaml and friends.`
                );
            } else {
                // Lint findings arrive ~300ms later (debounce). The status
                // will be overwritten by the regular lint-count display
                // when the next event touches it, so include the rule
                // count here as the durable confirmation.
                setStatus(`Re-lint: reloaded ${ruleCount} rules. Findings will refresh shortly.`);
            }
        } catch (err) {
            setStatus(`Re-lint failed: ${err.message || 'unknown error'}`);
        }
    };

    const handleJumpNextFinding = () => {
        if (!editorRef.current || visibleIssues.length === 0) return;
        const cursor = editorRef.current.getCursorOffset?.() ?? -1;
        const next = findNextIssue(visibleIssues, cursor);
        if (!next) return;
        editorRef.current.jumpTo(next);
    };

    // Build an annotation entry payload from a lint finding. Used by both
    // Fix-later (note = finding message) and Fix-now (note = rewrite result).
    const buildFindingEntry = (finding, noteOverride) => {
        const plain = editorRef.current?.getPlainText?.() || content;
        const original = plain.slice(finding.start, finding.end);
        return {
            line: finding.line || 1,
            category: finding.category || 'unknown',
            severity: finding.severity || 'info',
            original,
            note: noteOverride || finding.message || '',
            source: finding.source || 'pattern'
        };
    };

    // Fix later: log the original text + the finding message to the sibling
    // annotation file and leave the editor untouched. The user can later
    // feed the pair (source + annotation) to another AI for rewrites.
    const handleFixLater = async (finding) => {
        if (!activeTab?.path) {
            setStatus('Save the document first — annotations need a sibling file path.');
            return;
        }
        const entry = buildFindingEntry(finding);
        const result = await window.api.appendAnnotation(activeTab.path, entry);
        if (result?.ok) {
            setStatus(`Logged to annotation file: ${result.annotationPath}`);
        } else {
            setStatus(`Annotation failed: ${result?.error || 'unknown error'}`);
        }
    };

    // Fix now: call AI rewrite, extract the first suggestion, replace the
    // flagged range in the editor, and ALSO log the before/after pair to
    // the annotation file so there's a durable record of what changed.
    const handleFixNow = async (finding) => {
        if (!activeTab?.path) {
            setStatus('Save the document first — Fix now needs a sibling annotation file path.');
            return;
        }
        const plain = editorRef.current?.getPlainText?.() || content;
        const original = plain.slice(finding.start, finding.end);

        // Staleness guard: if the finding carries its expected flagged text
        // and the text at those offsets no longer matches, the document has
        // been edited since the scan and the offsets are wrong. Applying
        // the replacement would corrupt the document ("LiLike" bug). Refuse
        // the fix with a clear message.
        if (finding.text && original !== finding.text) {
            setStatus(
                `Finding is stale — the document has changed since the scan. ` +
                `Expected "${finding.text}" but offsets now point to "${original}". ` +
                `Re-run the AI scan to refresh findings.`
            );
            return;
        }
        // Use the surrounding sentence as snippet context (50 chars either
        // side is a cheap approximation; the AI prompt just needs context).
        const snippetStart = Math.max(0, finding.start - 80);
        const snippetEnd = Math.min(plain.length, finding.end + 80);
        const snippet = plain.slice(snippetStart, snippetEnd);

        setStatus('Fix now — asking AI for a rewrite…');
        const result = await window.api.aiComplete({
            kind: 'rewrite',
            finding: { message: finding.message, severity: finding.severity },
            snippet,
            flagged: original
        });
        if (!result?.ok) {
            setStatus(`Fix now failed: ${result?.error || 'unknown error'}`);
            return;
        }
        const firstAlt = extractFirstRewrite(result.content);
        if (!firstAlt) {
            setStatus('Fix now: AI returned no usable rewrite; logged for later.');
            await window.api.appendAnnotation(activeTab.path, buildFindingEntry(finding,
                `AI returned no parseable rewrite. Raw response:\n\n${result.content}`));
            return;
        }
        // Apply the replacement: drop-in substitute the flagged phrase
        // with the AI's first alternative. The rewrite prompt now asks for
        // phrase-level alternatives, so this is just the replacement text.
        const before = plain.slice(0, finding.start);
        const after = plain.slice(finding.end);
        const newMarkdown = before + firstAlt + after;
        updateContent(newMarkdown);

        // Clear the fixed finding from the overlay so the user has visible
        // confirmation that work was done — otherwise the squiggle stays
        // on stale offsets and looks like nothing happened. AI findings
        // after the replacement point need their offsets shifted by the
        // length delta so they still highlight the right text.
        const delta = firstAlt.length - original.length;
        const nextAiIssues = aiIssues
            .filter(i => !(i.start === finding.start && i.end === finding.end && i.source === finding.source))
            .map(i => (i.start > finding.start)
                ? { ...i, start: i.start + delta, end: i.end + delta }
                : i);
        setAiIssues(nextAiIssues);
        // Pattern findings regenerate automatically on the next 300ms lint
        // pass triggered by updateContent, so no explicit cleanup there.

        await window.api.appendAnnotation(activeTab.path, buildFindingEntry(finding,
            `Replaced "${original}" with "${firstAlt}" via Fix now.`));
        setStatus(`Fix applied and logged. ${activeTab.path}.annotation.md`);
    };

    const handleSave = async () => {
        if (!activeTab?.path) return;
        const result = await window.api.writeFile(activeTab.path, activeTab.markdownSource);
        if (result.ok) {
            markSaved();
            setStatus('Saved.');
        } else {
            setStatus(result.error || 'Save failed.');
        }
    };

    // Ref to the AbortController of a running scan. Using a ref, not state,
    // because aborting should not trigger a re-render — the scan's own
    // progress callbacks already push state updates.
    const scanAbortRef = useRef(null);

    const handleToggleAiScan = async () => {
        // Running → cancel.
        if (scanAbortRef.current) {
            scanAbortRef.current.abort();
            scanAbortRef.current = null;
            setScanProgress(null);
            setStatus('AI scan cancelled.');
            return;
        }
        // Idle → start.
        if (!settings?.ai?.apiKey) {
            setStatus('AI scan needs an API key — open Settings to configure one.');
            return;
        }
        const plainFromEditor = editorRef.current?.getPlainText?.();
        const text = plainFromEditor || content;
        // eslint-disable-next-line no-console
        console.log('[ai-scan] starting', {
            textLength: text?.length || 0,
            usingEditorPlainText: !!plainFromEditor,
            firstLine: text?.split('\n')?.[0]?.slice(0, 80)
        });
        if (!text || !text.trim()) {
            setStatus('Nothing to scan — the document appears to be empty.');
            return;
        }
        const controller = new AbortController();
        scanAbortRef.current = controller;
        clearAiIssues();
        setScanProgress({ current: 0, total: 0 });
        setStatus('AI scan started…');
        try {
            const result = await scanDocument({
                text,
                signal: controller.signal,
                callAi: async (paragraph) => {
                    const r = await window.api.aiScan(paragraph);
                    // eslint-disable-next-line no-console
                    console.log('[ai-scan] chunk result', {
                        chunkLen: paragraph.length,
                        ok: r?.ok,
                        contentLen: r?.content?.length || 0,
                        error: r?.error,
                        sample: r?.content?.slice(0, 120)
                    });
                    return r;
                },
                onProgress: ({ current, total, issues: partial }) => {
                    setScanProgress({ current, total });
                    setAiIssues(partial);
                },
                onBackoff: ({ chunkIndex, totalChunks, attempt, waitMs, maxRetries }) => {
                    // Surface in status so the user knows we're not hung.
                    // (We keep scanProgress at the current position so the
                    // button still shows the percent complete.)
                    setStatus(
                        `Rate limited on chunk ${chunkIndex + 1}/${totalChunks}. ` +
                        `Retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxRetries})…`
                    );
                }
            });
            // eslint-disable-next-line no-console
            console.log('[ai-scan] complete', result);

            if (result.ok) {
                // Build an honest completion status. Always include the chunk
                // count so the user can tell "0 chunks" (text empty / unsplit)
                // from "N chunks succeeded with 0 findings each" (model just
                // didn't flag anything) from "N chunks failed" (rate-limited
                // or auth issue). When retries kicked in, mention them —
                // that's valuable signal ("I was getting rate-limited but we
                // recovered").
                const parts = [`AI scan: ${result.issues.length} finding${result.issues.length === 1 ? '' : 's'} across ${result.chunkCount} chunk${result.chunkCount === 1 ? '' : 's'}`];
                if (result.failedChunks > 0) {
                    parts.push(
                        `— ${result.failedChunks} failed (${result.lastError || 'unknown error'})`
                    );
                } else if (result.chunkCount === 0) {
                    parts.push('— no scannable text found');
                } else if (result.issues.length === 0 && result.lastSampleResponse) {
                    parts.push(`— sample response: "${result.lastSampleResponse.slice(0, 60).replace(/\n/g, ' ')}…"`);
                }
                if (result.totalRetries > 0) {
                    parts.push(`(${result.totalRetries} retr${result.totalRetries === 1 ? 'y' : 'ies'} after rate-limit backoff)`);
                }
                setStatus(parts.join(' '));
            } else if (result.error === 'Scan cancelled') {
                // Already status-set by the cancel branch; no-op.
            } else {
                setStatus(`AI scan failed: ${result.error || 'unknown error'}`);
            }
        } finally {
            scanAbortRef.current = null;
            setScanProgress(null);
        }
    };

    const handleSettingsSave = async nextSettings => {
        const updated = await window.api.saveSettings(nextSettings);
        setSettings(updated);
        setShowSettings(false);
    };

    // Note: handleJumpToIssue and getSnippet were removed when the IssueList
    // sidebar was retired in favor of inline hover tooltips on the editor.
    // If AI Explain/Suggest rewrite features come back (e.g., via a pinned
    // tooltip with action buttons), restore both helpers — getSnippet should
    // use editorRef.current.getPlainText() for the source text since findings
    // are in plain-text coordinates, not markdown coordinates.

    // Merge deterministic pattern findings with AI scan findings. AI findings
    // survive pattern re-lint (kept in a separate store field) so they remain
    // visible after incidental keystrokes, until the user starts a new scan.
    const mergedIssues = useMemo(
        () => [...issues, ...aiIssues],
        [issues, aiIssues]
    );
    const visibleIssues = showFindings ? mergedIssues : [];

    return (
        <div className="app-shell">
            <header className="top-bar">
                <div className="brand">
                    <span className="brand-title">Fiction Linter</span>
                    <span className="brand-tag">Desktop Studio</span>
                </div>

                {/*
                 * Main toolbar — three visually-grouped clusters:
                 *   1. Scan actions (AI Scan, Re-lint)
                 *   2. View toggles (Lint, Findings, Line #s)
                 *   3. Navigation (Next finding)
                 * Labels show the FUTURE state for toggles — same
                 * convention we established in the status bar.
                 */}
                <div className="toolbar">
                    <div className="toolbar-group">
                        <button
                            type="button"
                            className={`toolbar-btn toolbar-btn-action ${scanProgress ? 'running' : ''}`}
                            onClick={handleToggleAiScan}
                            title={scanProgress
                                ? `Scanning paragraph ${scanProgress.current} of ${scanProgress.total} — click to cancel`
                                : 'Run AI scan on the current document'}
                        >
                            <span className="toolbar-btn-icon" aria-hidden="true">
                                {scanProgress ? '\u21bb' : '\u2728'}
                            </span>
                            <span>
                                {scanProgress && scanProgress.total > 0
                                    ? `AI Scan: ${Math.round((scanProgress.current / scanProgress.total) * 100)}%`
                                    : 'AI Scan'}
                            </span>
                        </button>
                        <button
                            type="button"
                            className="toolbar-btn toolbar-btn-action"
                            onClick={handleRelint}
                            title="Reload SPE rules and re-run the deterministic lint over the current document"
                        >
                            <span className="toolbar-btn-icon" aria-hidden="true">{'\u21bb'}</span>
                            <span>Re-lint</span>
                        </button>
                    </div>

                    <div className="toolbar-group">
                        <button
                            type="button"
                            className={`toolbar-btn ${lintEnabled ? 'on' : 'off'}`}
                            onClick={() => setLintEnabled(!lintEnabled)}
                            title={lintEnabled ? 'Disable linting' : 'Enable linting'}
                        >
                            {lintEnabled ? 'Lint off' : 'Lint on'}
                        </button>
                        <button
                            type="button"
                            className={`toolbar-btn ${showFindings ? 'on' : 'off'}`}
                            onClick={() => setShowFindings(!showFindings)}
                            disabled={!lintEnabled}
                            title={showFindings ? 'Hide findings' : 'Show findings'}
                        >
                            {showFindings ? 'Hide findings' : 'Show findings'}
                        </button>
                        <button
                            type="button"
                            className={`toolbar-btn ${showLineNumbers ? 'on' : 'off'}`}
                            onClick={() => setShowLineNumbers(!showLineNumbers)}
                            title={showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}
                        >
                            {showLineNumbers ? 'No #s' : 'Line #s'}
                        </button>
                    </div>

                    <div className="toolbar-group">
                        <button
                            type="button"
                            className="toolbar-btn"
                            onClick={handleJumpNextFinding}
                            disabled={!visibleIssues.length}
                            title="Jump to the next finding (by severity, then position)"
                        >
                            Next {'\u203A'}
                        </button>
                    </div>
                </div>

                <div className="top-actions">
                    <ThemePicker />
                    <button
                        className="icon-button"
                        onClick={() => setShowSettings(true)}
                        aria-label="Open settings"
                        title="Settings"
                    >
                        {/*
                         * Lucide-style settings gear — the canonical
                         * 8-tooth outline cog that matches what users
                         * see in virtually every modern app (Slack,
                         * GitHub, VS Code, macOS System Settings all
                         * use this same profile).
                         */}
                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                </div>
            </header>

            <div className="workspace">
                <aside className="left-panel" style={{ width: `${leftPanelWidth}px` }}>
                    <div className="panel-header">
                        <div className="panel-header-title">
                            <span>Files</span>
                            {rootPath ? <span className="path-pill">{rootPath}</span> : null}
                        </div>
                        <button
                            className="panel-header-action"
                            onClick={handleChooseFolder}
                            title="Open folder"
                            aria-label="Open folder"
                        >
                            Open
                        </button>
                    </div>
                    <FileTree
                        nodes={tree}
                        onToggle={handleToggleNode}
                        onSelect={handleSelectFile}
                        selectedPath={currentFile?.path}
                    />
                </aside>
                <PanelResizer
                    currentWidth={leftPanelWidth}
                    onResize={handleResize}
                    minWidth={160}
                    maxWidth={typeof window !== 'undefined' ? Math.floor(window.innerWidth * 0.5) : 800}
                />

                <main className="right-panel">
                    <TabBar
                        tabs={tabs}
                        activeTabId={activeTabId}
                        onSelect={setActiveTab}
                        onClose={closeTab}
                        onCloseAll={closeAllTabs}
                    />
                    <Editor
                        ref={editorRef}
                        value={content}
                        onChange={updateContent}
                        issues={visibleIssues}
                        showFindings={showFindings}
                        onSave={handleSave}
                        onStateChange={setEditorState}
                        wrap={wrap}
                        onToggleWrap={() => setWrap(w => !w)}
                        onFixLater={handleFixLater}
                        onFixNow={handleFixNow}
                        showLineNumbers={showLineNumbers}
                    />
                </main>
            </div>

            <StatusBar
                status={status}
                content={content}
                cursorLine={editorState.line}
                cursorColumn={editorState.column}
                selection={editorState.selection}
                dirty={dirty}
                issueCount={visibleIssues.length}
            />

            {showSettings && settings ? (
                <SettingsDialog
                    settings={settings}
                    onCancel={() => setShowSettings(false)}
                    onSave={handleSettingsSave}
                />
            ) : null}
        </div>
    );
}

function buildNodes(entries) {
    return entries.map(entry => ({
        ...entry,
        expanded: false,
        children: null
    }));
}

function findNode(nodes, nodePath) {
    for (const node of nodes) {
        if (node.path === nodePath) {
            return node;
        }
        if (node.children) {
            const found = findNode(node.children, nodePath);
            if (found) return found;
        }
    }
    return null;
}

function indexToLineCol(text, index) {
    const slice = text.slice(0, index);
    const lines = slice.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column };
}

// Extract the FIRST of three alternative rewrites returned by the AI.
//
// The prompt asks for "1. foo\n2. bar\n3. baz" format, and most models
// honor it. Some — particularly smaller free models — return unnumbered
// alternatives separated by blank lines, or numbered with subtle format
// variations. Try strategies in order of specificity:
//
//   1. Numbered list: "1. foo\n2. bar\n..." with 1., 1), or 1: prefix
//   2. Unnumbered paragraphs: split on blank lines, take the first
//      non-empty line/paragraph that looks like a plausible replacement
//      (not just a preamble sentence)
//
// Returns null if nothing usable is found — caller logs the raw response
// so the user can manually extract an alternative.
export function extractFirstRewrite(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const cleaned = raw.replace(/^```[a-z]*\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    if (!cleaned) return null;

    // Strategy 1: numbered list.
    const numbered = cleaned.match(/^\s*1[.):]\s*(.+?)(?=\n\s*2[.):]|\n{2,}|$)/s);
    if (numbered) {
        return numbered[1].trim().replace(/^["'"]+|["'"]+$/g, '');
    }

    // Strategy 2: unnumbered paragraphs. Split on blank lines, filter out
    // empties and obvious preamble ("Here are three alternatives:"), take
    // the first remaining block. Preamble detection is a heuristic: a
    // sentence ending in ":" that contains the word "alternative" or
    // "rewrite" is almost certainly a preamble line.
    const blocks = cleaned
        .split(/\n{2,}/)
        .map(b => b.trim())
        .filter(Boolean)
        .filter(b => !/^.{0,60}(alternatives?|rewrites?|options?|suggestions?)\s*:\s*$/i.test(b));
    if (blocks.length > 0) {
        return blocks[0].replace(/^["'"]+|["'"]+$/g, '');
    }

    return null;
}

export default App;
