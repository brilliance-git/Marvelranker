(function () {
  "use strict";

  const STORAGE_KEY = "marvel-ranker-state-v3";
  const TAP_MOVE_THRESHOLD = 8; // px — pointer movement below this counts as a tap, not a drag

  const tierBoard = document.getElementById("tier-board");
  const progressSummary = document.getElementById("progress-summary");
  const moviePool = document.getElementById("movie-pool");
  const searchInput = document.getElementById("search-input");
  const resetBtn = document.getElementById("reset-btn");
  const exportBtn = document.getElementById("export-btn");
  const statusText = document.getElementById("status-text");
  const selectionStatus = document.getElementById("selection-status");
  const selectionCancelBtn = document.getElementById("selection-cancel");
  const quartileButtonsEl = document.getElementById("quartile-buttons");

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

  // `selectedId` is the movie a tap picked out — either from the pool list
  // (not yet placed) or from a quartile list (already placed, being moved).
  // The quartile buttons in the sticky control panel always act on it.
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

  // ---------- Selection (tap a pool chip or a placed row to act on it) ----------
  function toggleSelect(movieId) {
    selectedId = selectedId === movieId ? null : movieId;
    renderPool();
    renderBoard();
    renderControlPanel();
  }

  function clearSelection() {
    if (!selectedId) return;
    selectedId = null;
    renderPool();
    renderBoard();
    renderControlPanel();
  }

  selectionCancelBtn.addEventListener("click", clearSelection);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearSelection();
  });

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
    renderControlPanel();
  }

  // ---------- Sticky control panel (search, selection status, quartile buttons) ----------
  function renderControlPanel() {
    const movie = selectedId ? movieById(selectedId) : null;
    selectionCancelBtn.hidden = !selectedId;

    if (!movie) {
      selectionStatus.textContent = "Tap a movie below to place or move it.";
    } else {
      const currentTier = state.tiers.find((t) => t.id === findTierOf(movie.id));
      selectionStatus.textContent = currentTier
        ? `Reassigning "${movie.title}" — currently in ${currentTier.label}`
        : `Placing "${movie.title}" — tap a quartile`;
    }

    quartileButtonsEl.innerHTML = "";
    const originTier = movie ? findTierOf(movie.id) : null;
    state.tiers.forEach((tier, i) => {
      const count = state.tierMovies[tier.id].length;
      const capacity = CAPACITY_BY_ID[tier.id];
      const full = count >= capacity;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quartile-btn";
      btn.dataset.tierIndex = String(i);
      btn.disabled = !movie || (full && tier.id !== originTier);
      btn.innerHTML = `<span class="qb-label">${escapeHtml(tier.label)}</span><span class="qb-count">${count}/${capacity}</span>`;
      btn.addEventListener("click", () => {
        if (!selectedId) return;
        attemptPlace(selectedId, tier.id);
      });
      quartileButtonsEl.appendChild(btn);
    });
  }

  // ---------- Pool (clickable/draggable list of unplaced movies) ----------
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

  // ---------- Board (each quartile is a vertical, ordered, drag-sortable list) ----------
  function renderProgress() {
    const placed = placedIds().size;
    const parts = state.tiers
      .map((t) => `${escapeHtml(t.label)} ${state.tierMovies[t.id].length}/${CAPACITY_BY_ID[t.id]}`)
      .join(" &middot; ");
    progressSummary.innerHTML = `Ranked ${placed} / ${TOTAL_MOVIES} &mdash; ${parts}`;
  }

  function renderBoard() {
    // FLIP animation: whenever the board re-renders (a drag-drop lands, a
    // tap+quartile-button placement, a reassignment, a removal), any row
    // that's still on the board but changed position slides there instead
    // of just snapping into its new spot.
    const firstRects = new Map();
    tierBoard.querySelectorAll(".rank-row").forEach((el) => {
      if (el.dataset.id) firstRects.set(el.dataset.id, el.getBoundingClientRect());
    });

    tierBoard.innerHTML = "";
    state.tiers.forEach((tier, i) => {
      const capacity = CAPACITY_BY_ID[tier.id];
      const column = document.createElement("div");
      column.className = "tier-column";
      if (selectedId) column.classList.add("placeable");
      column.dataset.tier = tier.id;
      column.dataset.tierIndex = String(i);

      const header = document.createElement("div");
      header.className = "tier-header";

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
        renderControlPanel();
      });
      label.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          label.blur();
        }
      });
      header.appendChild(label);

      const cap = document.createElement("div");
      cap.className = "tier-capacity";
      cap.textContent = `${state.tierMovies[tier.id].length} / ${capacity}`;
      header.appendChild(cap);

      column.appendChild(header);

      const list = document.createElement("div");
      list.className = "tier-list";
      list.dataset.tier = tier.id;
      list.addEventListener("click", (e) => {
        if (!selectedId) return;
        if (e.target.closest(".rank-row")) return; // handled by the row's own tap logic
        attemptPlace(selectedId, tier.id);
      });
      state.tierMovies[tier.id].forEach((id, idx) => {
        const movie = movieById(id);
        if (!movie) return;
        list.appendChild(buildRow(movie, idx + 1));
      });
      column.appendChild(list);

      tierBoard.appendChild(column);
    });
    renderProgress();

    tierBoard.querySelectorAll(".rank-row").forEach((el) => {
      const first = firstRects.get(el.dataset.id);
      if (!first) return; // newly placed row — nothing to animate from
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (!dx && !dy) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 200ms ease";
        el.style.transform = "";
      });
    });
  }

  function buildRow(movie, rank) {
    const row = document.createElement("div");
    row.className = "rank-row";
    if (movie.id === selectedId) row.classList.add("selected");
    row.dataset.id = movie.id;
    row.dataset.phase = String(movie.phase);
    row.innerHTML = `<span class="rank-num">${rank}</span><span class="title">${escapeHtml(movie.title)}${movie.year ? ` (${movie.year})` : ""}</span><span class="remove-x" title="Send back to pool">✕</span>`;
    row.addEventListener("pointerdown", (e) => {
      if (e.target.classList.contains("remove-x")) return;
      startDrag(e, movie, row);
    });
    row.querySelector(".remove-x").addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromTiers(movie.id);
      if (selectedId === movie.id) selectedId = null;
      persist();
      renderBoard();
      renderPool();
      renderControlPanel();
    });
    return row;
  }

  // ---------- Drag & drop (pointer events; works for pool chips and placed rows) ----------
  function getAllTierLists() {
    return Array.from(tierBoard.querySelectorAll(".tier-list"));
  }

  function computeDropTarget(clientX, clientY, excludeEls) {
    const lists = getAllTierLists();
    let list = null;
    for (const l of lists) {
      const rect = l.parentElement.getBoundingClientRect(); // the whole column, incl. header
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        list = l;
        break;
      }
    }
    if (!list) return null;
    const tierId = list.dataset.tier;
    const rows = Array.from(list.querySelectorAll(".rank-row")).filter((r) => !excludeEls.includes(r));
    let index = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) {
        index = i;
        break;
      }
    }
    return { tierId, index };
  }

  function clearDragOverStyles() {
    tierBoard.querySelectorAll(".tier-column").forEach((c) => c.classList.remove("drag-over", "drag-over-full"));
  }

  const AUTO_SCROLL_EDGE = 70; // px from the top/bottom of the viewport that triggers auto-scroll
  const AUTO_SCROLL_MAX_SPEED = 16; // px per animation frame at the very edge

  function startDrag(e, movie, origin) {
    e.preventDefault();
    origin.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let ghost = null;
    let placeholder = null;
    let lastTargetKey = null;
    let lastX = e.clientX;
    let lastY = e.clientY;
    let autoScrollFrame = null;

    function tierIsFull(tierId) {
      return state.tierMovies[tierId].length >= CAPACITY_BY_ID[tierId];
    }

    function beginDragVisuals(atX, atY) {
      dragging = true;
      const width = origin.getBoundingClientRect().width;
      // Take the original out of the flex flow entirely (not just invisible)
      // so its list immediately closes up around where it was, instead of
      // leaving a blank hole there for the whole drag. It stays in the DOM,
      // just out of flow, so pointer capture on it is unaffected.
      origin.style.visibility = "hidden";
      origin.style.position = "absolute";
      ghost = document.createElement("div");
      ghost.className = "rank-row drag-ghost";
      ghost.dataset.phase = String(movie.phase);
      ghost.innerHTML = `<span class="title">${escapeHtml(movie.title)}</span>`;
      ghost.style.width = width + "px";
      ghost.style.left = atX + "px";
      ghost.style.top = atY + "px";
      document.body.appendChild(ghost);
      placeholder = document.createElement("div");
      placeholder.className = "rank-row drop-placeholder";
      autoScrollFrame = requestAnimationFrame(autoScrollTick);
    }

    // A quartile can hold up to 10 movies — taller than a phone's viewport
    // once a list fills up — so dragging near the top/bottom edge of the
    // screen scrolls the page, the same way most sortable-list UIs do.
    function autoScrollTick() {
      autoScrollFrame = requestAnimationFrame(autoScrollTick);
      if (!dragging) return;
      let speed = 0;
      if (lastY < AUTO_SCROLL_EDGE) {
        speed = -AUTO_SCROLL_MAX_SPEED * (1 - lastY / AUTO_SCROLL_EDGE);
      } else if (lastY > window.innerHeight - AUTO_SCROLL_EDGE) {
        speed = AUTO_SCROLL_MAX_SPEED * (1 - (window.innerHeight - lastY) / AUTO_SCROLL_EDGE);
      }
      if (speed === 0) return;
      const before = window.scrollY;
      window.scrollBy(0, speed);
      if (window.scrollY !== before) updateDragHighlight(lastX, lastY);
    }

    function updateDragHighlight(x, y) {
      clearDragOverStyles();
      const target = computeDropTarget(x, y, [origin, placeholder]);
      if (target) {
        const column = tierBoard.querySelector(`.tier-column[data-tier="${cssEscape(target.tierId)}"]`);
        if (column) column.classList.add(tierIsFull(target.tierId) ? "drag-over-full" : "drag-over");
      }
      movePlaceholder(target);
    }

    // Live-reorder preview: as the pointer crosses into a new slot, move the
    // placeholder there and let the other rows in that list slide out of the
    // way (a FLIP animation — measure before, move, measure after, animate
    // the delta) instead of only snapping into place once you let go.
    function movePlaceholder(target) {
      const key = target ? `${target.tierId}:${target.index}` : null;
      if (key === lastTargetKey) return;
      lastTargetKey = key;

      if (!target) {
        if (placeholder.parentNode) placeholder.remove();
        return;
      }

      const list = tierBoard.querySelector(`.tier-list[data-tier="${cssEscape(target.tierId)}"]`);
      if (!list) return;

      const siblings = Array.from(list.children).filter((r) => r !== placeholder && r !== origin);
      const firstRects = new Map(siblings.map((r) => [r, r.getBoundingClientRect()]));

      if (target.index >= siblings.length) {
        list.appendChild(placeholder);
      } else {
        list.insertBefore(placeholder, siblings[target.index]);
      }

      siblings.forEach((row) => {
        const first = firstRects.get(row);
        const last = row.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (!dx && !dy) return;
        row.style.transition = "none";
        row.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          row.style.transition = "transform 150ms ease";
          row.style.transform = "";
        });
      });
    }

    function onMove(ev) {
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!dragging) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.hypot(dx, dy) < TAP_MOVE_THRESHOLD) return;
        beginDragVisuals(ev.clientX, ev.clientY);
      }
      ghost.style.left = ev.clientX + "px";
      ghost.style.top = ev.clientY + "px";
      updateDragHighlight(ev.clientX, ev.clientY);
    }

    function onUp(ev) {
      origin.removeEventListener("pointermove", onMove);
      origin.removeEventListener("pointerup", onUp);
      origin.removeEventListener("pointercancel", onCancel);

      if (!dragging) {
        // No meaningful movement: treat this as a tap/select instead of a drop.
        toggleSelect(movie.id);
        return;
      }

      cancelAnimationFrame(autoScrollFrame);
      ghost.remove();
      if (placeholder.parentNode) placeholder.remove();
      clearDragOverStyles();
      origin.style.visibility = "";
      origin.style.position = "";

      const target = computeDropTarget(ev.clientX, ev.clientY, [origin, placeholder]);

      if (target && tierIsFull(target.tierId) && findTierOf(movie.id) !== target.tierId) {
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
      renderControlPanel();
    }

    function onCancel() {
      origin.removeEventListener("pointermove", onMove);
      origin.removeEventListener("pointerup", onUp);
      origin.removeEventListener("pointercancel", onCancel);
      if (dragging) {
        cancelAnimationFrame(autoScrollFrame);
        if (ghost) ghost.remove();
        if (placeholder && placeholder.parentNode) placeholder.remove();
        clearDragOverStyles();
        origin.style.visibility = "";
        origin.style.position = "";
      }
    }

    origin.addEventListener("pointermove", onMove);
    origin.addEventListener("pointerup", onUp);
    origin.addEventListener("pointercancel", onCancel);
  }

  function cssEscape(str) {
    return String(str).replace(/["\\]/g, "\\$&");
  }

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
    renderControlPanel();
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
  renderControlPanel();
})();
