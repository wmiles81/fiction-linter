import React from 'react';
import { isFileEligible } from '../lib/fileEligibility';

function FileTree({ nodes, onToggle, onSelect, selectedPath }) {
    if (!nodes.length) {
        return (
            <div className="empty-tree">
                <p>Pick a folder to start exploring your manuscript.</p>
            </div>
        );
    }

    return (
        <div className="tree-root">
            {nodes.map(node => (
                <TreeNode
                    key={node.path}
                    node={node}
                    onToggle={onToggle}
                    onSelect={onSelect}
                    selectedPath={selectedPath}
                    depth={0}
                />
            ))}
        </div>
    );
}

function TreeNode({ node, onToggle, onSelect, selectedPath, depth }) {
    const isSelected = selectedPath === node.path;
    const indent = { paddingLeft: `${depth * 16 + 12}px` };
    const eligible = node.isDirectory || isFileEligible(node.name);
    const disabled = !eligible && !node.isDirectory;

    const handleClick = () => {
        if (disabled) return;
        if (node.isDirectory) {
            onToggle(node.path);
        } else {
            onSelect(node);
        }
    };

    return (
        <div className="tree-node">
            <button
                className={`tree-row ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                style={indent}
                onClick={handleClick}
                disabled={disabled}
                data-path={node.path}
                title={disabled ? 'File type not supported for editing' : node.path}
            >
                <span className="tree-icon">
                    {node.isDirectory ? (node.expanded ? '▾' : '▸') : '•'}
                </span>
                <span className="tree-label">{node.name}</span>
            </button>
            {node.isDirectory && node.expanded && node.children ? (
                <div className="tree-children">
                    {node.children.map(child => (
                        <TreeNode
                            key={child.path}
                            node={child}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            selectedPath={selectedPath}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default FileTree;
