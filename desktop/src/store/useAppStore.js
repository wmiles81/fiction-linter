import { create } from 'zustand';

const emptySpeData = { cliches: {}, names: {}, places: {}, protocols: {} };

export const useAppStore = create((set, get) => ({
    settings: null,
    speData: emptySpeData,
    status: 'Ready',
    rootPath: '',
    tree: [],

    setSettings: (settings) => set({ settings }),
    setSpeData: (speData) => set({ speData: speData || emptySpeData }),
    setStatus: (status) => set({ status }),
    setRootPath: (rootPath) => set({ rootPath }),
    setTree: (tree) => set({ tree }),

    updateNode: (nodePath, updater) => {
        const walk = (nodes) => nodes.map(node => {
            if (node.path === nodePath) return updater(node);
            if (node.children) return { ...node, children: walk(node.children) };
            return node;
        });
        set({ tree: walk(get().tree) });
    }
}));
