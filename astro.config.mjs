// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Astro v6 static output supports mixed prerendered pages + server endpoints.
export default defineConfig({
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()]
  }
});
