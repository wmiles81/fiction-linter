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
