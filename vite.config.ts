import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures paths work correctly in HA subfolders like /local/dashboard/
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});



