(function () {
  "use strict";

  const STORAGE_KEY = "marvel-ranker-state-v3";
  const TAP_MOVE_THRESHOLD = 8; // px — pointer movement below this counts as a tap, not a drag

  const tierBoard = document.getElementById("tier-board");
  const progressSummary = document.getElementById("progress-summary");
  const moviePool = document.getElementById("movie-pool");
  const poolPanel = document.getElementById("pool-panel");
  const searchInput = document.getElementById("search-input");
  const resetBtn = document.getElementById("reset-btn");
  const exportBtn = document.getElementById("export-btn");
  const statusText = document.getElementById("status-text");
  const selectionBar = document.getElementById("selection-bar");
  const selectionText = document.getElementById("selection-text");
  const selectionCancelBtn = document.getElementById("selection-cancel");

  const DEFAULT_TIERS = [
    { id: "top", label: "Top Quartile" },
    { id: "second", label: "Second Quartile" },
    { id: "third", label: "Third Quartile" },
    { id: "bottom", label: "Bottom Quartile" },
  ];

  // Forced-distribution capacities: split the fixed movie population into
  // four equal-as-possible groups. Any remainder is given to the earlier
  // (higher) quartiles first.
  const TOTAL_MOVIES = MARVEL_MOVIES.length;
  const BASE_SIZE = Math.floor(TOTAL_MOVIES / DEFAULT_TIERS.length);
  const REMAINDER = TOTAL_MOVIES % DEFAULT_TIERS.length;
  const CAPACITIES = DEFAULT_TIERS.map((_, i) => BASE_SIZE + (i < REMAINDER ? 1 : 0));
  const CAPACITY_BY_ID = Object.fromEntries(DEFAULT_TIERS.map((t, i) => [t.id, CAPACITIES[i]]));

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
  };

  // Guard against a stale save (e.g. movie list changed): drop any movie
  // ids that no longer exist, and make sure every current tier has an array.
  state.tiers.forEach((t) => {
    if (!state.tierMovies[t.id]) state.tierMovies[t.id] = [];
  });
  Object.keys(state.tierMovies).forEach((tierId) => {
    state.tierMovies[tierId] = state.tierMovies[tierId].filter((id) => movieById(id));
  });

  // Tap-to-place selection. This is a fully separate interaction path from
  // drag-and-drop: pick a movie with a tap, then tap a destination. It's the
  // primary way to place movies on a touchscreen, where a page taller than
  // the viewport makes a press-and-drag across the fold impractical (there's
  // no auto-scroll). Mouse users can still drag as before.
  let selectedId = null;

  function movieById(id) {
    return MARVEL_MOVIES.find((m) => m.id === id);
  }

  function findTierOf(id) {
    for (const tier of state.tiers) {
      if (state.tierMovies[tier.id].includes(id)) return tier.id;
    }
    return null;
  }

  function placedIds() {
    return new Set(Object.values(state.tierMovies).flat());
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

  // ---------- Tap-to-place selection ----------
  function toggleSelect(movieId) {
    selectedId = selectedId === movieId ? null : movieId;
    renderPool();
    renderBoard();
    updateSelectionBar();
  }

  function clearSelection() {
    if (!selectedId) return;
    selectedId = null;
    renderPool();
    renderBoard();
    updateSelectionBar();
  }

  function updateSelectionBar() {
    if (!selectedId) {
      selectionBar.hidden = true;
      return;
    }
    const movie = movieById(selectedId);
    selectionBar.hidden = false;
    selectionText.textContent = movie ? `Placing "${movie.title}" — tap a quartile (or the pool to send it back)` : "";
  }

  function attemptPlace(movieId, targetTierId) {
    const originTier = findTierOf(movieId);
    if (originTier === targetTierId) {
      clearSelection();
      return;
    }
    if (state.tierMovies[targetTierId].length >= CAPACITY_BY_ID[targetTierId]) {
      const tier = state.tiers.find((t) => t.id === targetTierId);
      setStatus(`${tier.label} is full (${CAPACITY_BY_ID[targetTierId]}/${CAPACITY_BY_ID[targetTierId]}) — remove one first.`);
      return; // keep the selection active so the user can try another tier
    }
    removeFromTiers(movieId);
    state.tierMovies[targetTierId].push(movieId);
    selectedId = null;
    persist();
    renderPool();
    renderBoard();
    updateSelectionBar();
  }

  function sendSelectedToPool() {
    if (!selectedId) return;
    const wasPlaced = findTierOf(selectedId) !== null;
    removeFromTiers(selectedId);
    selectedId = null;
    if (wasPlaced) persist();
    renderPool();
    renderBoard();
    updateSelectionBar();
  }

  // ---------- Rendering ----------
  function renderPool() {
    const query = searchInput.value.trim().toLowerCase();
    moviePool.innerHTML = "";
    const placed = placedIds();
    const unplaced = MARVEL_MOVIES.filter((m) => !placed.has(m.id));
    const filtered = unplaced.filter((m) => m.title.toLowerCase().includes(query));

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "pool-empty";
      empty.textContent = unplaced.length === 0 ? `All ${TOTAL_MOVIES} movies ranked!` : "No matches.";
      moviePool.appendChild(empty);
      return;
    }

    let lastPhase = null;
    filtered.forEach((movie) => {
      if (movie.phase !== lastPhase) {
        lastPhase = movie.phase;
        const header = document.createElement("div");
        header.className = "phase-header";
        header.dataset.phase = String(movie.phase);
        header.textContent = PHASE_LABELS[movie.phase] || `Phase ${movie.phase}`;
        moviePool.appendChild(header);
      }
      const chip = document.createElement("div");
      chip.className = "pool-chip";
      if (movie.id === selectedId) chip.classList.add("selected");
      chip.dataset.id = movie.id;
      chip.dataset.phase = String(movie.phase);
      chip.innerHTML = `<span class="title">${escapeHtml(movie.title)}</span><span class="yr">${movie.year || ""}</span>`;
      chip.addEventListener("pointerdown", (e) => startDrag(e, movie, chip));
      moviePool.appendChild(chip);
    });
  }

  function renderProgress() {
    const placed = placedIds().size;
    const parts = state.tiers
      .map((t) => `${escapeHtml(t.label)} ${state.tierMovies[t.id].length}/${CAPACITY_BY_ID[t.id]}`)
      .join(" &middot; ");
    progressSummary.innerHTML = `Ranked ${placed} / ${TOTAL_MOVIES} &mdash; ${parts}`;
  }

  function renderBoard() {
    tierBoard.innerHTML = "";
    state.tiers.forEach((tier, i) => {
      const capacity = CAPACITY_BY_ID[tier.id];
      const row = document.createElement("div");
      row.className = "tier-row";
      if (selectedId) row.classList.add("placeable");
      row.dataset.tier = tier.id;
      row.dataset.tierIndex = String(i);
      row.addEventListener("click", (e) => {
        if (!selectedId) return;
        // A tap on a card (including its remove-x) is handled by the card's
        // own pointer logic; don't also let the bubbled click re-trigger
        // placement here (that would immediately re-place/clear whatever was
        // just selected by that same tap).
        if (e.target.closest(".movie-card")) return;
        attemptPlace(selectedId, tier.id);
      });

      const labelWrap = document.createElement("div");
      labelWrap.className = "tier-label-wrap";

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
        renderProgress();
      });
      label.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          label.blur();
        }
      });
      labelWrap.appendChild(label);

      const cap = document.createElement("div");
      cap.className = "tier-capacity";
      cap.textContent = `${state.tierMovies[tier.id].length} / ${capacity}`;
      labelWrap.appendChild(cap);

      row.appendChild(labelWrap);

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
    renderProgress();
  }

  function buildCard(movie) {
    const card = document.createElement("div");
    card.className = "movie-card";
    if (movie.id === selectedId) card.classList.add("selected");
    card.dataset.id = movie.id;
    card.dataset.phase = String(movie.phase);
    card.innerHTML = `<span class="title">${escapeHtml(movie.title)}${movie.year ? ` (${movie.year})` : ""}</span><span class="remove-x" title="Send back to pool">✕</span>`;
    card.addEventListener("pointerdown", (e) => {
      if (e.target.classList.contains("remove-x")) return;
      startDrag(e, movie, card);
    });
    card.querySelector(".remove-x").addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromTiers(movie.id);
      if (selectedId === movie.id) selectedId = null;
      persist();
      renderBoard();
      renderPool();
      updateSelectionBar();
    });
    return card;
  }

  // ---------- Drag & drop (pointer events; works for pool chips and placed cards) ----------
  function getAllTierRows() {
    return Array.from(tierBoard.querySelectorAll(".tier-row"));
  }

  function computeDropTarget(clientX, clientY, excludeEl) {
    const rows = getAllTierRows();
    let row = null;
    for (const r of rows) {
      const rect = r.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        row = r;
        break;
      }
    }
    if (!row) return null;
    const tierId = row.dataset.tier;
    const cardsContainer = row.querySelector(".tier-cards");
    const cards = Array.from(cardsContainer.querySelectorAll(".movie-card")).filter((c) => c !== excludeEl);
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
    getAllTierRows().forEach((r) => r.classList.remove("drag-over", "drag-over-full"));
  }

  function startDrag(e, movie, origin) {
    e.preventDefault();
    origin.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let ghost = null;

    function tierIsFull(tierId) {
      return state.tierMovies[tierId].length >= CAPACITY_BY_ID[tierId];
    }

    function beginDragVisuals() {
      dragging = true;
      origin.style.visibility = "hidden";
      ghost = document.createElement("div");
      ghost.className = "movie-card drag-ghost";
      ghost.dataset.phase = String(movie.phase);
      ghost.textContent = movie.title;
      ghost.style.left = e.clientX + "px";
      ghost.style.top = e.clientY + "px";
      document.body.appendChild(ghost);
    }

    function onMove(ev) {
      if (!dragging) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.hypot(dx, dy) < TAP_MOVE_THRESHOLD) return;
        beginDragVisuals();
      }
      ghost.style.left = ev.clientX + "px";
      ghost.style.top = ev.clientY + "px";
      clearDragOverStyles();
      const target = computeDropTarget(ev.clientX, ev.clientY, origin);
      if (target) {
        const row = tierBoard.querySelector(`.tier-row[data-tier="${cssEscape(target.tierId)}"]`);
        if (row) row.classList.add(tierIsFull(target.tierId) ? "drag-over-full" : "drag-over");
      }
    }

    function onUp(ev) {
      origin.removeEventListener("pointermove", onMove);
      origin.removeEventListener("pointerup", onUp);

      if (!dragging) {
        // No meaningful movement: treat this as a tap/select instead of a drop.
        toggleSelect(movie.id);
        return;
      }

      ghost.remove();
      clearDragOverStyles();
      origin.style.visibility = "";

      const target = computeDropTarget(ev.clientX, ev.clientY, origin);

      if (target && tierIsFull(target.tierId)) {
        const tier = state.tiers.find((t) => t.id === target.tierId);
        setStatus(`${tier.label} is full (${CAPACITY_BY_ID[target.tierId]}/${CAPACITY_BY_ID[target.tierId]}) — remove one first.`);
        renderBoard();
        renderPool();
        return;
      }

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

  // ---------- Selection bar ----------
  selectionCancelBtn.addEventListener("click", clearSelection);

  // Tapping empty pool space places a selected tier-card back in the pool
  // (or just cancels the selection if it was already unplaced).
  poolPanel.addEventListener("click", (e) => {
    if (!selectedId) return;
    if (e.target.closest(".pool-chip") || e.target.closest("input") || e.target.closest("button")) return;
    sendSelectedToPool();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearSelection();
  });

  // ---------- Search ----------
  searchInput.addEventListener("input", renderPool);

  // ---------- Reset ----------
  resetBtn.addEventListener("click", () => {
    if (!confirm("Clear all movie placements from the board?")) return;
    state.tiers.forEach((t) => {
      state.tierMovies[t.id] = [];
    });
    selectedId = null;
    persist();
    renderBoard();
    renderPool();
    updateSelectionBar();
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
