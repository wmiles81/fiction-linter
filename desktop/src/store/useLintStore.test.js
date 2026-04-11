import { describe, it, expect, beforeEach } from 'vitest';
import { useLintStore } from './useLintStore';

describe('useLintStore', () => {
    beforeEach(() => {
        useLintStore.setState({
            enabled: true,
            showFindings: true,
            issues: [],
            running: false
        });
    });

    it('master enable toggle flips the enabled flag', () => {
        useLintStore.getState().setEnabled(false);
        expect(useLintStore.getState().enabled).toBe(false);
    });

    it('show-findings toggle flips without affecting enabled', () => {
        useLintStore.getState().setShowFindings(false);
        expect(useLintStore.getState().showFindings).toBe(false);
        expect(useLintStore.getState().enabled).toBe(true);
    });

    it('setIssues replaces the issues list', () => {
        useLintStore.getState().setIssues([
            { start: 0, end: 3, message: 'x', severity: 'warning' }
        ]);
        expect(useLintStore.getState().issues).toHaveLength(1);
    });

    it('disabling linting clears issues automatically', () => {
        useLintStore.getState().setIssues([
            { start: 0, end: 3, message: 'x', severity: 'warning' }
        ]);
        useLintStore.getState().setEnabled(false);
        expect(useLintStore.getState().issues).toEqual([]);
    });
});
