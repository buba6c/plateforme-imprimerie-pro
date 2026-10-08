import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.API_URL ?? 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: api, changeOrigin: false },
      '/socket.io': { target: api, ws: true, changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Les modules .mjs (moteur PDF) sortent en .js : extension reconnue par tous les serveurs web,
        // et nouvelle adresse qui contourne une ancienne réponse mal typée gardée en cache.
        assetFileNames: (info: { name?: string; names?: string[] }) =>
          (info.names?.[0] ?? info.name ?? '').endsWith('.mjs') ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]',
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (id.includes('@tanstack')) return 'query';
          if (/recharts|d3-|victory/.test(id)) return 'charts';
          return undefined;
        },
      },
    },
  },
});
