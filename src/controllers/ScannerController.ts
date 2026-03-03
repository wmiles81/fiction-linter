import * as vscode from 'vscode';
import { AIController } from './AIController';
import { SPEController } from './SPEController';

export class ScannerController {
    private aiController: AIController;
    private speController: SPEController;
    private outputChannel: vscode.OutputChannel;
    private activeScanTokens: Map<string, vscode.CancellationTokenSource> = new Map();

    constructor(context: vscode.ExtensionContext, speController: SPEController, aiController: AIController, outputChannel?: vscode.OutputChannel) {
        this.aiController = aiController;
        this.speController = speController;
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Fiction Linter');
    }

    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] Scanner: ${message}`);
    }

    /**
     * Scans the user's selection in the editor
     */
    async scanSelection(editor: vscode.TextEditor): Promise<vscode.Diagnostic[]> {
        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text.trim()) {
            vscode.window.showWarningMessage('Fiction Linter: Please select text to analyze.');
            return [];
        }

        const diagnostics: vscode.Diagnostic[] = [];

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Fiction Linter: Deep Scanning...",
            cancellable: false
        }, async () => {
            const findings = await this.analyzeChunk(text);

            for (const finding of findings) {
                const diagnostic = this.createDiagnostic(editor.document, finding, editor.document.offsetAt(selection.start));
                if (diagnostic) {
                    diagnostics.push(diagnostic);
                }
            }

            if (diagnostics.length === 0) {
                vscode.window.showInformationMessage('Fiction Linter: Deep scan complete. No issues found.');
            }
        });

        return diagnostics;
    }

    /**
     * Find the chapter boundaries around the cursor position.
     * Chapters are detected by markdown headers (# Chapter, ## Chapter, etc.)
     * Returns { startOffset, endOffset, chapterTitle } or null if no chapter found.
     */
    findCurrentChapterBounds(
        document: vscode.TextDocument,
        cursorLine: number
    ): { startOffset: number; endOffset: number; chapterTitle: string } | null {
        const text = document.getText();
        const lines = text.split('\n');

        // Pattern to match chapter headers (# Chapter, ## Chapter, ### Chapter, etc.)
        // Also matches scene breaks like ### or ***
        const chapterPattern = /^#{1,3}\s+.*(chapter|part|prologue|epilogue|scene)/i;
        const headerPattern = /^#{1,3}\s+/;

        let chapterStartLine = -1;
        let chapterEndLine = lines.length - 1;
        let chapterTitle = 'Document';

        // Find the chapter start (look backwards from cursor)
        for (let i = cursorLine; i >= 0; i--) {
            const line = lines[i];
            if (chapterPattern.test(line) || (headerPattern.test(line) && i < cursorLine)) {
                chapterStartLine = i;
                chapterTitle = line.replace(/^#+\s*/, '').trim();
                break;
            }
        }

        // If no chapter found and we're not at the start, use document start
        if (chapterStartLine === -1) {
            chapterStartLine = 0;
        }

        // Find the chapter end (look forwards from cursor)
        for (let i = cursorLine + 1; i < lines.length; i++) {
            const line = lines[i];
            if (chapterPattern.test(line) || headerPattern.test(line)) {
                chapterEndLine = i - 1;
                break;
            }
        }

        // Calculate offsets
        let startOffset = 0;
        for (let i = 0; i < chapterStartLine; i++) {
            startOffset += lines[i].length + 1; // +1 for newline
        }

        let endOffset = 0;
        for (let i = 0; i <= chapterEndLine; i++) {
            endOffset += lines[i].length + 1;
        }

        this.log(`Chapter detected: "${chapterTitle}" (lines ${chapterStartLine + 1}-${chapterEndLine + 1})`);

        return {
            startOffset,
            endOffset,
            chapterTitle
        };
    }

    /**
     * Progressive background scan of a document or chapter.
     * Scans in chunks to avoid blocking and allow cancellation.
     * If cursorLine is provided, only scans the current chapter.
     */
    async scanDocumentProgressively(
        document: vscode.TextDocument,
        diagnosticCollection: vscode.DiagnosticCollection,
        existingDiagnostics: vscode.Diagnostic[],
        onProgress?: (percent: number) => void,
        cursorLine?: number
    ): Promise<void> {
        const uri = document.uri.toString();

        // Cancel any existing scan for this document
        const existingToken = this.activeScanTokens.get(uri);
        if (existingToken) {
            existingToken.cancel();
            this.activeScanTokens.delete(uri);
        }

        // Create new cancellation token
        const tokenSource = new vscode.CancellationTokenSource();
        this.activeScanTokens.set(uri, tokenSource);

        const config = vscode.workspace.getConfiguration('fiction-linter');
        const chunkSize = config.get<number>('autoAiScanChunkSize') || 5;

        // DEBUG: Log cursor line
        this.log(`DEBUG: cursorLine = ${cursorLine}, type = ${typeof cursorLine}`);

        // Determine scan bounds (chapter or full document)
        let textToScan: string;
        let baseOffset = 0;
        let scanDescription: string;

        if (cursorLine !== undefined) {
            // Scan only the current chapter
            const bounds = this.findCurrentChapterBounds(document, cursorLine);
            if (bounds) {
                const fullText = document.getText();
                textToScan = fullText.substring(bounds.startOffset, bounds.endOffset);
                baseOffset = bounds.startOffset;
                scanDescription = `chapter "${bounds.chapterTitle}"`;
            } else {
                textToScan = document.getText();
                scanDescription = 'full document';
            }
        } else {
            // Scan full document
            textToScan = document.getText();
            scanDescription = 'full document';
        }

        // Split into paragraphs
        const paragraphs = this.splitIntoParagraphs(textToScan);

        // Adjust paragraph offsets to be relative to full document
        for (const para of paragraphs) {
            para.startOffset += baseOffset;
        }

        if (paragraphs.length === 0) {
            this.log(`No paragraphs found in ${document.fileName}`);
            return;
        }

        this.log(`Starting progressive scan of ${scanDescription} in ${document.fileName} (${paragraphs.length} paragraphs, chunk size: ${chunkSize})`);

        const allDiagnostics: vscode.Diagnostic[] = [...existingDiagnostics];
        let scannedParagraphs = 0;

        try {
            // Process paragraphs in chunks
            for (let i = 0; i < paragraphs.length; i += chunkSize) {
                // Check for cancellation
                if (tokenSource.token.isCancellationRequested) {
                    this.log(`Scan cancelled for ${document.fileName}`);
                    break;
                }

                const chunk = paragraphs.slice(i, i + chunkSize);
                const chunkText = chunk.map(p => p.text).join('\n\n');
                const chunkStartOffset = chunk[0].startOffset;

                scannedParagraphs += chunk.length;
                const progress = Math.round((scannedParagraphs / paragraphs.length) * 100);

                // Call progress callback if provided
                if (onProgress) {
                    onProgress(progress);
                }

                this.log(`Scanning paragraphs ${i + 1}-${Math.min(i + chunkSize, paragraphs.length)} of ${paragraphs.length} (${progress}%)`);


                // Analyze this chunk
                const findings = await this.analyzeChunk(chunkText);

                // Check for cancellation after async call (more responsive cancel)
                if (tokenSource.token.isCancellationRequested) {
                    this.log(`Scan cancelled for ${document.fileName}`);
                    break;
                }

                for (const finding of findings) {
                    const diagnostic = this.createDiagnostic(document, finding, chunkStartOffset);
                    if (diagnostic) {
                        allDiagnostics.push(diagnostic);
                    }
                }

                // Update diagnostics after each chunk
                diagnosticCollection.set(document.uri, allDiagnostics);

                // Small delay to prevent overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const aiIssues = allDiagnostics.filter(d => d.source === 'Fiction Linter (AI)').length;
            this.log(`Scan complete for ${document.fileName}: ${aiIssues} AI issues found`);

            if (aiIssues > 0) {
                vscode.window.showInformationMessage(
                    `Fiction Linter: AI scan found ${aiIssues} issue(s)`,
                    'View Problems'
                ).then(selection => {
                    if (selection === 'View Problems') {
                        vscode.commands.executeCommand('workbench.actions.view.problems');
                    }
                });
            }

        } catch (error) {
            this.log(`Error during scan: ${error}`);
        } finally {
            this.activeScanTokens.delete(uri);
        }
    }

    /**
     * Cancel any active scan for a document
     */
    cancelScan(documentUri: string): void {
        const token = this.activeScanTokens.get(documentUri);
        if (token) {
            token.cancel();
            this.activeScanTokens.delete(documentUri);
            this.log(`Cancelled scan for ${documentUri}`);
        }
    }

    /**
     * Split document text into paragraphs with their offsets
     */
    private splitIntoParagraphs(text: string): Array<{ text: string; startOffset: number }> {
        const paragraphs: Array<{ text: string; startOffset: number }> = [];
        const lines = text.split('\n');
        let currentOffset = 0;

        for (const line of lines) {
            // Treat each non-empty line as a separate paragraph
            // This is better for fiction manuscripts where authors might use single spacing
            // or semantic line breaks.
            if (line.trim() !== '') {
                // Find the start of the non-whitespace content for better offset accuracy
                const leadingWhitespace = line.match(/^\s*/)?.[0].length || 0;

                paragraphs.push({
                    text: line.trim(),
                    startOffset: currentOffset + leadingWhitespace
                });
            }
            currentOffset += line.length + 1; // +1 for newline
        }

        return paragraphs;
    }

    /**
     * Analyze a chunk of text with AI
     */
    private async analyzeChunk(text: string): Promise<any[]> {
        const protocol = "Analyze the following fiction text. Identify issues related to: \n" +
            "1. Pacing (too fast/slow)\n" +
            "2. Tone inconsistencies\n" +
            "3. 'Filter words' or distancing language (felt, saw, realized)\n" +
            "4. Show, Don't Tell violations.\n" +
            "Return a JSON array of objects with fields: { 'offending_text': string, 'issue': string, 'suggestion': string }.";

        return await this.aiController.analyzeText(text, protocol);
    }

    /**
     * Create a diagnostic from an AI finding
     */
    private createDiagnostic(
        document: vscode.TextDocument,
        finding: any,
        baseOffset: number
    ): vscode.Diagnostic | null {
        const issueText = finding.offending_text;
        const issueDesc = finding.issue;
        const fixSuggestion = finding.suggestion;

        if (!issueText) return null;

        // Find the text in the document starting from baseOffset
        const docText = document.getText();
        const searchStart = docText.indexOf(issueText, baseOffset);

        if (searchStart !== -1) {
            const startPos = document.positionAt(searchStart);
            const endPos = document.positionAt(searchStart + issueText.length);
            const range = new vscode.Range(startPos, endPos);

            const diagnostic = new vscode.Diagnostic(
                range,
                `AI Detected: ${issueDesc}\nSuggestion: ${fixSuggestion}`,
                vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = 'Fiction Linter (AI)';
            diagnostic.code = 'ai-detected';
            return diagnostic;
        }

        return null;
    }
}
