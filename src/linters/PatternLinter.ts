import * as vscode from 'vscode';
import { SPEData } from '../controllers/SPEController';

export class PatternLinter {
    public lint(document: vscode.TextDocument, data: SPEData): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 1. Check Cliche Collider
        if (data.cliches) {
            this.checkCategory(text, data.cliches.somatic_cliches, 'Somatic Cliche', vscode.DiagnosticSeverity.Warning, diagnostics, document);
            this.checkCategory(text, data.cliches.overused_adjectives_adverbs, 'Overused Adjective/Adverb', vscode.DiagnosticSeverity.Information, diagnostics, document);
            this.checkCategory(text, data.cliches.weak_descriptors, 'Weak Descriptor', vscode.DiagnosticSeverity.Information, diagnostics, document);
            this.checkCategory(text, data.cliches.emotion_tells, 'Emotion Tell', vscode.DiagnosticSeverity.Warning, diagnostics, document);
            this.checkCategory(text, data.cliches.purple_prose, 'Purple Prose', vscode.DiagnosticSeverity.Warning, diagnostics, document);
            this.checkCategory(text, data.cliches.banned_cliches?.patterns, 'Banned Cliche', vscode.DiagnosticSeverity.Error, diagnostics, document);
            this.checkCategory(text, data.cliches.ai_structural_patterns?.patterns, 'AI Structural Pattern', vscode.DiagnosticSeverity.Error, diagnostics, document);
            this.checkCategory(text, data.cliches.similes?.patterns, 'Simile Detection', vscode.DiagnosticSeverity.Information, diagnostics, document);
        }

        return diagnostics;
    }

    private checkCategory(text: string, items: any[], categoryInfo: string, severity: vscode.DiagnosticSeverity, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        if (!items || !Array.isArray(items)) return;

        for (const item of items) {
            const pattern = item.phrase || item.pattern;
            if (!pattern) continue;

            const regex = new RegExp(`\\b${this.escapeRegExp(pattern)}\\b`, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                // Check for exclude_dialogue flag
                if (item.exclude_dialogue && this.isInsideQuotes(match.index, text)) {
                    continue;
                }

                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);

                const message = `${categoryInfo}: "${pattern}". Penalty: ${item.penalty_score || 'N/A'}. ${item.suggested_fix ? 'Fix: ' + item.suggested_fix : ''}`;
                const diagnostic = new vscode.Diagnostic(range, message, severity);
                diagnostic.source = 'Fiction Linter';
                diagnostics.push(diagnostic);
            }
        }
    }

    private isInsideQuotes(index: number, text: string): boolean {
        let quoteCount = 0;
        // Simple parity check: count quotes from start of paragraph (or text) to index.
        const lastNewline = text.lastIndexOf('\n', index);
        const searchStart = lastNewline === -1 ? 0 : lastNewline;

        for (let i = searchStart; i < index; i++) {
            if (text[i] === '"' || text[i] === '“' || text[i] === '”') {
                quoteCount++;
            }
        }
        return quoteCount % 2 !== 0;
    }

    private escapeRegExp(string: string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
}
