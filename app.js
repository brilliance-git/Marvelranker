(function () {
  "use strict";

  const STORAGE_KEY = "marvel-ranker-state-v1";

  const board = document.getElementById("board");
  const cardsLayer = document.getElementById("cards-layer");
  const moviePool = document.getElementById("movie-pool");
  const searchInput = document.getElementById("search-input");
  const addForm = document.getElementById("add-movie-form");
  const addTitleInput = document.getElementById("add-movie-title");
  const addYearInput = document.getElementById("add-movie-year");
  const resetBtn = document.getElementById("reset-btn");
  const exportBtn = document.getElementById("export-btn");
  const statusText = document.getElementById("status-text");
  const labelEls = {
    top: document.getElementById("label-top"),
    bottom: document.getElementById("label-bottom"),
    left: document.getElementById("label-left"),
    right: document.getElementById("label-right"),
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  const saved = loadState();

  const state = {
    placements: (saved && saved.placements) || {},
    customMovies: (saved && saved.customMovies) || [],
    labels: Object.assign(
      { top: "Great", bottom: "Bad", left: "Skip it", right: "Rewatch forever" },
      (saved && saved.labels) || {}
    ),
  };

  function allMovies() {
    return MARVEL_MOVIES.concat(state.customMovies);
  }

  function movieById(id) {
    return allMovies().find((m) => m.id === id);
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setStatus(msg) {
    statusText.textContent = msg;
    if (msg) {
      window.clearTimeout(setStatus._t);
      setStatus._t = window.setTimeout(() => {
        statusText.textContent = "";
      }, 2500);
    }
  }

  // ---------- Labels ----------
  Object.entries(labelEls).forEach(([key, el]) => {
    el.textContent = state.labels[key];
    el.addEventListener("blur", () => {
      const val = el.textContent.trim() || state.labels[key];
      el.textContent = val;
      state.labels[key] = val;
      persist();
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      }
    });
  });

  // ---------- Rendering ----------
  function renderPool() {
    const query = searchInput.value.trim().toLowerCase();
    moviePool.innerHTML = "";
    const unplaced = allMovies().filter((m) => !(m.id in state.placements));
    const filtered = unplaced.filter((m) =>
      m.title.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "pool-empty";
      empty.textContent = unplaced.length === 0
        ? "All movies placed on the board."
        : "No matches.";
      moviePool.appendChild(empty);
      return;
    }

    filtered.forEach((movie) => {
      const chip = document.createElement("div");
      chip.className = "pool-chip";
      chip.dataset.id = movie.id;
      chip.dataset.era = movie.era || "";
      chip.innerHTML = `<span class="title">${escapeHtml(movie.title)}</span><span class="yr">${movie.year || ""}</span>`;
      chip.addEventListener("pointerdown", (e) => startChipDrag(e, movie, chip));
      moviePool.appendChild(chip);
    });
  }

  function renderCards() {
    cardsLayer.innerHTML = "";
    Object.entries(state.placements).forEach(([id, pos]) => {
      const movie = movieById(id);
      if (!movie) return;
      const card = buildCard(movie, pos);
      cardsLayer.appendChild(card);
    });
  }

  function buildCard(movie, pos) {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.dataset.id = movie.id;
    card.dataset.era = movie.era || "";
    card.style.left = pos.x + "%";
    card.style.top = pos.y + "%";
    card.innerHTML = `<span class="title">${escapeHtml(movie.title)}${movie.year ? ` (${movie.year})` : ""}</span><span class="remove-x" title="Remove from board">✕</span>`;
    card.addEventListener("pointerdown", (e) => {
      if (e.target.classList.contains("remove-x")) return;
      startCardDrag(e, movie, card);
    });
    card.querySelector(".remove-x").addEventListener("click", () => {
      delete state.placements[movie.id];
      persist();
      renderCards();
      renderPool();
    });
    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Drag: existing card reposition ----------
  function startCardDrag(e, movie, card) {
    e.preventDefault();
    card.setPointerCapture(e.pointerId);
    card.classList.add("dragging");

    function onMove(ev) {
      const rect = board.getBoundingClientRect();
      let x = ((ev.clientX - rect.left) / rect.width) * 100;
      let y = ((ev.clientY - rect.top) / rect.height) * 100;
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));
      card.style.left = x + "%";
      card.style.top = y + "%";
    }

    function onUp(ev) {
      card.classList.remove("dragging");
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerup", onUp);
      const rect = board.getBoundingClientRect();
      const inside =
        ev.clientX >= rect.left &&
        ev.clientX <= rect.right &&
        ev.clientY >= rect.top &&
        ev.clientY <= rect.bottom;
      if (!inside) {
        delete state.placements[movie.id];
        persist();
        renderCards();
        renderPool();
        return;
      }
      let x = ((ev.clientX - rect.left) / rect.width) * 100;
      let y = ((ev.clientY - rect.top) / rect.height) * 100;
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));
      state.placements[movie.id] = { x, y };
      persist();
    }

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
  }

  // ---------- Drag: pool chip -> place on board ----------
  function startChipDrag(e, movie, chip) {
    e.preventDefault();
    const ghost = document.createElement("div");
    ghost.className = "movie-card";
    ghost.dataset.era = movie.era || "";
    ghost.style.position = "fixed";
    ghost.style.zIndex = "999";
    ghost.style.pointerEvents = "none";
    ghost.style.left = e.clientX + "px";
    ghost.style.top = e.clientY + "px";
    ghost.textContent = movie.title;
    document.body.appendChild(ghost);
    chip.classList.add("dragging-source");
    chip.setPointerCapture(e.pointerId);

    function onMove(ev) {
      ghost.style.left = ev.clientX + "px";
      ghost.style.top = ev.clientY + "px";
    }

    function onUp(ev) {
      chip.classList.remove("dragging-source");
      chip.removeEventListener("pointermove", onMove);
      chip.removeEventListener("pointerup", onUp);
      ghost.remove();

      const rect = board.getBoundingClientRect();
      const inside =
        ev.clientX >= rect.left &&
        ev.clientX <= rect.right &&
        ev.clientY >= rect.top &&
        ev.clientY <= rect.bottom;
      if (!inside) return;

      let x = ((ev.clientX - rect.left) / rect.width) * 100;
      let y = ((ev.clientY - rect.top) / rect.height) * 100;
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));
      state.placements[movie.id] = { x, y };
      persist();
      renderCards();
      renderPool();
    }

    chip.addEventListener("pointermove", onMove);
    chip.addEventListener("pointerup", onUp);
  }

  // ---------- Add movie ----------
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = addTitleInput.value.trim();
    if (!title) return;
    const year = addYearInput.value ? parseInt(addYearInput.value, 10) : undefined;
    const id = "custom-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();
    state.customMovies.push({ id, title, year, era: "custom" });
    persist();
    addTitleInput.value = "";
    addYearInput.value = "";
    renderPool();
    setStatus(`Added "${title}"`);
  });

  // ---------- Search ----------
  searchInput.addEventListener("input", renderPool);

  // ---------- Reset ----------
  resetBtn.addEventListener("click", () => {
    if (!confirm("Clear all movie placements from the board? Custom movies you added will stay in the list.")) return;
    state.placements = {};
    persist();
    renderCards();
    renderPool();
    setStatus("Board cleared.");
  });

  // ---------- Export ----------
  exportBtn.addEventListener("click", () => {
    if (typeof window.html2canvas !== "function") {
      alert("Export library didn't load (check your internet connection) — try again in a moment.");
      return;
    }
    const target = document.querySelector(".board-wrap");
    window.html2canvas(target, { backgroundColor: "#0c0d12", scale: 2 }).then((canvas) => {
      const link = document.createElement("a");
      link.download = "marvel-movie-ranking.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  });

  renderPool();
  renderCards();
})();
