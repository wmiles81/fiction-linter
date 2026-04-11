/**
 * File eligibility rules for the file tree.
 *
 * Eligible files can be opened in the editor. Ineligible files are shown
 * in the tree but rendered as disabled so the user sees them without being
 * able to click them.
 *
 * To add a new eligible extension (e.g., '.docx' when import lands):
 * push it into ELIGIBLE_EXTENSIONS.
 */

export const ELIGIBLE_EXTENSIONS = new Set([
    '.md',
    '.markdown',
    '.txt'
]);

export function isFileEligible(fileName) {
    if (!fileName) return false;
    const dot = fileName.lastIndexOf('.');
    if (dot === -1) return false;
    const ext = fileName.slice(dot).toLowerCase();
    return ELIGIBLE_EXTENSIONS.has(ext);
}
