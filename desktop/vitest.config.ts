import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../src/shared')
        }
    },
    server: {
        fs: {
            allow: ['..']
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.js'],
        include: [
            'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
            '../src/shared/**/*.{test,spec}.{ts,tsx}'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html']
        }
    }
});
