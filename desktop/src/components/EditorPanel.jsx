import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import {
    lintBridgeExtensions,
    setDiagnosticsEffect,
    findingsToDiagnostics
} from './lintBridge';

function countWordsInSelection(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
}

const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '15px'
    },
    '.cm-scroller': {
        fontFamily: '"Fraunces", Georgia, serif',
        lineHeight: '1.4'
    },
    '.cm-content': {
        padding: '16px 20px'
    },
    '.cm-line': {
        padding: '0'
    }
});

const EditorPanel = forwardRef(function EditorPanel(
    { file, content, dirty, issues, onChange, onSave, onStateChange },
    ref
) {
    const viewRef = useRef(null);

    // Keep the latest onStateChange in a ref so the updateListener extension
    // (built once below) always calls the current handler without us having
    // to rebuild the extensions array and reinit the CodeMirror instance.
    const onStateChangeRef = useRef(onStateChange);
    React.useEffect(() => {
        onStateChangeRef.current = onStateChange;
    }, [onStateChange]);

    const stateListener = React.useMemo(
        () =>
            EditorView.updateListener.of(update => {
                if (!update.selectionSet && !update.docChanged) return;
                const cb = onStateChangeRef.current;
                if (!cb) return;
                const { state } = update;
                const main = state.selection.main;
                const line = state.doc.lineAt(main.head);
                let selection = null;
                if (!main.empty) {
                    const text = state.sliceDoc(main.from, main.to);
                    selection = {
                        chars: text.length,
                        words: countWordsInSelection(text)
                    };
                }
                cb({
                    line: line.number,
                    column: main.head - line.from + 1,
                    selection
                });
            }),
        []
    );

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
                    extensions={[markdown(), editorTheme, EditorView.lineWrapping, stateListener, ...lintBridgeExtensions]}
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
