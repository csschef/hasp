/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // Ensures paths work correctly in HA subfolders like /local/dashboard/
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://homeassistant.local:8123',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  }
});



