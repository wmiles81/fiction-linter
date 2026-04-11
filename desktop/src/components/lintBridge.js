import { linter } from '@codemirror/lint';
import { StateEffect, StateField } from '@codemirror/state';

/**
 * Convert shared-core LintFinding objects to CodeMirror Diagnostic objects.
 *
 * LintFinding shape: { start, end, message, severity, source }
 * Severity is one of 'error' | 'warning' | 'info'.
 */
export function findingsToDiagnostics(findings) {
    if (!Array.isArray(findings)) return [];
    return findings.map(finding => ({
        from: finding.start,
        to: finding.end,
        severity: finding.severity || 'info',
        message: finding.message,
        source: finding.source || 'Fiction Linter'
    }));
}

/**
 * A StateEffect carries a new list of diagnostics into the editor.
 * We dispatch this from React whenever the debounced lint produces a new
 * findings array.
 */
export const setDiagnosticsEffect = StateEffect.define();

/**
 * A StateField holds the current diagnostics. The linter() extension reads
 * from it when the editor re-renders.
 */
export const diagnosticsField = StateField.define({
    create() {
        return [];
    },
    update(current, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setDiagnosticsEffect)) {
                return effect.value;
            }
        }
        return current;
    }
});

/**
 * A linter extension that reads diagnostics from the state field.
 * Returning the current diagnostics is synchronous — we never re-run linting
 * inside CodeMirror; React is the orchestrator.
 */
export const pushLinter = linter(view => view.state.field(diagnosticsField));

/**
 * Convenience bundle: all three extensions a consumer needs to wire
 * push-based diagnostics into a CodeMirror instance.
 */
export const lintBridgeExtensions = [diagnosticsField, pushLinter];
