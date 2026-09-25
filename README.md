# Marvel Movie Ranker

A single-page app for stack-ranking every MCU movie into a forced quartile
split — Top Quartile / Second Quartile / Third Quartile / Bottom Quartile
(rename any of them by clicking the name). Each quartile's capacity is
fixed to an equal share of the full movie list, so the ranking works like a
real stack rank: you can't just pile everything into "Top."

## Features

- Every Marvel Studios (MCU) theatrical release, Iron Man (2008) through
  the most recent Spider-Man film, Spider-Man: Brand New Day (2026) —
  38 movies. Non-MCU Marvel movies (Sony's Spider-Man Universe, Fox's
  X-Men, etc.) are intentionally excluded.
- Forced 4-way quartile split: with 38 movies that's 10 / 10 / 9 / 9 per
  quartile (shown live as "x / capacity" on each row). A quartile that's
  full rejects new drops until you remove something — that's the point of
  a stack rank.
- Drag movies from the side pool into a quartile; drag placed movies
  between quartiles or to reorder within one; drag a card out of the board
  (or click the ✕) to send it back to the pool.
- Search box to filter the movie pool.
- Your ranking is saved automatically in the browser's local storage — it's
  all client-side, nothing is sent to a server.
- Export the finished ranking as a PNG.

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
