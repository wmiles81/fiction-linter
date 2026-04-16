import React, { useState, useEffect, useMemo, useRef } from 'react';
import { markdownToHtml } from './editor/converters';

function groupByCategory(topics) {
    const map = new Map();
    for (const topic of topics) {
        if (!map.has(topic.category)) {
            map.set(topic.category, []);
        }
        map.get(topic.category).push(topic);
    }
    return map;
}

function HelpTab({ topics = [], initialTopicId = null }) {
    const [selectedId, setSelectedId] = useState(initialTopicId || null);
    const [search, setSearch] = useState('');
    const [renderedHtml, setRenderedHtml] = useState('');
    const [expandedCategories, setExpandedCategories] = useState(() => {
        const initial = new Set();
        if (initialTopicId) {
            const topic = topics.find(t => t.id === initialTopicId);
            if (topic) initial.add(topic.category);
        } else {
            // Expand all categories by default
            for (const t of topics) initial.add(t.category);
        }
        return initial;
    });
    const contentRef = useRef(null);

    // Render markdown when selectedId changes
    useEffect(() => {
        if (!selectedId) {
            setRenderedHtml('');
            return;
        }
        const topic = topics.find(t => t.id === selectedId);
        if (!topic) {
            setRenderedHtml('');
            return;
        }
        let cancelled = false;
        markdownToHtml(topic.body).then(html => {
            if (!cancelled) setRenderedHtml(html);
        });
        return () => { cancelled = true; };
    }, [selectedId, topics]);

    // Scroll to top of content when topic changes
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [selectedId]);

    // Filter topics by search query
    const filteredTopics = useMemo(() => {
        if (!search.trim()) return topics;
        const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
        return topics.filter(topic => {
            const haystack = [
                topic.title,
                topic.keywords.join(' '),
                topic.body
            ].join(' ').toLowerCase();
            return terms.every(term => haystack.includes(term));
        });
    }, [topics, search]);

    // Build category grouping from filtered topics
    const categoryMap = useMemo(() => groupByCategory(filteredTopics), [filteredTopics]);

    // When search is active, auto-expand all matching categories
    useEffect(() => {
        if (search.trim()) {
            setExpandedCategories(prev => {
                const next = new Set(prev);
                for (const topic of filteredTopics) {
                    next.add(topic.category);
                }
                return next;
            });
        }
    }, [search, filteredTopics]);

    // Auto-expand the category of the selected topic
    useEffect(() => {
        if (selectedId) {
            const topic = topics.find(t => t.id === selectedId);
            if (topic) {
                setExpandedCategories(prev => {
                    if (prev.has(topic.category)) return prev;
                    const next = new Set(prev);
                    next.add(topic.category);
                    return next;
                });
            }
        }
    }, [selectedId, topics]);

    function toggleCategory(category) {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    }

    function handleTopicClick(id) {
        setSelectedId(id);
    }

    const selectedTopic = topics.find(t => t.id === selectedId);

    return (
        <div className="help-tab">
            <nav className="help-nav" aria-label="Help navigation">
                <input
                    className="help-search"
                    type="search"
                    placeholder="Search help..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search help topics"
                />
                <div className="help-tree">
                    {[...categoryMap.entries()].map(([category, categoryTopics]) => {
                        const isExpanded = expandedCategories.has(category);
                        return (
                            <div key={category}>
                                <button
                                    type="button"
                                    className="help-category-header"
                                    onClick={() => toggleCategory(category)}
                                    aria-expanded={isExpanded}
                                >
                                    <span>{isExpanded ? '\u25bc' : '\u25b6'}</span>
                                    {category}
                                </button>
                                {isExpanded && (
                                    <div className="help-category-items">
                                        {categoryTopics.map(topic => (
                                            <button
                                                key={topic.id}
                                                type="button"
                                                className={`help-topic-item${selectedId === topic.id ? ' selected' : ''}`}
                                                onClick={() => handleTopicClick(topic.id)}
                                                aria-current={selectedId === topic.id ? 'true' : undefined}
                                            >
                                                {topic.title}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </nav>
            <div className="help-content" ref={contentRef}>
                {selectedTopic ? (
                    <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                ) : (
                    <div className="help-empty">
                        <p>Fiction Linter Help &mdash; Select a topic</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default HelpTab;
