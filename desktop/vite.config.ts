import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: path.resolve(__dirname),
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        port: 5173,
        strictPort: true,
        fs: {
            allow: ['..']
        },
        watch: {
            ignored: ['**/release/**', '**/dist/**']
        }
    },
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../src/shared')
        }
    }
});
