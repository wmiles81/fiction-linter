import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PatternLinterCore, NameValidatorCore } from '@shared/linting';
import FileTree from './components/FileTree';
import EditorPanel from './components/EditorPanel';
import SettingsDialog from './components/SettingsDialog';
import IssueList from './components/IssueList';
import PanelResizer from './components/PanelResizer';

const emptyData = {
    cliches: {},
    names: {},
    places: {},
    protocols: {}
};

function App() {
    const [rootPath, setRootPath] = useState('');
    const [tree, setTree] = useState([]);
    const [currentFile, setCurrentFile] = useState(null);
    const [content, setContent] = useState('');
    const [dirty, setDirty] = useState(false);
    const [settings, setSettings] = useState(null);
    const [speData, setSpeData] = useState(emptyData);
    const [issues, setIssues] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const [status, setStatus] = useState('Ready');
    const [leftPanelWidth, setLeftPanelWidth] = React.useState(() => {
        if (typeof window === 'undefined') return 260;
        const stored = window.localStorage.getItem('fl.leftPanelWidth');
        return stored ? Math.max(160, parseInt(stored, 10)) : 260;
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

    useEffect(() => {
        window.api.getSettings().then(setSettings);
    }, []);

    useEffect(() => {
        if (!settings?.spePath) return;
        window.api.loadSpeData(settings.spePath).then(setSpeData);
    }, [settings?.spePath]);

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
            setTree(prev => updateNode(prev, nodePath, node => ({ ...node, expanded: !node.expanded })));
            return;
        }

        const entries = await window.api.listDirectory(target.path);
        setTree(prev =>
            updateNode(prev, nodePath, node => ({
                ...node,
                expanded: true,
                children: buildNodes(entries)
            }))
        );
    };

    const handleSelectFile = async node => {
        if (node.isDirectory) return;
        const result = await window.api.readFile(node.path);
        if (!result.ok) {
            setStatus(result.error || 'Unable to read file.');
            return;
        }
        setStatus('Loaded file.');
        setCurrentFile({ name: node.name, path: node.path });
        setContent(result.contents);
        setDirty(false);
    };

    const handleSave = async () => {
        if (!currentFile) return;
        const result = await window.api.writeFile(currentFile.path, content);
        if (result.ok) {
            setDirty(false);
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
                    <IssueList issues={issues} onJump={handleJumpToIssue} getSnippet={getSnippet} />
                </main>
            </div>

            <footer className="status-bar">
                <span>{status}</span>
                <span>{issues.length} findings</span>
            </footer>

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

function updateNode(nodes, nodePath, updater) {
    return nodes.map(node => {
        if (node.path === nodePath) {
            return updater(node);
        }
        if (node.children) {
            return { ...node, children: updateNode(node.children, nodePath, updater) };
        }
        return node;
    });
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
