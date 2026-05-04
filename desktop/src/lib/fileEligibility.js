/**
 * File eligibility rules for the file tree.
 *
 * Eligible files can be opened in the editor. Ineligible files are shown
 * in the tree but rendered as disabled so the user sees them without being
 * able to click them.
 *
 * Different eligible extensions take different open paths in App.handleSelectFile:
 *   - .md / .markdown / .txt → read as UTF-8 text, open as a tab with the file path
 *   - .docx → read as binary, run through mammoth → HTML → htmlToMarkdown,
 *             open as a tab with a sibling `.md` path so save writes to .md
 *             without overwriting the original .docx
 *   - .gdoc → parse JSON pointer, fetch HTML export from Google Docs API via
 *             Electron net.request (with Google sign-in if needed), convert
 *             HTML → markdown via unified, open as a tab with a sibling .md path
 *
 * `getFileKind(fileName)` returns the routing tag so the App layer can
 * dispatch on it without re-implementing extension matching.
 */

export const ELIGIBLE_EXTENSIONS = new Set([
    '.md',
    '.markdown',
    '.txt',
    '.docx',
    '.gdoc'
]);

export function isFileEligible(fileName) {
    if (!fileName) return false;
    const dot = fileName.lastIndexOf('.');
    if (dot === -1) return false;
    const ext = fileName.slice(dot).toLowerCase();
    return ELIGIBLE_EXTENSIONS.has(ext);
}

/**
 * Returns one of: 'text' | 'docx' | 'gdoc' | null
 *
 * - 'text': plain text file (markdown, txt) — read as UTF-8 via fs:readFile
 * - 'docx': Word document — read as binary via fs:readDocx, convert via mammoth
 * - 'gdoc': Google Docs pointer file — imported via fs:readGdoc, converted to markdown in-app
 * - null:   not openable
 */
export function getFileKind(fileName) {
    if (!fileName) return null;
    const dot = fileName.lastIndexOf('.');
    if (dot === -1) return null;
    const ext = fileName.slice(dot).toLowerCase();
    if (ext === '.docx') return 'docx';
    if (ext === '.gdoc') return 'gdoc';
    if (ext === '.md' || ext === '.markdown' || ext === '.txt') return 'text';
    return null;
}
