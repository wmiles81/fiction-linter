import { create } from 'zustand';

export const useLintStore = create((set) => ({
    enabled: true,
    showFindings: true,
    issues: [],       // deterministic pattern/name findings
    aiIssues: [],     // findings from the AI scan — survive pattern re-lint
    running: false,
    // When non-null, an AI scan is in progress. Shape: { current, total }.
    scanProgress: null,

    setEnabled: (enabled) => set((state) => ({
        enabled,
        // Clear issues when disabled so stale data does not reappear on re-enable.
        issues: enabled ? state.issues : [],
        aiIssues: enabled ? state.aiIssues : []
    })),
    setShowFindings: (showFindings) => set({ showFindings }),
    setIssues: (issues) => set({ issues }),
    setAiIssues: (aiIssues) => set({ aiIssues }),
    clearAiIssues: () => set({ aiIssues: [] }),
    setScanProgress: (scanProgress) => set({ scanProgress }),
    setRunning: (running) => set({ running })
}));
