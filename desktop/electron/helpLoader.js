'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/** Display order for help categories. Categories not in this list sort to the end. */
const CATEGORY_ORDER = [
    'Getting Started',
    'Toolbar',
    'Format Bar',
    'File Tree',
    'Editor',
    'Status Bar',
    'Settings',
    'Themes',
    'Data Files',
    'SPE Rules',
    'Licensing',
    'Keyboard Shortcuts'
];

/**
 * Parse a single markdown file's raw text into a help topic object.
 *
 * @param {string} rawMarkdown
 * @returns {{ id, title, category, order, summary, keywords: string[], body } | null}
 *   Returns null if the frontmatter is missing or lacks `id` / `title`.
 */
function parseHelpFile(rawMarkdown) {
    if (typeof rawMarkdown !== 'string') return null;

    // Frontmatter must start at the very beginning: ---\n...\n---\n
    const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = rawMarkdown.match(FRONTMATTER_RE);
    if (!match) return null;

    const yamlText = match[1];
    const body = match[2].trimEnd();

    let fm;
    try {
        fm = yaml.load(yamlText);
    } catch {
        return null;
    }

    if (!fm || typeof fm !== 'object') return null;
    if (!fm.id || !fm.title) return null;

    // Normalise keywords: accept comma-separated string OR array.
    let keywords = [];
    if (Array.isArray(fm.keywords)) {
        keywords = fm.keywords.map(k => String(k).trim()).filter(Boolean);
    } else if (typeof fm.keywords === 'string') {
        keywords = fm.keywords.split(',').map(k => k.trim()).filter(Boolean);
    }

    return {
        id: String(fm.id),
        title: String(fm.title),
        category: fm.category ? String(fm.category) : '',
        order: typeof fm.order === 'number' ? fm.order : 0,
        summary: fm.summary ? String(fm.summary) : '',
        keywords,
        body
    };
}

/**
 * Read all `.md` files from every direct subdirectory of `helpDir`, parse them,
 * and return a sorted array of topic objects.
 *
 * Sort order: category position in CATEGORY_ORDER (unlisted categories go last,
 * sorted alphabetically among themselves), then by topic `order`, then filename.
 *
 * @param {string} helpDir  Absolute path to the help directory.
 * @returns {Array<{ id, title, category, order, summary, keywords, body }>}
 */
function loadHelpIndex(helpDir) {
    if (!helpDir || !fs.existsSync(helpDir)) return [];

    const topics = [];

    let entries;
    try {
        entries = fs.readdirSync(helpDir, { withFileTypes: true });
    } catch {
        return [];
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const subDir = path.join(helpDir, entry.name);

        let files;
        try {
            files = fs.readdirSync(subDir);
        } catch {
            continue;
        }

        for (const file of files) {
            if (!file.endsWith('.md')) continue;
            const filePath = path.join(subDir, file);
            let raw;
            try {
                raw = fs.readFileSync(filePath, 'utf8');
            } catch {
                continue;
            }
            const topic = parseHelpFile(raw);
            if (topic) topics.push(topic);
        }
    }

    // Build a lookup: category name → index in CATEGORY_ORDER (-1 = not listed)
    const categoryIndex = (cat) => {
        const i = CATEGORY_ORDER.indexOf(cat);
        return i === -1 ? Infinity : i;
    };

    topics.sort((a, b) => {
        const ci = categoryIndex(a.category) - categoryIndex(b.category);
        if (ci !== 0) return ci;
        // Within the same category sort by order, then title for stable results
        const oi = a.order - b.order;
        if (oi !== 0) return oi;
        return a.title.localeCompare(b.title);
    });

    return topics;
}

module.exports = { parseHelpFile, loadHelpIndex, CATEGORY_ORDER };
