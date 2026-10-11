import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/verify': 'http://localhost:3001',
      '/dashboard': 'http://localhost:3001',
      '/esp32': 'http://localhost:3001',
      '/telemetry': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
});
