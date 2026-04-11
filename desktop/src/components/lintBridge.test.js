import { describe, it, expect } from 'vitest';
import { findingsToDiagnostics } from './lintBridge';

describe('findingsToDiagnostics', () => {
    it('maps severity to CodeMirror diagnostic severity names', () => {
        const findings = [
            { start: 0, end: 4, message: 'a', severity: 'error' },
            { start: 5, end: 9, message: 'b', severity: 'warning' },
            { start: 10, end: 14, message: 'c', severity: 'info' }
        ];
        const diags = findingsToDiagnostics(findings);
        expect(diags).toHaveLength(3);
        expect(diags[0]).toMatchObject({ from: 0, to: 4, severity: 'error', message: 'a' });
        expect(diags[1]).toMatchObject({ from: 5, to: 9, severity: 'warning', message: 'b' });
        expect(diags[2]).toMatchObject({ from: 10, to: 14, severity: 'info', message: 'c' });
    });

    it('defaults missing severity to info', () => {
        const diags = findingsToDiagnostics([{ start: 0, end: 1, message: 'x' }]);
        expect(diags[0].severity).toBe('info');
    });

    it('returns an empty array for undefined or empty inputs', () => {
        expect(findingsToDiagnostics(undefined)).toEqual([]);
        expect(findingsToDiagnostics([])).toEqual([]);
    });
});
