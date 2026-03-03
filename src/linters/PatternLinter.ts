import * as vscode from 'vscode';
import { SPEData } from '../controllers/SPEController';

export class PatternLinter {
    private cache: Map<string, { regex: RegExp, map: Map<string, any> }> = new Map();
    private lastData: SPEData | undefined;

    public lint(document: vscode.TextDocument, data: SPEData): vscode.Diagnostic[] {
        // Clear cache if data reference changes (config reload)
        if (this.lastData !== data) {
            this.cache.clear();
            this.lastData = data;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 1. Check Cliche Collider
        if (data.cliches) {
            diagnostics.push(...this.checkCategory(text, data.cliches.somatic_cliches, 'Somatic Cliche', vscode.DiagnosticSeverity.Warning, document));
            diagnostics.push(...this.checkCategory(text, data.cliches.overused_adjectives_adverbs, 'Overused Adjective/Adverb', vscode.DiagnosticSeverity.Information, document));
            diagnostics.push(...this.checkCategory(text, data.cliches.weak_descriptors, 'Weak Descriptor', vscode.DiagnosticSeverity.Information, document));
            diagnostics.push(...this.checkCategory(text, data.cliches.emotion_tells, 'Emotion Tell', vscode.DiagnosticSeverity.Warning, document));
            diagnostics.push(...this.checkCategory(text, data.cliches.purple_prose, 'Purple Prose', vscode.DiagnosticSeverity.Warning, document));
            diagnostics.push(...this.checkCategory(text, data.cliches.banned_cliches?.patterns, 'Banned Cliche', vscode.DiagnosticSeverity.Error, document));
            diagnostics.push(...this.checkCategory(text, data.cliches.ai_structural_patterns?.patterns, 'AI Structural Pattern', vscode.DiagnosticSeverity.Error, document));

            // Similes specific - Count total
            const simileDiagnostics = this.checkCategory(text, data.cliches.similes?.patterns, 'Simile Detection', vscode.DiagnosticSeverity.Warning, document);
            console.log(`PatternLinter: Found ${simileDiagnostics.length} similes.`);
            if (simileDiagnostics.length > 0) {
                const totalSimiles = simileDiagnostics.length;
                simileDiagnostics.forEach(d => {
                    d.message = `${d.message} (Total: ${totalSimiles})`;
                });
                diagnostics.push(...simileDiagnostics);
            }
        }

        return diagnostics;
    }

    private checkCategory(text: string, items: any[], categoryInfo: string, severity: vscode.DiagnosticSeverity, document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        if (!items || !Array.isArray(items) || items.length === 0) return diagnostics;

        // 1. Get or Create Cached Regex/Map
        let cached = this.cache.get(categoryInfo);
        if (!cached) {
            const map = new Map<string, any>();
            const patterns: string[] = [];

            // Sort by length descending to match longest phrases first (e.g. "shrug" vs "shrug off")
            // We clone to avoid mutating the original data
            const sortedItems = [...items].sort((a, b) => {
                const pA = a.phrase || a.pattern || '';
                const pB = b.phrase || b.pattern || '';
                return pB.length - pA.length;
            });

            for (const item of sortedItems) {
                const pattern = item.phrase || item.pattern;
                if (!pattern) continue;

                // Store in map (lowercase for case-insensitive lookup)
                map.set(pattern.toLowerCase(), item);
                patterns.push(this.escapeRegExp(pattern));
            }

            if (patterns.length === 0) return diagnostics;

            // optimized: \b(p1|p2|p3)\b
            const regex = new RegExp(`\\b(${patterns.join('|')})\\b`, 'gi');
            cached = { regex, map };
            this.cache.set(categoryInfo, cached);
        }

        // 2. Execute Single Regex Scan
        // Reset lastIndex because we are reusing the regex instance
        cached.regex.lastIndex = 0;

        let match;
        while ((match = cached.regex.exec(text)) !== null) {
            const matchedText = match[0];
            const item = cached.map.get(matchedText.toLowerCase());

            if (!item) continue; // Should technically not happen if regex matches

            // Check for exclude_dialogue flag
            if (item.exclude_dialogue && this.isInsideQuotes(match.index, text)) {
                continue;
            }

            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + matchedText.length);
            const range = new vscode.Range(startPos, endPos);

            const message = `${categoryInfo}: "${matchedText}". Penalty: ${item.penalty_score || 'N/A'}. ${item.suggested_fix ? 'Fix: ' + item.suggested_fix : ''}`;
            const diagnostic = new vscode.Diagnostic(range, message, severity);
            diagnostic.source = 'Fiction Linter';
            diagnostics.push(diagnostic);
        }

        return diagnostics;
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
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
