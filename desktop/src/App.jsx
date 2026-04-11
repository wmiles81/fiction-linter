import React, { useEffect, useMemo, useRef } from 'react';
import { PatternLinterCore, NameValidatorCore } from '@shared/linting';
import FileTree from './components/FileTree';
import Editor from './components/editor/Editor';
import SettingsDialog from './components/SettingsDialog';
import IssueList from './components/IssueList';
import PanelResizer from './components/PanelResizer';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
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
            const findings = [
                ...patternCore.lintText(content, speData),
                ...nameCore.lintText(content, speData)
            ];

            const mapped = findings.map(finding => {
                const loc = indexToLineCol(content, finding.start);
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

    const handleJumpToIssue = issue => {
        editorRef.current?.jumpTo(issue);
    };

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
                    <IssueList
                        issues={visibleIssues}
                        onJump={handleJumpToIssue}
                        getSnippet={getSnippet}
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
