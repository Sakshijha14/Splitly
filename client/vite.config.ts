import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // During development, send every /api request to the Express server.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
