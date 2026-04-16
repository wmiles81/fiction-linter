import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// CJS interop: helpLoader is a CommonJS module.
const require = createRequire(import.meta.url);
const { parseHelpFile, loadHelpIndex, CATEGORY_ORDER } = require('./helpLoader');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── parseHelpFile ────────────────────────────────────────────────────────────

describe('parseHelpFile', () => {
    it('extracts frontmatter fields and body correctly', () => {
        const raw = `---\nid: test-id\ntitle: Test Title\ncategory: Getting Started\norder: 1\nsummary: A summary.\nkeywords:\n  - foo\n  - bar\n---\n## Heading\n\nBody text.`;
        const result = parseHelpFile(raw);

        expect(result).not.toBeNull();
        expect(result.id).toBe('test-id');
        expect(result.title).toBe('Test Title');
        expect(result.category).toBe('Getting Started');
        expect(result.order).toBe(1);
        expect(result.summary).toBe('A summary.');
        expect(result.keywords).toEqual(['foo', 'bar']);
        expect(result.body).toContain('## Heading');
        expect(result.body).toContain('Body text.');
    });

    it('returns null for files without valid frontmatter (missing id)', () => {
        const raw = `---\ntitle: No ID\ncategory: Editor\norder: 1\n---\n\nBody.`;
        expect(parseHelpFile(raw)).toBeNull();
    });

    it('returns null for files without valid frontmatter (missing title)', () => {
        const raw = `---\nid: no-title\ncategory: Editor\norder: 1\n---\n\nBody.`;
        expect(parseHelpFile(raw)).toBeNull();
    });

    it('returns null when there is no frontmatter at all', () => {
        expect(parseHelpFile('Just some plain text with no frontmatter.')).toBeNull();
    });

    it('handles keywords as a comma-separated string', () => {
        const raw = `---\nid: kw-test\ntitle: Keyword Test\ncategory: Toolbar\norder: 2\nsummary: Test.\nkeywords: alpha, beta, gamma\n---\n\nBody.`;
        const result = parseHelpFile(raw);
        expect(result).not.toBeNull();
        expect(result.keywords).toEqual(['alpha', 'beta', 'gamma']);
    });
});

// ─── loadHelpIndex ────────────────────────────────────────────────────────────

describe('loadHelpIndex', () => {
    const helpDir = path.join(__dirname, '..', 'help');

    it('loads the seed files and returns >= 5 topics with correct shape', () => {
        const topics = loadHelpIndex(helpDir);

        expect(topics.length).toBeGreaterThanOrEqual(5);

        for (const topic of topics) {
            expect(topic).toHaveProperty('id');
            expect(topic).toHaveProperty('title');
            expect(topic).toHaveProperty('category');
            expect(topic).toHaveProperty('order');
            expect(topic).toHaveProperty('summary');
            expect(Array.isArray(topic.keywords)).toBe(true);
            expect(topic).toHaveProperty('body');
        }
    });

    it('sorts Getting Started topics before Toolbar topics', () => {
        const topics = loadHelpIndex(helpDir);

        const gsIndex = topics.findIndex(t => t.category === 'Getting Started');
        const tbIndex = topics.findIndex(t => t.category === 'Toolbar');

        // Both categories must exist in the seed data
        expect(gsIndex).toBeGreaterThanOrEqual(0);
        expect(tbIndex).toBeGreaterThanOrEqual(0);

        expect(gsIndex).toBeLessThan(tbIndex);
    });
});

// ─── CATEGORY_ORDER ──────────────────────────────────────────────────────────

describe('CATEGORY_ORDER', () => {
    it('is an array starting with Getting Started', () => {
        expect(Array.isArray(CATEGORY_ORDER)).toBe(true);
        expect(CATEGORY_ORDER[0]).toBe('Getting Started');
    });

    it('contains Toolbar after Getting Started', () => {
        expect(CATEGORY_ORDER.indexOf('Toolbar')).toBeGreaterThan(
            CATEGORY_ORDER.indexOf('Getting Started')
        );
    });
});
