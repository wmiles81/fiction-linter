---
id: file-tree-gdoc-import
title: Google Docs Import
category: File Tree
order: 3
summary: Click a .gdoc pointer file in the tree to import its content from Google Drive. If you are not already signed in, a sign-in window opens automatically. Imported content opens as an editable markdown tab.
keywords: google docs, gdoc, import, sign-in, google, auth, cloud, drive, pointer
---

## Google Docs Import

When Google Drive syncs a document to your Mac or Windows computer, it leaves a small `.gdoc` pointer file on disk. Fiction Linter can read these pointer files and import the actual document content from Google Drive.

### How to import a Google Doc

1. Open the folder that contains your `.gdoc` file using the **Open** button in the Files panel.
2. Click the `.gdoc` file in the tree.
3. Fiction Linter fetches the document from Google Drive and converts it to markdown.
4. The document opens as a new tab in the editor, ready to edit and lint.

### Sign-in flow

If your Google session has expired (or you have never signed in), Fiction Linter automatically opens a Google sign-in window. Sign in with the account that owns the document. Once signed in, the import retries and completes without any further steps.

Your sign-in session is stored by Electron so you do not need to sign in again during the same session. On subsequent launches, the session is typically still valid and the import completes immediately.

### Saving after import

The imported content opens as a new `.md` tab whose path sits next to the original `.gdoc` file. When you press **Save** (Cmd+S / Ctrl+S), the markdown is written to that `.md` file. The original `.gdoc` pointer is never modified.

### Limitations

- The document must be accessible with the signed-in Google account.
- Fiction Linter imports the text and basic formatting. Complex layouts, comments, and revision history are not imported.

### See also

- [Supported File Types](file-tree-file-types)
- [Save](format-save)
- [Word Document Import](file-tree-docx-import)
