import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({ plugins:[react()], define:{ 'process.env.EXTENSION_API_BASE_URL': JSON.stringify(process.env.EXTENSION_API_BASE_URL ?? 'http://localhost:4000') }, build:{ outDir:'dist', emptyOutDir:true, rollupOptions:{ input:{ popup: resolve(__dirname,'src/popup/index.html'), serviceWorker: resolve(__dirname,'src/background/serviceWorker.ts'), content: resolve(__dirname,'src/content/index.ts') }, output:{ entryFileNames:'assets/[name].js', chunkFileNames:'assets/[name].js', assetFileNames:'assets/[name][extname]' } } } });
