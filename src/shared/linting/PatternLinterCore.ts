import { LintFinding, LintSeverity, SPEData } from './types';

export class PatternLinterCore {
    public lintText(text: string, data: SPEData): LintFinding[] {
        const findings: LintFinding[] = [];

        if (data.cliches) {
            findings.push(...this.checkCategory(text, data.cliches.somatic_cliches, 'Somatic Cliche', 'warning'));
            findings.push(...this.checkCategory(text, data.cliches.overused_adjectives_adverbs, 'Overused Adjective/Adverb', 'info'));
            findings.push(...this.checkCategory(text, data.cliches.weak_descriptors, 'Weak Descriptor', 'info'));
            findings.push(...this.checkCategory(text, data.cliches.emotion_tells, 'Emotion Tell', 'warning'));
            findings.push(...this.checkCategory(text, data.cliches.purple_prose, 'Purple Prose', 'warning'));
            findings.push(...this.checkCategory(text, data.cliches.banned_cliches?.patterns, 'Banned Cliche', 'error'));
            findings.push(...this.checkCategory(text, data.cliches.ai_structural_patterns?.patterns, 'AI Structural Pattern', 'error'));

            const simileFindings = this.checkCategory(text, data.cliches.similes?.patterns, 'Simile Detection', 'info');
            if (simileFindings.length > 0) {
                const totalSimiles = simileFindings.length;
                simileFindings.forEach(finding => {
                    finding.message = `${finding.message} (Total: ${totalSimiles})`;
                });
                findings.push(...simileFindings);
            }
        }

        return findings;
    }

    private checkCategory(text: string, items: any[], categoryInfo: string, severity: LintSeverity): LintFinding[] {
        const findings: LintFinding[] = [];
        if (!items || !Array.isArray(items)) return findings;

        for (const item of items) {
            const pattern = item.phrase || item.pattern;
            if (!pattern) continue;

            const regex = new RegExp(`\\b${this.escapeRegExp(pattern)}\\b`, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                if (item.exclude_dialogue && this.isInsideQuotes(match.index, text)) {
                    continue;
                }

                const message = `${categoryInfo}: "${pattern}". Penalty: ${item.penalty_score || 'N/A'}. ${item.suggested_fix ? 'Fix: ' + item.suggested_fix : ''}`;
                findings.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    message,
                    severity,
                    source: 'Fiction Linter'
                });
            }
        }

        return findings;
    }

    private isInsideQuotes(index: number, text: string): boolean {
        let quoteCount = 0;
        const lastNewline = text.lastIndexOf('\n', index);
        const searchStart = lastNewline === -1 ? 0 : lastNewline;

        for (let i = searchStart; i < index; i++) {
            if (text[i] === '"' || text[i] === '\u201C' || text[i] === '\u201D') {
                quoteCount++;
            }
        }
        return quoteCount % 2 !== 0;
    }

    private escapeRegExp(value: string) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
