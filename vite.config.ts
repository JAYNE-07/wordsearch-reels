import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://jayne-07.github.io/wordsearch-reels/ on GitHub Pages.
export default defineConfig({
  base: '/wordsearch-reels/',
  plugins: [react()],
});
