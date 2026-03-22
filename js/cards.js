/* ============================================
   CARDS — Card rendering, feed logic, spaced repetition
   ============================================ */

const Cards = (() => {
  const STORAGE_KEYS = {
    saved: 'learninghub_saved',
    dismissed: 'learninghub_dismissed',
    notes: 'learninghub_notes',
    lastSeen: 'learninghub_lastSeen',
  };

  const QUEUE_SIZE = 100;
  const MAX_CARDS_BEFORE_PERMANENT_DISMISS = 100;

  // Spaced repetition intervals (in milliseconds)
  const REPEAT_INTERVALS = [
    1 * 24 * 60 * 60 * 1000,   // 1 day
    3 * 24 * 60 * 60 * 1000,   // 3 days
    7 * 24 * 60 * 60 * 1000,   // 7 days
    14 * 24 * 60 * 60 * 1000,  // 14 days
  ];

  let allCards = [];
  let categories = [];
  let queue = [];
  let currentIndex = 0;
  let feedFilter = 'all'; // active feed category filter

  // --- Storage helpers ---
  function getStorage(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || (key === STORAGE_KEYS.notes || key === STORAGE_KEYS.lastSeen ? {} : []);
    } catch {
      return key === STORAGE_KEYS.notes || key === STORAGE_KEYS.lastSeen ? {} : [];
    }
  }

  function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- Data loading ---
  async function loadData() {
    const [cardsRes, catsRes] = await Promise.all([
      fetch('data/cards.json'),
      fetch('data/categories.json'),
    ]);
    allCards = await cardsRes.json();
    categories = await catsRes.json();
    return { allCards, categories };
  }

  function getCategoryById(id) {
    return categories.find(c => c.id === id);
  }

  // --- Queue management ---
  function buildQueue() {
    const saved = getStorage(STORAGE_KEYS.saved);
    const dismissed = getStorage(STORAGE_KEYS.dismissed);
    const lastSeen = getStorage(STORAGE_KEYS.lastSeen);
    const savedIds = saved.map(s => s.id);
    const now = Date.now();

    // Apply category filter
    const filterFn = feedFilter === 'all' ? () => true : c => c.category === feedFilter;

    // Cards due for spaced repetition (saved cards that need review)
    const dueCards = saved.filter(s => {
      const seen = lastSeen[s.id];
      if (!seen) return true;
      const timeSince = now - seen;
      // Find which interval applies based on review count
      const reviewCount = s.reviewCount || 0;
      const interval = REPEAT_INTERVALS[Math.min(reviewCount, REPEAT_INTERVALS.length - 1)];
      return timeSince >= interval;
    }).map(s => allCards.find(c => c.id === s.id)).filter(Boolean).filter(filterFn);

    // Available pool: cards not permanently dismissed
    let pool;
    if (allCards.length > MAX_CARDS_BEFORE_PERMANENT_DISMISS) {
      pool = allCards.filter(c => !dismissed.includes(c.id));
    } else {
      pool = [...allCards];
    }

    // Apply category filter to pool
    pool = pool.filter(filterFn);

    // Remove cards currently saved (they come back via spaced repetition)
    const unseen = pool.filter(c => !savedIds.includes(c.id));

    // Build queue: due cards first, then unseen, then recycle
    queue = [];

    // Add due spaced repetition cards
    shuffle(dueCards);
    queue.push(...dueCards);

    // Fill remaining with unseen cards
    shuffle(unseen);
    queue.push(...unseen);

    // If still not enough, recycle older cards
    if (queue.length < QUEUE_SIZE) {
      const recycled = pool.filter(c => !queue.find(q => q.id === c.id));
      shuffle(recycled);
      queue.push(...recycled);
    }

    // Trim to queue size
    queue = queue.slice(0, QUEUE_SIZE);
    currentIndex = 0;
  }

  function setFeedFilter(categoryId) {
    feedFilter = categoryId;
    buildQueue();
  }

  function getFeedFilter() {
    return feedFilter;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getCurrentCard() {
    return queue[currentIndex] || null;
  }

  function getNextCard() {
    return queue[currentIndex + 1] || null;
  }

  function getCardAfterNext() {
    return queue[currentIndex + 2] || null;
  }

  function advanceQueue() {
    currentIndex++;
    if (currentIndex >= queue.length) {
      buildQueue();
    }
  }

  function undoAdvance(card) {
    if (currentIndex > 0) {
      currentIndex--;
      // Ensure the card is back at current position
      queue[currentIndex] = card;
    }
  }

  // --- Card actions ---
  function saveCard(cardId) {
    const saved = getStorage(STORAGE_KEYS.saved);
    const existing = saved.find(s => s.id === cardId);
    if (!existing) {
      saved.push({ id: cardId, savedAt: Date.now(), reviewCount: 0 });
      setStorage(STORAGE_KEYS.saved, saved);
    }
    // Update last seen
    const lastSeen = getStorage(STORAGE_KEYS.lastSeen);
    lastSeen[cardId] = Date.now();
    setStorage(STORAGE_KEYS.lastSeen, lastSeen);
  }

  function dismissCard(cardId) {
    if (allCards.length > MAX_CARDS_BEFORE_PERMANENT_DISMISS) {
      const dismissed = getStorage(STORAGE_KEYS.dismissed);
      if (!dismissed.includes(cardId)) {
        dismissed.push(cardId);
        setStorage(STORAGE_KEYS.dismissed, dismissed);
      }
    }
    // Update last seen regardless
    const lastSeen = getStorage(STORAGE_KEYS.lastSeen);
    lastSeen[cardId] = Date.now();
    setStorage(STORAGE_KEYS.lastSeen, lastSeen);
  }

  function getSavedCards() {
    const saved = getStorage(STORAGE_KEYS.saved);
    return saved.map(s => {
      const card = allCards.find(c => c.id === s.id);
      if (card) return { ...card, savedAt: s.savedAt, reviewCount: s.reviewCount };
      return null;
    }).filter(Boolean);
  }

  function removeFromLibrary(cardId) {
    let saved = getStorage(STORAGE_KEYS.saved);
    saved = saved.filter(s => s.id !== cardId);
    setStorage(STORAGE_KEYS.saved, saved);
  }

  function getArchivedCards() {
    const dismissed = getStorage(STORAGE_KEYS.dismissed);
    return dismissed.map(id => allCards.find(c => c.id === id)).filter(Boolean);
  }

  function restoreCard(cardId) {
    let dismissed = getStorage(STORAGE_KEYS.dismissed);
    dismissed = dismissed.filter(id => id !== cardId);
    setStorage(STORAGE_KEYS.dismissed, dismissed);
  }

  function getNote(cardId) {
    const notes = getStorage(STORAGE_KEYS.notes);
    return notes[cardId] || '';
  }

  function setNote(cardId, note) {
    const notes = getStorage(STORAGE_KEYS.notes);
    if (note.trim()) {
      notes[cardId] = note;
    } else {
      delete notes[cardId];
    }
    setStorage(STORAGE_KEYS.notes, notes);
  }

  // --- Card rendering ---
  function renderCard(card, options = {}) {
    if (!card) return null;

    const category = getCategoryById(card.category);
    const note = getNote(card.id);
    const { isFlipped = false, isStack = false, isStack2 = false } = options;

    const el = document.createElement('div');
    const stackClass = isStack2 ? 'card--stack-2' : isStack ? 'card--stack' : '';
    el.className = `card ${stackClass} ${isFlipped ? 'card--flipped' : ''}`;
    el.dataset.cardId = card.id;

    const gradColors = category ? category.accentGradient : ['#888', '#777', '#666'];
    const [gradStart, gradMid, gradEnd] = gradColors.length >= 3
      ? gradColors
      : [gradColors[0], blendColors(gradColors[0], gradColors[1], 0.5), gradColors[1]];
    const multiGrad = `linear-gradient(135deg, ${gradStart} 0%, ${gradMid} 45%, ${gradEnd} 100%)`;
    const iconSvg = getCategoryIconSvg(card.category);

    el.innerHTML = `
      <div class="card-inner">
        <div class="card-front">
          <div class="card-accent" style="background: ${multiGrad}"></div>
          <div class="card-meta">
            <span class="card-category" style="color: ${gradStart}">
              <span class="card-category-icon">${iconSvg}</span>
              ${category ? category.name : ''}
            </span>
            <span class="card-type">${card.type}</span>
          </div>
          <h3 class="card-title">${card.front}</h3>
          <div class="card-tap-hint">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M5 10l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Tap to flip
          </div>
        </div>
        <div class="card-back">
          <div class="card-accent card-accent--back" style="background: ${multiGrad}"></div>
          <button class="card-expand-btn" aria-label="Expand card">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 11v4h4M15 7V3h-4M3 7V3h4M15 11v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="card-close-btn" aria-label="Close fullscreen">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="card-meta">
            <span class="card-category" style="color: ${gradStart}">
              <span class="card-category-icon">${iconSvg}</span>
              ${category ? category.name : ''}
            </span>
            <span class="card-type">${card.type}</span>
          </div>
          <div class="card-answer">${card.back}</div>
          <div class="card-tags">
            ${card.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
          </div>
          <div class="card-note-inline">
            <textarea class="card-note-textarea" placeholder="Add a note..." data-card-id="${card.id}">${escapeHtml(note)}</textarea>
          </div>
        </div>
      </div>
    `;

    // Tap to flip
    if (!isStack) {
      el.addEventListener('click', (e) => {
        if (el.dataset.dragging === 'true') return;
        if (e.target.closest('.card-note-textarea')) return;
        if (e.target.closest('.card-close-btn')) return;
        if (e.target.closest('.card-expand-btn')) return;
        if (e.target.closest('.selection-toolbar')) return;
        if (el.classList.contains('card--expanded')) return;
        // Don't flip if user has selected text
        const sel = window.getSelection();
        if (sel && sel.toString().trim().length > 0) return;

        el.classList.toggle('card--flipped');
      });

      // Expand button (visible on flipped card, not when expanded)
      const expandBtn = el.querySelector('.card-expand-btn');
      if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          el.classList.add('card--expanded');
          document.body.classList.add('card-expanded-active');
          Swipe.destroy();
        });
      }

      // Close button (only visible when expanded)
      const closeBtn = el.querySelector('.card-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          el.classList.remove('card--expanded');
          document.body.classList.remove('card-expanded-active');
          Swipe.init(el, el._swipeCallbacks);
        });
      }

      // Save note on blur
      const textarea = el.querySelector('.card-note-textarea');
      if (textarea) {
        textarea.addEventListener('blur', () => {
          setNote(textarea.dataset.cardId, textarea.value);
        });
        // Prevent swipe when typing
        textarea.addEventListener('touchstart', (e) => e.stopPropagation());
        textarea.addEventListener('mousedown', (e) => e.stopPropagation());
      }
    }

    return el;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Inline SVG icons per category (so they inherit color)
  function getCategoryIconSvg(categoryId) {
    const icons = {
      'ux-product': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M15 9l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 17h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      'interview': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3C7.03 3 3 6.58 3 11c0 2.48 1.38 4.68 3.5 6.12V21l3.12-1.71C10.38 19.43 11.17 19.5 12 19.5c4.97 0 9-3.58 9-8S16.97 3 12 3z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="11" r="1" fill="currentColor"/><circle cx="12" cy="11" r="1" fill="currentColor"/><circle cx="15.5" cy="11" r="1" fill="currentColor"/></svg>',
      'articulation': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      'vibe-coding': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 8l-4 4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 8l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4l-4 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      'english': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h10M4 17h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 14l2.5 7M20.5 21L23 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      'motivation': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" opacity="0.8"/></svg>',
    };
    return icons[categoryId] || '';
  }

  // Blend two hex colors for multi-stop gradient
  function blendColors(hex1, hex2, ratio) {
    const parse = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [r1,g1,b1] = parse(hex1);
    const [r2,g2,b2] = parse(hex2);
    const r = Math.round(r1 + (r2-r1)*ratio);
    const g = Math.round(g1 + (g2-g1)*ratio);
    const b = Math.round(b1 + (b2-b1)*ratio);
    return `#${[r,g,b].map(c => c.toString(16).padStart(2,'0')).join('')}`;
  }

  // --- Selection toolbar (highlight → Copy / Ask Claude) ---
  let selToolbar = null;

  function getOrCreateToolbar() {
    if (selToolbar) return selToolbar;
    const tb = document.createElement('div');
    tb.className = 'selection-toolbar';
    tb.innerHTML = `
      <button class="selection-toolbar-btn" data-action="copy">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2"/>
        </svg>
        Copy
      </button>
      <button class="selection-toolbar-btn" data-action="claude">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Ask Claude
      </button>
    `;
    tb.addEventListener('mousedown', e => e.preventDefault());
    tb.addEventListener('touchstart', e => e.stopPropagation());

    tb.querySelector('[data-action="copy"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const text = window.getSelection().toString().trim();
      if (!text) return;
      navigator.clipboard.writeText(text);
      const btn = tb.querySelector('[data-action="copy"]');
      btn.classList.add('selection-toolbar-btn--copied');
      btn.querySelector('svg').nextSibling.textContent = ' Copied!';
      setTimeout(() => {
        btn.classList.remove('selection-toolbar-btn--copied');
        btn.querySelector('svg').nextSibling.textContent = ' Copy';
      }, 1500);
    });

    tb.querySelector('[data-action="claude"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const text = window.getSelection().toString().trim();
      if (!text) return;
      navigator.clipboard.writeText(`Explain this from my flashcard: "${text}"`);
      window.open('https://claude.ai/new', '_blank');
      hideToolbar();
    });

    document.body.appendChild(tb);
    selToolbar = tb;
    return tb;
  }

  function showToolbar(rect) {
    const tb = getOrCreateToolbar();
    tb.classList.add('selection-toolbar--visible');
    // Position below the selection, centered
    const tbWidth = 200;
    let left = rect.left + rect.width / 2 - tbWidth / 2;
    let top = rect.bottom + 8;
    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tbWidth - 8));
    if (top + 50 > window.innerHeight) {
      top = rect.top - 50;
    }
    tb.style.left = `${left}px`;
    tb.style.top = `${top}px`;
  }

  function hideToolbar() {
    if (selToolbar) {
      selToolbar.classList.remove('selection-toolbar--visible');
    }
  }

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.toString().trim().length === 0) {
      hideToolbar();
      return;
    }
    // Check if selection is inside a .card-answer
    const anchor = sel.anchorNode;
    const answerEl = anchor && (anchor.nodeType === 3 ? anchor.parentElement : anchor).closest('.card-answer');
    if (!answerEl) {
      hideToolbar();
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    showToolbar(rect);
  });

  // Hide toolbar when tapping outside
  document.addEventListener('mousedown', (e) => {
    if (selToolbar && !selToolbar.contains(e.target)) {
      setTimeout(hideToolbar, 50);
    }
  });
  document.addEventListener('touchstart', (e) => {
    if (selToolbar && !selToolbar.contains(e.target)) {
      setTimeout(hideToolbar, 50);
    }
  });

  return {
    loadData,
    buildQueue,
    getCurrentCard,
    getNextCard,
    getCardAfterNext,
    advanceQueue,
    undoAdvance,
    saveCard,
    dismissCard,
    getSavedCards,
    removeFromLibrary,
    getArchivedCards,
    restoreCard,
    getNote,
    setNote,
    renderCard,
    getCategoryById,
    setFeedFilter,
    getFeedFilter,
    get categories() { return categories; },
    get allCards() { return allCards; },
  };
})();
