# tfistudios.com — Two Feathers Intelligence

Static website for Two Feathers Intelligence (TFI), built with Astro and Tailwind CSS.

## Setup

```bash
npm install
npm run dev      # Start dev server at localhost:4321
npm run build    # Build static site to dist/
npm run preview  # Preview production build locally
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Vercel auto-detects Astro — no config needed
4. Set custom domain to `tfistudios.com` in Vercel project settings

Alternatively, deploy via CLI:

```bash
npx vercel
```

## Project Structure

```
src/
  layouts/Layout.astro   — Base HTML layout with meta tags
  pages/index.astro      — Single-page site (all 5 sections)
  styles/global.css      — Tailwind imports + custom theme
public/
  assets/                — Brand images (insignia, avatar, backgrounds)
```

## Tech Stack

- [Astro](https://astro.build) v6 — Static site generator
- [Tailwind CSS](https://tailwindcss.com) v4 — Utility-first CSS
- Deploy target: Vercel
