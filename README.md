# Marvel Movie Ranker

A single-page app for ranking Marvel movies into tiers — Top / Middle /
Middle / Bottom by default, but you can rename any tier. Drag movies from
the pool into a tier, drag between tiers to re-rank, and export the result
as an image.

## Features

- Pre-loaded with all Marvel Studios (MCU) theatrical releases, Iron Man
  (2008) through Fantastic Four: First Steps (2025).
- 4-tier board (Top / Middle / Middle / Bottom) — click any tier name to
  rename it.
- Drag movies from the side pool into a tier; drag placed movies between
  tiers or to reorder within a tier; drag a card out of the board (or click
  the ✕) to send it back to the pool.
- Search box to filter the movie pool.
- Add your own movies (Sony's Spider-Man Universe, X-Men, Blade, Fantastic
  Four (2005), etc.) via the "+ Add" form.
- Your ranking is saved automatically in the browser's local storage — it's
  all client-side, nothing is sent to a server.
- Export the finished tier list as a PNG.

## Running it locally

No build step required — it's plain HTML/CSS/JS.

```
open index.html
```

or serve the folder with any static file server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Deploying to GitHub Pages

This repo is already set up for Pages — the whole site is static files at
the repo root, and a workflow (`.github/workflows/deploy-pages.yml`)
auto-deploys on every push to `main`.

To turn it on:

1. Push/merge this code to your `main` branch.
2. In the repo on GitHub, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to **GitHub Actions**.
4. Push to `main` (or run the "Deploy to GitHub Pages" workflow manually
   from the **Actions** tab) — the site will publish at
   `https://<your-username>.github.io/<repo-name>/`.

If you'd rather not use Actions, the simpler classic route also works since
there's no build step: **Settings → Pages → Source: Deploy from a branch**,
pick `main` and `/ (root)`.
