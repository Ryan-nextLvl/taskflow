import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    // O chunk principal reúne React, Radix, React Router e React Query (~180 KB gzip);
    // as páginas e bibliotecas pesadas (Recharts, dnd-kit) são carregadas sob demanda.
    chunkSizeWarningLimit: 650,
  },
  server: {
    port: 5173,
    // Em desenvolvimento, /api é encaminhado ao back-end (sem CORS no navegador).
    proxy: { '/api': { target: 'http://localhost:3333', changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://localhost:3333', changeOrigin: true } },
  },
});
