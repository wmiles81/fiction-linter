import React, { useEffect, useMemo, useRef } from 'react';
import { PatternLinterCore, NameValidatorCore } from '@shared/linting';
import FileTree from './components/FileTree';
import Editor from './components/editor/Editor';
import { htmlToMarkdown } from './components/editor/converters';
import SettingsDialog from './components/SettingsDialog';
import PanelResizer from './components/PanelResizer';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
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
    const setIssues = useLintStore(state => state.setIssues);
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
        window.api.loadSpeData(settings.spePath).then(setSpeData);
    }, [settings?.spePath, setSpeData]);

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

    const handleChooseFolder = async () => {
        const selected = await window.api.chooseFolder();
        if (!selected) return;
        const entries = await window.api.listDirectory(selected);
        setRootPath(selected);
        setTree(buildNodes(entries));
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
            // .gdoc files are JSON pointers to cloud documents. Main attempts
            // an unauthenticated GET on Google's docx export URL. Three
            // possible outcomes:
            //   - kind: 'imported'       → public/anyone-with-link doc; the
            //                              docx binary was successfully
            //                              fetched and converted to HTML by
            //                              mammoth. Convert HTML to markdown
            //                              and open as a tab, exactly like a
            //                              local .docx import.
            //   - kind: 'auth-required'  → private doc, login page returned.
            //                              Fall back to opening the URL in
            //                              the user's browser.
            //   - !ok                    → real error (file missing, parse
            //                              failure, mammoth crash). Show the
            //                              error in the status bar.
            setStatus(`Opening ${node.name}…`);
            const result = await window.api.readGdoc(node.path);
            if (!result.ok) {
                setStatus(result.error || 'Unable to open .gdoc pointer.');
                return;
            }

            if (result.kind === 'imported') {
                try {
                    const markdown = await htmlToMarkdown(result.html || '');
                    // The .gdoc filename is sometimes "Untitled.gdoc" because
                    // Drive sync uses placeholder names. Use the baseName main
                    // extracted, or fall back to the filename minus .gdoc.
                    const baseName = result.baseName || node.name.replace(/\.gdoc$/i, '');
                    // Place the .md sibling next to the original .gdoc on
                    // disk, matching the .docx import semantics.
                    const dir = node.path.substring(0, node.path.lastIndexOf('/') + 1);
                    const mdPath = `${dir}${baseName}.md`;
                    const mdName = `${baseName}.md`;
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

            if (result.kind === 'auth-required') {
                // Private doc — we can't fetch it without OAuth. Open in
                // the user's browser so they can sign in there, and tell
                // them why the inline import did not work.
                const opened = await window.api.openExternal(result.url);
                if (!opened.ok) {
                    setStatus(opened.error || 'Unable to open URL externally.');
                    return;
                }
                setStatus(
                    `${node.name} is private; opened in browser. ${result.reason ? '' : ''}` +
                    `(Public/shared docs open inline. Make this doc "Anyone with the link can view" to import here.)`
                );
                return;
            }

            // Unknown kind — should never happen, defensive.
            setStatus(`Unable to open ${node.name}.`);
            return;
        }

        // Fallthrough: should never happen because the FileTree disables
        // ineligible files, but defensive against future regressions.
        setStatus(`Cannot open ${node.name}: unsupported file type.`);
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

    const visibleIssues = showFindings ? issues : [];

    return (
        <div className="app-shell">
            <header className="top-bar">
                <div className="brand">
                    <span className="brand-title">Fiction Linter</span>
                    <span className="brand-tag">Desktop Studio</span>
                </div>
                <div className="top-actions">
                    <button
                        className="icon-button"
                        onClick={() => setShowSettings(true)}
                        aria-label="Open settings"
                        title="Settings"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                d="M12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Zm8.7 3.3c0-.5-.1-1-.2-1.4l2-1.6-2-3.5-2.4 1a7.3 7.3 0 0 0-2.4-1.4L12.9 2H11l-.8 2.9a7.3 7.3 0 0 0-2.4 1.4l-2.4-1-2 3.5 2 1.6c-.1.4-.2.9-.2 1.4s.1 1 .2 1.4l-2 1.6 2 3.5 2.4-1a7.3 7.3 0 0 0 2.4 1.4l.8 2.9h1.9l.8-2.9a7.3 7.3 0 0 0 2.4-1.4l2.4 1 2-3.5-2-1.6c.1-.4.2-.9.2-1.4Z"
                                fill="currentColor"
                            />
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
                lintEnabled={lintEnabled}
                showFindings={showFindings}
                onToggleLint={() => setLintEnabled(!lintEnabled)}
                onToggleFindings={() => setShowFindings(!showFindings)}
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

export default App;
