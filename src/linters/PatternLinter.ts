import * as vscode from 'vscode';
import { PatternLinterCore, SPEData, LintFinding } from '../shared/linting';

export class PatternLinter {
    private core = new PatternLinterCore();

    public lint(document: vscode.TextDocument, data: SPEData): vscode.Diagnostic[] {
        const findings = this.core.lintText(document.getText(), data);
        return findings.map(finding => this.toDiagnostic(document, finding));
    }

    private toDiagnostic(document: vscode.TextDocument, finding: LintFinding): vscode.Diagnostic {
        const startPos = document.positionAt(finding.start);
        const endPos = document.positionAt(finding.end);
        const range = new vscode.Range(startPos, endPos);
        const diagnostic = new vscode.Diagnostic(range, finding.message, this.mapSeverity(finding));
        diagnostic.source = finding.source || 'Fiction Linter';
        return diagnostic;
    }

    private mapSeverity(finding: LintFinding): vscode.DiagnosticSeverity {
        switch (finding.severity) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }
}
