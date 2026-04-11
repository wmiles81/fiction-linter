import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import DOMPurify from 'dompurify';

/**
 * Pre-rehype-remark pass: Google Docs / Word / Pages often emits text
 * with inline-styled <span> elements instead of real <strong>/<em>.
 * We walk the hast tree and rewrite those spans so the downstream
 * rehype -> remark conversion produces proper ** and * markup.
 */
function styledSpansToSemanticPlugin() {
    function isBoldSpan(node) {
        const style = node.properties?.style || '';
        return /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
    }
    function isItalicSpan(node) {
        const style = node.properties?.style || '';
        return /font-style\s*:\s*italic/i.test(style);
    }
    function isUnderlineSpan(node) {
        const style = node.properties?.style || '';
        return /text-decoration[^;]*underline/i.test(style);
    }
    function visit(node) {
        if (!node || !node.children) return;
        node.children = node.children.map(child => {
            if (child.type === 'element') {
                visit(child);
                if (child.tagName === 'span') {
                    const bold = isBoldSpan(child);
                    const italic = isItalicSpan(child);
                    const underline = isUnderlineSpan(child);
                    let inner = { ...child, properties: {} };
                    if (underline) {
                        inner = { type: 'element', tagName: 'u', properties: {}, children: inner.children };
                    }
                    if (italic) {
                        inner = { type: 'element', tagName: 'em', properties: {}, children: [inner] };
                    }
                    if (bold) {
                        inner = { type: 'element', tagName: 'strong', properties: {}, children: [inner] };
                    }
                    if (bold || italic || underline) {
                        return inner;
                    }
                    // Plain span: unwrap — preserve children as a fragment-like element
                    return { type: 'element', tagName: 'span', properties: {}, children: child.children };
                }
            }
            return child;
        });
    }
    return (tree) => {
        visit(tree);
    };
}

const mdToHtmlProcessor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize, defaultSchema)
    .use(rehypeStringify);

const htmlToMdProcessor = unified()
    .use(rehypeParse, { fragment: true })
    .use(styledSpansToSemanticPlugin)
    .use(rehypeRemark)
    .use(remarkStringify, {
        bullet: '-',
        fences: true,
        incrementListMarker: false,
        emphasis: '*',
        strong: '*',
        rule: '-',
        ruleRepetition: 3,
        ruleSpaces: false
    });

export async function markdownToHtml(markdown) {
    if (!markdown) return '';
    const file = await mdToHtmlProcessor.process(markdown);
    return String(file);
}

export async function htmlToMarkdown(html) {
    if (!html) return '';
    const file = await htmlToMdProcessor.process(html);
    return String(file);
}

/**
 * Final sanitizer applied BEFORE inserting into contenteditable.
 * Defense in depth — rehype-sanitize already runs, but dompurify catches
 * anything the pipeline missed (inline styles, newer XSS vectors, etc.).
 */
export function sanitizeHtml(html) {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
                       'strong', 'em', 'u', 's', 'code', 'pre',
                       'ul', 'ol', 'li', 'blockquote', 'a', 'img'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title']
    });
}
