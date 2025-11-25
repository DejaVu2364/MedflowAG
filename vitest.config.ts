/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './setupTests.ts',
        env: {
            GEMINI_API_KEY: 'test-key',
            API_KEY: 'test-key'
        }
    },
});
