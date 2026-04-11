import { create } from 'zustand';

export const useLintStore = create((set) => ({
    enabled: true,
    showFindings: true,
    issues: [],
    running: false,

    setEnabled: (enabled) => set((state) => ({
        enabled,
        // Clear issues when disabled so stale data does not reappear on re-enable.
        issues: enabled ? state.issues : []
    })),
    setShowFindings: (showFindings) => set({ showFindings }),
    setIssues: (issues) => set({ issues }),
    setRunning: (running) => set({ running })
}));
