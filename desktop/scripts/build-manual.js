#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadHelpIndex } = require('../electron/helpLoader');

const HELP_DIR = path.join(__dirname, '..', 'help');
const OUT_DIR = path.join(__dirname, '..', 'manual');
const VERSION = require('../package.json').version;

// Embed the logo as a base64 data URI so the manual is fully self-contained.
// Uses the 64px retina version from public/ (not the full 2048px source).
function loadLogoDataUri() {
    const candidates = [
        path.join(__dirname, '..', 'public', 'icon.png'),
        path.join(__dirname, '..', 'build', 'icon.png')
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            const buf = fs.readFileSync(p);
            return `data:image/png;base64,${buf.toString('base64')}`;
        }
    }
    return null;
}

async function renderMarkdown(md) {
    const { unified } = await import('unified');
    const remarkParse = (await import('remark-parse')).default;
    const remarkRehype = (await import('remark-rehype')).default;
    const rehypeStringify = (await import('rehype-stringify')).default;

    const file = await unified()
        .use(remarkParse)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify, { allowDangerousHtml: true })
        .process(md);
    return String(file);
}

function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
    const topics = loadHelpIndex(HELP_DIR);
    console.log(`Building manual from ${topics.length} topics...`);

    // Group by category (preserving input order since loadHelpIndex sorts)
    const grouped = new Map();
    for (const t of topics) {
        if (!grouped.has(t.category)) grouped.set(t.category, []);
        grouped.get(t.category).push(t);
    }

    // Build table of contents HTML
    let toc = '<nav id="toc"><h2>Table of Contents</h2><ul>';
    for (const [cat, catTopics] of grouped) {
        toc += `<li><a href="#cat-${slugify(cat)}">${cat}</a><ul>`;
        for (const t of catTopics) {
            toc += `<li><a href="#${t.id}">${t.title}</a></li>`;
        }
        toc += '</ul></li>';
    }
    toc += '</ul></nav>';

    const logoUri = loadLogoDataUri();

    // Build content HTML (render each topic's body)
    let content = '';
    for (const [cat, catTopics] of grouped) {
        content += `<section id="cat-${slugify(cat)}"><h2 class="cat-heading">${cat}</h2>`;
        for (const t of catTopics) {
            const html = await renderMarkdown(t.body);
            content += `<article id="${t.id}">${html}</article>`;
        }
        content += '</section>';
    }

    // Assemble full HTML page with embedded CSS
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiction Linter Desktop — User Manual</title>
<style>
/* Parchment-inspired manual styling */
body { font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; color: #2a2620; line-height: 1.7; background: #faf7f0; }
header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #d7d2c5; }
.header-logo { width: 80px; height: 80px; border-radius: 16px; margin-bottom: 12px; }
h1 { font-size: 32px; margin: 0 0 4px; color: #1c1b19; }
.version { color: #6b655b; font-size: 14px; margin: 0 0 4px; }
.publisher { color: #6b655b; font-size: 13px; }
nav { margin-bottom: 40px; }
nav h2 { font-size: 20px; color: #4a7a4a; }
nav ul { list-style: none; padding-left: 0; }
nav ul ul { padding-left: 24px; list-style: disc; }
nav li { margin: 3px 0; }
nav a { color: #4a7a4a; text-decoration: none; }
nav a:hover { text-decoration: underline; }
section { margin-bottom: 24px; }
.cat-heading { font-size: 24px; color: #4a7a4a; border-bottom: 1px solid #d7d2c5; padding-bottom: 6px; margin-top: 48px; }
article { margin-bottom: 36px; padding-bottom: 24px; border-bottom: 1px solid #ebe7df; }
article:last-child { border-bottom: none; }
h2 { font-size: 20px; margin: 0 0 12px; color: #1c1b19; }
h3 { font-size: 16px; margin: 24px 0 8px; color: #2a2620; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; }
th, td { border: 1px solid #d7d2c5; padding: 8px 12px; font-size: 14px; text-align: left; }
th { background: #f0ece4; font-weight: 600; }
code { background: #ebe7df; padding: 1px 6px; border-radius: 3px; font-size: 13px; font-family: 'SF Mono', Menlo, monospace; }
strong { color: #1c1b19; }
.copyright { color: #999; font-size: 12px; margin-top: 60px; border-top: 1px solid #d7d2c5; padding-top: 16px; text-align: center; }
@media print { nav { page-break-after: always; } body { background: white; } }
</style>
</head>
<body>
<header>
${logoUri ? `<img src="${logoUri}" alt="Fiction Linter" class="header-logo" />` : ''}
<h1>Fiction Linter Desktop</h1>
<p class="version">User Manual — v${VERSION}</p>
<p class="publisher">Ocotillo Quill Press LLC</p>
</header>
${toc}
<main>${content}</main>
<footer class="copyright">
<p>Copyright 2025 Ocotillo Quill Press LLC. All rights reserved.</p>
</footer>
</body>
</html>`;

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
    console.log(`Manual written to manual/index.html (${topics.length} topics, ${Math.round(html.length / 1024)}KB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
