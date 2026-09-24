import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { pwaShell } from './scripts/pwa.mjs';
import { validatePublicConfig } from './scripts/public-config.mjs';
export default defineConfig(({ mode }) => {
  validatePublicConfig({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env });
  return {
  plugins: [react(), pwaShell()], base: './', server: { port: 5173 }, preview: { port: 4173 },
  build: { rollupOptions: { output: { manualChunks: { supabase: ['@supabase/supabase-js'], react: ['react', 'react-dom'] } } } },
}; });
