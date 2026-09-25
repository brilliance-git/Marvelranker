(function () {
  "use strict";

  const STORAGE_KEY = "marvel-ranker-state-v3";
  const TAP_MOVE_THRESHOLD = 8; // px — pointer movement below this counts as a tap, not a drag
  const SWIPE_THRESHOLD = 70; // px horizontal drag on the ranker card to trigger prev/next
  const FLY_MS = 200;

  const tierBoard = document.getElementById("tier-board");
  const progressSummary = document.getElementById("progress-summary");
  const searchInput = document.getElementById("search-input");
  const resetBtn = document.getElementById("reset-btn");
  const exportBtn = document.getElementById("export-btn");
  const statusText = document.getElementById("status-text");

  const rankerStatus = document.getElementById("ranker-status");
  const rankerCancelBtn = document.getElementById("ranker-cancel");
  const rankerPrevBtn = document.getElementById("ranker-prev");
  const rankerNextBtn = document.getElementById("ranker-next");
  const rankerCard = document.getElementById("ranker-card");
  const rankerCardPhase = document.getElementById("ranker-card-phase");
  const rankerCardTitle = document.getElementById("ranker-card-title");
  const rankerCardYear = document.getElementById("ranker-card-year");
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

  // `selectedId` is set only by tapping an already-placed card on the board
  // below — it means "reassign this movie" and the ranker card/buttons act
  // on it instead of the browse queue. `rankerIndex` is the browse-queue
  // position used the rest of the time (the normal, primary flow: swipe or
  // tap arrows through unplaced movies, tap a quartile button to place).
  let selectedId = null;
  let rankerIndex = 0;

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

  function getUnplacedFiltered() {
    const query = searchInput.value.trim().toLowerCase();
    const placed = placedIds();
    return MARVEL_MOVIES.filter((m) => !placed.has(m.id) && m.title.toLowerCase().includes(query));
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

  // ---------- Selection (tap a placed card to reassign it) ----------
  function toggleSelect(movieId) {
    selectedId = selectedId === movieId ? null : movieId;
    renderBoard();
    renderRanker();
  }

  function clearSelection() {
    if (!selectedId) return;
    selectedId = null;
    renderBoard();
    renderRanker();
  }

  rankerCancelBtn.addEventListener("click", clearSelection);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearSelection();
    if (!selectedId) {
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    }
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
    renderBoard();
    renderRanker();
  }

  // ---------- Ranker (the big swipeable card + quartile buttons) ----------
  function navigate(direction) {
    if (selectedId) return;
    const queue = getUnplacedFiltered();
    const newIndex = rankerIndex + direction;
    if (newIndex < 0 || newIndex >= queue.length) return;
    flyCard(direction > 0 ? "left" : "right", () => {
      rankerIndex = newIndex;
      renderRanker();
    });
  }

  rankerPrevBtn.addEventListener("click", () => navigate(-1));
  rankerNextBtn.addEventListener("click", () => navigate(1));

  // Animate the card exiting toward `exitSide`, run `mutate` (which changes
  // what the card should show next), then slide the new content in from the
  // opposite side.
  function flyCard(exitSide, mutate) {
    const exitX = exitSide === "left" ? -420 : 420;
    rankerCard.style.transition = "transform 0.2s ease, opacity 0.2s ease";
    rankerCard.style.transform = `translateX(${exitX}px) rotate(${exitX / 28}deg)`;
    rankerCard.style.opacity = "0";
    window.setTimeout(() => {
      mutate();
      const enterX = exitSide === "left" ? 420 : -420;
      rankerCard.classList.add("no-transition");
      rankerCard.style.transform = `translateX(${enterX}px)`;
      rankerCard.style.opacity = "0";
      void rankerCard.offsetWidth; // force reflow so the next change animates
      rankerCard.classList.remove("no-transition");
      rankerCard.style.transition = "transform 0.2s ease, opacity 0.2s ease";
      rankerCard.style.transform = "translateX(0)";
      rankerCard.style.opacity = "1";
    }, FLY_MS);
  }

  // Placing a movie flies it up and away, distinct from left/right browsing.
  function placeCurrentMovie(tierId) {
    if (selectedId) {
      attemptPlace(selectedId, tierId);
      return;
    }
    const queue = getUnplacedFiltered();
    const movie = queue[rankerIndex];
    if (!movie) return;
    if (state.tierMovies[tierId].length >= CAPACITY_BY_ID[tierId]) return; // button should be disabled already

    rankerCard.style.transition = "transform 0.2s ease, opacity 0.2s ease";
    rankerCard.style.transform = "translateY(-36px) scale(0.92)";
    rankerCard.style.opacity = "0";
    window.setTimeout(() => {
      state.tierMovies[tierId].push(movie.id);
      persist();
      renderBoard();
      // rankerIndex is left unchanged: the placed movie drops out of the
      // queue, so whatever follows it shifts up to this same index.
      renderRanker();
      rankerCard.classList.add("no-transition");
      rankerCard.style.transform = "translateY(24px) scale(0.96)";
      rankerCard.style.opacity = "0";
      void rankerCard.offsetWidth;
      rankerCard.classList.remove("no-transition");
      rankerCard.style.transition = "transform 0.2s ease, opacity 0.2s ease";
      rankerCard.style.transform = "translateY(0) scale(1)";
      rankerCard.style.opacity = "1";
    }, FLY_MS);
  }

  function renderRanker() {
    const queue = getUnplacedFiltered();
    const reassigning = !!selectedId;
    let movie = null;

    if (reassigning) {
      movie = movieById(selectedId);
    } else if (queue.length > 0) {
      if (rankerIndex >= queue.length) rankerIndex = queue.length - 1;
      if (rankerIndex < 0) rankerIndex = 0;
      movie = queue[rankerIndex];
    }

    rankerCancelBtn.hidden = !reassigning;
    rankerPrevBtn.disabled = reassigning || rankerIndex <= 0;
    rankerNextBtn.disabled = reassigning || !queue.length || rankerIndex >= queue.length - 1;
    rankerCard.classList.toggle("reassigning", reassigning);

    if (reassigning) {
      const currentTier = movie ? state.tiers.find((t) => t.id === findTierOf(movie.id)) : null;
      rankerStatus.textContent = movie ? `Reassigning "${movie.title}"${currentTier ? ` — currently in ${currentTier.label}` : ""}` : "";
    } else if (queue.length > 0) {
      rankerStatus.textContent = `${rankerIndex + 1} of ${queue.length} unranked`;
    } else if (placedIds().size >= TOTAL_MOVIES) {
      rankerStatus.textContent = `All ${TOTAL_MOVIES} movies ranked!`;
    } else {
      rankerStatus.textContent = "No matches for that search.";
    }

    if (movie) {
      rankerCardPhase.textContent = PHASE_LABELS[movie.phase] || "";
      rankerCardTitle.textContent = movie.title;
      rankerCardYear.textContent = movie.year || "";
      rankerCard.dataset.phase = String(movie.phase);
    } else {
      rankerCardPhase.textContent = "";
      rankerCardTitle.textContent = placedIds().size >= TOTAL_MOVIES ? "🎉 All ranked" : "No matches";
      rankerCardYear.textContent = "";
      rankerCard.dataset.phase = "";
    }

    renderQuartileButtons(movie, reassigning);
  }

  function renderQuartileButtons(movie, reassigning) {
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
      btn.addEventListener("click", () => placeCurrentMovie(tier.id));
      quartileButtonsEl.appendChild(btn);
    });
    // Reassigning uses the same buttons; nothing extra to wire up here.
    void reassigning;
  }

  // ---------- Ranker card swipe gesture ----------
  let dragStartX = 0;
  let dragStartY = 0;
  let dragCurrentX = 0;
  let dragAxis = null; // 'x' | 'y' | null while a gesture is in progress

  rankerCard.addEventListener("pointerdown", (e) => {
    if (selectedId) return; // no swipe nav while reassigning a placed card
    if (getUnplacedFiltered().length === 0) return;
    dragAxis = "pending";
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragCurrentX = 0;
    rankerCard.setPointerCapture(e.pointerId);
  });

  rankerCard.addEventListener("pointermove", (e) => {
    if (dragAxis === null) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (dragAxis === "pending") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      dragAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (dragAxis === "x") rankerCard.classList.add("no-transition");
    }
    if (dragAxis !== "x") return; // vertical gesture: let the page scroll
    e.preventDefault();
    dragCurrentX = dx;
    rankerCard.style.transform = `translateX(${dx}px) rotate(${dx / 28}deg)`;
  });

  function endCardDrag(ev) {
    if (dragAxis === "x") {
      rankerCard.classList.remove("no-transition");
      const dx = dragCurrentX;
      const queue = getUnplacedFiltered();
      if (dx <= -SWIPE_THRESHOLD && rankerIndex < queue.length - 1) {
        navigate(1);
      } else if (dx >= SWIPE_THRESHOLD && rankerIndex > 0) {
        navigate(-1);
      } else {
        rankerCard.style.transition = "transform 0.2s ease";
        rankerCard.style.transform = "translateX(0) rotate(0)";
      }
    }
    dragAxis = null;
    dragCurrentX = 0;
  }

  rankerCard.addEventListener("pointerup", endCardDrag);
  rankerCard.addEventListener("pointercancel", endCardDrag);

  // ---------- Board rendering ----------
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
        renderRanker();
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
      renderRanker();
    });
    return card;
  }

  // ---------- Drag & drop on the board (mouse-friendly reordering/removal) ----------
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
        renderRanker();
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
      renderRanker();
    }

    origin.addEventListener("pointermove", onMove);
    origin.addEventListener("pointerup", onUp);
  }

  function cssEscape(str) {
    return String(str).replace(/["\\]/g, "\\$&");
  }

  // ---------- Search ----------
  searchInput.addEventListener("input", () => {
    rankerIndex = 0;
    renderRanker();
  });

  // ---------- Reset ----------
  resetBtn.addEventListener("click", () => {
    if (!confirm("Clear all movie placements from the board?")) return;
    state.tiers.forEach((t) => {
      state.tierMovies[t.id] = [];
    });
    selectedId = null;
    rankerIndex = 0;
    persist();
    renderBoard();
    renderRanker();
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

  renderBoard();
  renderRanker();
})();
