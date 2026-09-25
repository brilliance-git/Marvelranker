# Marvel Movie Ranker

A single-page app for ranking Marvel movies on a 2x2 quadrant chart — drag
each movie to where it belongs, define what the axes mean, and export the
result as an image.

## Features

- Pre-loaded with all Marvel Studios (MCU) theatrical releases, Iron Man
  (2008) through Fantastic Four: First Steps (2025).
- Drag movies from the side pool onto the board; drag placed movies to
  reposition them; drag a card off the board (or click the ✕) to remove it.
- Axis labels (top/bottom/left/right) are editable text, so you decide what
  the quadrants mean — e.g. Quality vs. Rewatchability, or your own scheme.
- Search box to filter the movie pool.
- Add your own movies (Sony's Spider-Man Universe, X-Men, Blade, Fantastic
  Four (2005), etc.) via the "+ Add" form.
- Your board is saved automatically to the browser's local storage.
- Export the finished chart as a PNG.

## Running it

No build step required — it's plain HTML/CSS/JS.

```
open index.html
```

or serve the folder with any static file server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.
