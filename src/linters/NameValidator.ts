import * as vscode from 'vscode';
import { SPEData } from '../controllers/SPEController';

export class NameValidator {
    public lint(document: vscode.TextDocument, data: SPEData): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        if (data.names && data.names.global_exclusion) {
            this.checkNames(text, data.names.global_exclusion.forbidden_first_names, 'Forbidden First Name', diagnostics, document);
            this.checkNames(text, data.names.global_exclusion.forbidden_surnames, 'Forbidden Surname', diagnostics, document);
        }

        if (data.places && data.places.global_exclusion) {
            this.checkNames(text, data.places.global_exclusion.forbidden_town_names, 'Forbidden Town Name', diagnostics, document);
            this.checkNames(text, data.places.global_exclusion.forbidden_city_names, 'Forbidden City Name', diagnostics, document);
            this.checkNames(text, data.places.global_exclusion.forbidden_fantasy_locations, 'Forbidden Fantasy Location', diagnostics, document);
        }

        return diagnostics;
    }

    private checkNames(text: string, names: string[], category: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        if (!names || !Array.isArray(names)) return;

        for (const name of names) {
            const regex = new RegExp(`\\b${this.escapeRegExp(name)}\\b`, 'g'); // Case sensitive for names? SPE says AI defaults, usually capitalized. Let's do sensitive for exact match to avoid false positives on common words if they overlap.
            // Actually, for broad catching, case-insensitive might be better but riskier. Let's stick to case-sensitive for names as they are proper nouns.
            // Wait, "Rose" is a name and a flower. "Hunter" is a name and a noun.
            // Let's rely on the user to ignore if false positive, or maybe add case sensitivity.
            // SPE lists are capitalized.

            let match;
            while ((match = regex.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);

                const message = `${category}: "${name}". This is a high-frequency AI default name.`;
                const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
                diagnostic.source = 'Fiction Linter';
                diagnostics.push(diagnostic);
            }
        }
    }

    private escapeRegExp(string: string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
