(function () {
  "use strict";

  const STORAGE_KEY = "marvel-ranker-state-v2";

  const tierBoard = document.getElementById("tier-board");
  const moviePool = document.getElementById("movie-pool");
  const searchInput = document.getElementById("search-input");
  const addForm = document.getElementById("add-movie-form");
  const addTitleInput = document.getElementById("add-movie-title");
  const addYearInput = document.getElementById("add-movie-year");
  const resetBtn = document.getElementById("reset-btn");
  const exportBtn = document.getElementById("export-btn");
  const statusText = document.getElementById("status-text");

  const DEFAULT_TIERS = [
    { id: "top", label: "Top" },
    { id: "mid-upper", label: "Middle" },
    { id: "mid-lower", label: "Middle" },
    { id: "bottom", label: "Bottom" },
  ];

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
    tiers: (saved && saved.tiers) || DEFAULT_TIERS.map((t) => ({ ...t })),
    tierMovies: (saved && saved.tierMovies) || Object.fromEntries(DEFAULT_TIERS.map((t) => [t.id, []])),
    customMovies: (saved && saved.customMovies) || [],
  };

  // Make sure every tier defined in state.tiers has a movies array.
  state.tiers.forEach((t) => {
    if (!state.tierMovies[t.id]) state.tierMovies[t.id] = [];
  });

  function allMovies() {
    return MARVEL_MOVIES.concat(state.customMovies);
  }

  function movieById(id) {
    return allMovies().find((m) => m.id === id);
  }

  function placedIds() {
    return new Set(Object.values(state.tierMovies).flat());
  }

  function findPlacement(id) {
    for (const tier of state.tiers) {
      const idx = state.tierMovies[tier.id].indexOf(id);
      if (idx !== -1) return { tierId: tier.id, index: idx };
    }
    return null;
  }

  function removeFromTiers(id) {
    for (const tierId in state.tierMovies) {
      const arr = state.tierMovies[tierId];
      const idx = arr.indexOf(id);
      if (idx !== -1) arr.splice(idx, 1);
    }
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

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Rendering ----------
  function renderPool() {
    const query = searchInput.value.trim().toLowerCase();
    moviePool.innerHTML = "";
    const placed = placedIds();
    const unplaced = allMovies().filter((m) => !placed.has(m.id));
    const filtered = unplaced.filter((m) => m.title.toLowerCase().includes(query));

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "pool-empty";
      empty.textContent = unplaced.length === 0 ? "All movies placed in a tier." : "No matches.";
      moviePool.appendChild(empty);
      return;
    }

    filtered.forEach((movie) => {
      const chip = document.createElement("div");
      chip.className = "pool-chip";
      chip.dataset.id = movie.id;
      chip.dataset.era = movie.era || "";
      chip.innerHTML = `<span class="title">${escapeHtml(movie.title)}</span><span class="yr">${movie.year || ""}</span>`;
      chip.addEventListener("pointerdown", (e) => startDrag(e, movie, null));
      moviePool.appendChild(chip);
    });
  }

  function renderBoard() {
    tierBoard.innerHTML = "";
    state.tiers.forEach((tier, i) => {
      const row = document.createElement("div");
      row.className = "tier-row";
      row.dataset.tier = tier.id;
      row.dataset.tierIndex = String(i);

      const label = document.createElement("div");
      label.className = "tier-label";
      label.contentEditable = "true";
      label.spellcheck = false;
      label.textContent = tier.label;
      label.addEventListener("blur", () => {
        const val = label.textContent.trim() || tier.label;
        label.textContent = val;
        tier.label = val;
        persist();
      });
      label.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          label.blur();
        }
      });
      row.appendChild(label);

      const cardsContainer = document.createElement("div");
      cardsContainer.className = "tier-cards";
      cardsContainer.dataset.tier = tier.id;
      state.tierMovies[tier.id].forEach((id) => {
        const movie = movieById(id);
        if (!movie) return;
        cardsContainer.appendChild(buildCard(movie));
      });
      row.appendChild(cardsContainer);

      tierBoard.appendChild(row);
    });
  }

  function buildCard(movie) {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.dataset.id = movie.id;
    card.dataset.era = movie.era || "";
    card.innerHTML = `<span class="title">${escapeHtml(movie.title)}${movie.year ? ` (${movie.year})` : ""}</span><span class="remove-x" title="Remove from board">✕</span>`;
    card.addEventListener("pointerdown", (e) => {
      if (e.target.classList.contains("remove-x")) return;
      startDrag(e, movie, card);
    });
    card.querySelector(".remove-x").addEventListener("click", () => {
      removeFromTiers(movie.id);
      persist();
      renderBoard();
      renderPool();
    });
    return card;
  }

  // ---------- Drag & drop (pointer events; works for pool chips and placed cards) ----------
  function getAllTierRows() {
    return Array.from(tierBoard.querySelectorAll(".tier-row"));
  }

  function computeDropTarget(clientX, clientY) {
    const rows = getAllTierRows();
    let row = null;
    for (const r of rows) {
      const rect = r.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        row = r;
        break;
      }
    }
    if (!row) return null;
    const tierId = row.dataset.tier;
    const cardsContainer = row.querySelector(".tier-cards");
    const cards = Array.from(cardsContainer.querySelectorAll(".movie-card"));
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (clientX < mid) {
        index = i;
        break;
      }
    }
    return { tierId, index };
  }

  function clearDragOverStyles() {
    getAllTierRows().forEach((r) => r.classList.remove("drag-over"));
  }

  function startDrag(e, movie, sourceCardEl) {
    e.preventDefault();
    const origin = sourceCardEl || e.currentTarget;
    origin.setPointerCapture(e.pointerId);

    // Hide the original element (pool chip or placed card) while dragging so
    // it doesn't interfere with drop-target detection, and show a floating
    // clone that follows the pointer.
    const originalDisplay = origin.style.display;
    origin.style.display = "none";

    const ghost = document.createElement("div");
    ghost.className = "movie-card drag-ghost";
    ghost.dataset.era = movie.era || "";
    ghost.textContent = movie.title;
    ghost.style.left = e.clientX + "px";
    ghost.style.top = e.clientY + "px";
    document.body.appendChild(ghost);

    function onMove(ev) {
      ghost.style.left = ev.clientX + "px";
      ghost.style.top = ev.clientY + "px";
      clearDragOverStyles();
      const target = computeDropTarget(ev.clientX, ev.clientY);
      if (target) {
        const row = tierBoard.querySelector(`.tier-row[data-tier="${cssEscape(target.tierId)}"]`);
        if (row) row.classList.add("drag-over");
      }
    }

    function onUp(ev) {
      origin.removeEventListener("pointermove", onMove);
      origin.removeEventListener("pointerup", onUp);
      ghost.remove();
      clearDragOverStyles();
      origin.style.display = originalDisplay;

      const target = computeDropTarget(ev.clientX, ev.clientY);
      removeFromTiers(movie.id);

      if (target) {
        state.tierMovies[target.tierId].splice(target.index, 0, movie.id);
      }
      // If there's no target, the movie ends up back in the pool (already
      // removed from all tiers above).

      persist();
      renderBoard();
      renderPool();
    }

    origin.addEventListener("pointermove", onMove);
    origin.addEventListener("pointerup", onUp);
  }

  function cssEscape(str) {
    return String(str).replace(/["\\]/g, "\\$&");
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
    state.tiers.forEach((t) => {
      state.tierMovies[t.id] = [];
    });
    persist();
    renderBoard();
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
  renderBoard();
})();
