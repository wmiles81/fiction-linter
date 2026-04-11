import React from 'react';

function TabBar({ tabs, activeTabId, onSelect, onClose, onCloseAll }) {
    if (!tabs || tabs.length === 0) {
        return <div className="tab-bar empty" aria-hidden="true" />;
    }

    return (
        <div className="tab-bar">
            <div className="tab-bar-scroll">
                {tabs.map(tab => {
                    const isActive = tab.id === activeTabId;
                    const label = tab.dirty ? `${tab.name} \u25cf` : tab.name;
                    return (
                        <div
                            key={tab.id}
                            className={`tab ${isActive ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}`}
                        >
                            <button
                                type="button"
                                className="tab-name"
                                onClick={() => onSelect(tab.id)}
                                title={tab.path || tab.name}
                                aria-label={tab.name}
                            >
                                {label}
                            </button>
                            <button
                                type="button"
                                className="tab-close"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose(tab.id);
                                }}
                                aria-label="Close tab"
                                title={`Close tab ${tab.name}`}
                            >
                                {'\u00d7'}
                            </button>
                        </div>
                    );
                })}
            </div>
            <button
                type="button"
                className="tab-bar-clear"
                onClick={onCloseAll}
                title="Close all tabs"
            >
                Clear all
            </button>
        </div>
    );
}

export default TabBar;
