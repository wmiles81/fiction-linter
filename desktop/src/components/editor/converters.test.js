import { describe, it, expect } from 'vitest';
import { markdownToHtml, htmlToMarkdown, sanitizeHtml } from './converters';

describe('markdownToHtml', () => {
    it('converts headings', async () => {
        const html = await markdownToHtml('# Title\n\n## Subtitle');
        expect(html).toContain('<h1>Title</h1>');
        expect(html).toContain('<h2>Subtitle</h2>');
    });

    it('converts bold and italic', async () => {
        const html = await markdownToHtml('**bold** and *italic*');
        expect(html).toMatch(/<strong>bold<\/strong>/);
        expect(html).toMatch(/<em>italic<\/em>/);
    });

    it('converts paragraphs with blank line separators', async () => {
        const html = await markdownToHtml('First paragraph.\n\nSecond paragraph.');
        expect(html).toMatch(/<p>First paragraph\.<\/p>/);
        expect(html).toMatch(/<p>Second paragraph\.<\/p>/);
    });

    it('converts horizontal rules (scene breaks)', async () => {
        const html = await markdownToHtml('Before\n\n---\n\nAfter');
        expect(html).toContain('<hr>');
    });

    it('preserves nested emphasis', async () => {
        const html = await markdownToHtml('***bold italic***');
        expect(html).toMatch(/<em><strong>bold italic<\/strong><\/em>|<strong><em>bold italic<\/em><\/strong>/);
    });
});

describe('htmlToMarkdown', () => {
    it('round-trips basic markdown', async () => {
        const original = '# Hello\n\nThis is **bold** and *italic*.\n';
        const html = await markdownToHtml(original);
        const back = await htmlToMarkdown(html);
        expect(back.trim()).toBe('# Hello\n\nThis is **bold** and *italic*.'.trim());
    });

    it('handles paragraph splits', async () => {
        const html = '<p>First.</p><p>Second.</p>';
        const md = await htmlToMarkdown(html);
        expect(md).toMatch(/First\./);
        expect(md).toMatch(/Second\./);
    });

    it('handles horizontal rules as scene breaks', async () => {
        const html = '<p>Before</p><hr><p>After</p>';
        const md = await htmlToMarkdown(html);
        expect(md).toMatch(/Before/);
        expect(md).toMatch(/---/);
        expect(md).toMatch(/After/);
    });

    it('handles pasted gdoc-like HTML with extra whitespace', async () => {
        const html = `<p><span style="font-weight:700">Bold text</span> and <span style="font-style:italic">italic</span>.</p>`;
        const md = await htmlToMarkdown(html);
        expect(md).toMatch(/\*\*Bold text\*\*/);
        expect(md).toMatch(/\*italic\*/);
    });
});

describe('sanitizeHtml', () => {
    it('strips script tags', () => {
        const clean = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
        expect(clean).toContain('<p>ok</p>');
        expect(clean).not.toContain('<script');
    });

    it('strips inline event handlers', () => {
        const clean = sanitizeHtml('<p onclick="alert(1)">ok</p>');
        expect(clean).toContain('<p>ok</p>');
        expect(clean).not.toContain('onclick');
    });

    it('preserves safe formatting elements', () => {
        const dirty = '<h1>Title</h1><p><strong>bold</strong> <em>italic</em></p><hr>';
        const clean = sanitizeHtml(dirty);
        expect(clean).toContain('<h1>Title</h1>');
        expect(clean).toContain('<strong>');
        expect(clean).toContain('<em>');
        expect(clean).toContain('<hr>');
    });
});
