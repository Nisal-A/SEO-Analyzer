import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The API's CORS allows exactly CLIENT_ORIGIN, so never silently move to another port.
    strictPort: true,
  },
});

