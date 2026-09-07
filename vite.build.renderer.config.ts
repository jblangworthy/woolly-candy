import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: '.vite/renderer/main_window',
    emptyOutDir: true,
    minify: true,
  },
});
