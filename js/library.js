/* ============================================
   LIBRARY — Saved cards view logic
   ============================================ */

const Library = (() => {
  const container = document.getElementById('library-content');
  let currentMode = 'list'; // 'list' or 'cards'
  let filteredCards = [];
  let cardViewIndex = 0;

  function renderProgressRings(saved) {
    const row = document.createElement('div');
    row.className = 'progress-rings';

    const totalSaved = saved.length;
    const totalCards = Cards.allCards.length;

    Cards.categories.forEach(cat => {
      const catTotal = Cards.allCards.filter(c => c.category === cat.id).length;
      if (catTotal === 0) return;
      const catSaved = saved.filter(c => c.category === cat.id).length;
      const pct = catTotal > 0 ? catSaved / catTotal : 0;

      const ring = document.createElement('div');
      ring.className = 'progress-ring-item';

      const r = 22;
      const circumference = 2 * Math.PI * r;
      const offset = circumference * (1 - pct);
      const color = cat.accentGradient[0];

      ring.innerHTML = `
        <svg class="progress-ring-svg" width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>
          <circle cx="28" cy="28" r="${r}" fill="none" stroke="${color}" stroke-width="4"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 28 28)"
            style="transition: stroke-dashoffset 0.6s ease"/>
        </svg>
        <span class="progress-ring-count">${catSaved}</span>
        <span class="progress-ring-label">${cat.name}</span>
      `;
      row.appendChild(ring);
    });

    // Total summary
    const summary = document.createElement('div');
    summary.className = 'progress-summary';
    summary.textContent = `${totalSaved} of ${totalCards} cards saved`;

    const wrapper = document.createElement('div');
    wrapper.className = 'progress-section';
    wrapper.appendChild(row);
    wrapper.appendChild(summary);
    return wrapper;
  }

  function render() {
    const saved = Cards.getSavedCards();
    container.innerHTML = '';

    // Always show progress rings
    container.appendChild(renderProgressRings(saved));

    if (saved.length === 0) {
      container.innerHTML = `
        <div class="library-placeholder">
          <div class="placeholder-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <path d="M16 12h8l4 4h20a4 4 0 014 4v28a4 4 0 01-4 4H16a4 4 0 01-4-4V16a4 4 0 014-4z" stroke="currentColor" stroke-width="2.5" opacity="0.3"/>
              <path d="M24 34h16M24 40h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
            </svg>
          </div>
          <p>No saved cards yet</p>
          <p style="font-size: 0.8rem; opacity: 0.6;">Swipe right on cards in the feed to save them here</p>
        </div>
      `;
      return;
    }

    // Top bar: view toggle + filter
    const topBar = document.createElement('div');
    topBar.className = 'library-top-bar';

    // View mode toggle
    const toggle = document.createElement('div');
    toggle.className = 'view-toggle';
    toggle.innerHTML = `
      <button class="view-toggle-btn ${currentMode === 'list' ? 'view-toggle-btn--active' : ''}" data-mode="list" aria-label="List view">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 4h12M3 9h12M3 14h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="view-toggle-btn ${currentMode === 'cards' ? 'view-toggle-btn--active' : ''}" data-mode="cards" aria-label="Card view">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="2" width="14" height="10" rx="2.5" stroke="currentColor" stroke-width="1.8"/>
          <rect x="4" y="14" width="10" height="2" rx="1" fill="currentColor" opacity="0.3"/>
        </svg>
      </button>
    `;
    toggle.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentMode = btn.dataset.mode;
        render();
      });
    });
    topBar.appendChild(toggle);
    container.appendChild(topBar);

    // Category filter tabs
    const filterBar = document.createElement('div');
    filterBar.className = 'library-filters';

    const allCategories = ['all', ...Cards.categories.map(c => c.id)];
    allCategories.forEach(catId => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${catId === 'all' ? 'filter-btn--active' : ''}`;
      btn.dataset.filter = catId;

      if (catId === 'all') {
        btn.textContent = `All (${saved.length})`;
      } else {
        const cat = Cards.getCategoryById(catId);
        const count = saved.filter(c => c.category === catId).length;
        if (count === 0) return;
        btn.textContent = `${cat.name} (${count})`;
        btn.style.setProperty('--filter-color', cat.accentGradient[0]);
      }

      btn.addEventListener('click', () => {
        filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
        btn.classList.add('filter-btn--active');
        const cards = catId === 'all' ? saved : saved.filter(c => c.category === catId);
        filteredCards = cards;
        cardViewIndex = 0;
        if (currentMode === 'list') {
          renderListCards(cards);
        } else {
          renderCardSwipeView(cards);
        }
      });

      filterBar.appendChild(btn);
    });

    container.appendChild(filterBar);

    // Content area
    const content = document.createElement('div');
    content.id = 'library-list';
    content.className = currentMode === 'list' ? 'library-list' : 'library-card-view';
    container.appendChild(content);

    filteredCards = saved;
    cardViewIndex = 0;

    if (currentMode === 'list') {
      renderListCards(saved);
    } else {
      renderCardSwipeView(saved);
    }
  }

  // --- LIST VIEW ---
  function renderListCards(cards) {
    const list = document.getElementById('library-list');
    if (!list) return;
    list.className = 'library-list';
    list.innerHTML = '';

    cards.forEach(card => {
      const category = Cards.getCategoryById(card.category);
      const note = Cards.getNote(card.id);
      const gradColors = category ? category.accentGradient : ['#888', '#666'];
      const gradStart = gradColors[0];

      const item = document.createElement('div');
      item.className = 'library-card';
      item.dataset.cardId = card.id;

      item.innerHTML = `
        <div class="library-card-accent" style="background: linear-gradient(180deg, ${gradColors.join(', ')})"></div>
        <div class="library-card-body">
          <div class="library-card-meta">
            <span class="card-category" style="color: ${gradStart}">
              ${category ? category.name : ''}
            </span>
            <span class="card-type">${card.type}</span>
          </div>
          <h4 class="library-card-title">${card.front}</h4>
          ${note ? `<p class="library-card-note">${escapeHtml(note)}</p>` : ''}
        </div>
        <button class="library-card-expand" aria-label="View card">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 4l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      `;

      item.addEventListener('click', () => openCardDetail(card));
      list.appendChild(item);
    });
  }

  // --- SWIPEABLE CARD VIEW ---
  function renderCardSwipeView(cards) {
    const area = document.getElementById('library-list');
    if (!area) return;
    area.className = 'library-card-view';
    area.innerHTML = '';

    if (cards.length === 0) {
      area.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No cards in this category</p>';
      return;
    }

    // Card stack
    const stack = document.createElement('div');
    stack.className = 'card-stack library-card-stack';
    stack.innerHTML = `
      <div class="swipe-indicator swipe-indicator--save">Keep</div>
      <div class="swipe-indicator swipe-indicator--dismiss">Remove</div>
    `;
    area.appendChild(stack);

    // Counter
    const counter = document.createElement('div');
    counter.className = 'card-counter';
    counter.id = 'library-card-counter';
    area.appendChild(counter);

    renderLibraryCard(cards);
  }

  function renderLibraryCard(cards) {
    const stack = document.querySelector('.library-card-stack');
    if (!stack) return;

    // Remove old cards
    stack.querySelectorAll('.card').forEach(c => c.remove());

    if (cardViewIndex >= cards.length) {
      stack.innerHTML = '<div class="feed-empty"><p>You\'ve reviewed all saved cards!</p></div>';
      updateLibraryCounter(cards);
      return;
    }

    const current = cards[cardViewIndex];
    const next = cards[cardViewIndex + 1];

    // Stack card behind
    if (next) {
      const nextEl = Cards.renderCard(next, { isStack: true });
      stack.appendChild(nextEl);
    }

    // Current card on top
    const currentEl = Cards.renderCard(current);
    stack.appendChild(currentEl);

    // Swipe: right = keep, left = remove from library
    Swipe.destroy();
    Swipe.init(currentEl, {
      onRight: () => {
        // Keep — just advance
        cardViewIndex++;
        renderLibraryCard(cards);
        updateLibraryCounter(cards);
      },
      onLeft: () => {
        // Remove from library
        Cards.removeFromLibrary(current.id);
        // Update filtered list
        const idx = cards.indexOf(current);
        if (idx > -1) cards.splice(idx, 1);
        // Don't advance index since array shifted
        renderLibraryCard(cards);
        updateLibraryCounter(cards);
      },
    });

    updateLibraryCounter(cards);
  }

  function updateLibraryCounter(cards) {
    const counter = document.getElementById('library-card-counter');
    if (!counter) return;
    const remaining = cards.length - cardViewIndex;
    counter.textContent = `${Math.max(remaining, 0)} of ${cards.length} saved cards`;
  }

  // --- CARD DETAIL MODAL ---
  function openCardDetail(card) {
    const category = Cards.getCategoryById(card.category);
    const note = Cards.getNote(card.id);
    const gradColors = category ? category.accentGradient : ['#888', '#666'];
    const gradStart = gradColors[0];

    const modal = document.createElement('div');
    modal.className = 'card-detail-modal';

    modal.innerHTML = `
      <div class="card-detail">
        <div class="card-detail-header">
          <button class="card-detail-close" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="card-detail-actions">
            <button class="card-detail-action card-detail-remove" aria-label="Remove from library">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 6h14M7 6V4a1 1 0 011-1h4a1 1 0 011 1v2m2 0v10a2 2 0 01-2 2H7a2 2 0 01-2-2V6h10z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="card-detail-body">
          <div class="card-accent card-accent--back" style="background: linear-gradient(135deg, ${gradColors.join(', ')})"></div>
          <div class="card-meta">
            <span class="card-category" style="color: ${gradStart}">
              ${category ? category.name : ''}
            </span>
            <span class="card-type">${card.type}</span>
          </div>
          <h3 class="card-detail-title">${card.front}</h3>
          <div class="card-detail-divider"></div>
          <div class="card-detail-answer">${card.back}</div>
          <div class="card-tags">
            ${card.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
          </div>
          <div class="card-detail-note-section">
            <label class="card-detail-note-label" for="card-note-input">Your notes</label>
            <textarea
              id="card-note-input"
              class="card-detail-note-input"
              placeholder="Add a note..."
              rows="3"
            >${escapeHtml(note)}</textarea>
          </div>
        </div>
      </div>
    `;

    modal.querySelector('.card-detail-close').addEventListener('click', () => {
      const noteInput = modal.querySelector('#card-note-input');
      Cards.setNote(card.id, noteInput.value);
      closeModal(modal);
    });

    modal.querySelector('.card-detail-remove').addEventListener('click', () => {
      Cards.removeFromLibrary(card.id);
      closeModal(modal);
      render();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const noteInput = modal.querySelector('#card-note-input');
        Cards.setNote(card.id, noteInput.value);
        closeModal(modal);
      }
    });

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('card-detail-modal--open'));
  }

  function closeModal(modal) {
    modal.classList.remove('card-detail-modal--open');
    modal.addEventListener('transitionend', () => modal.remove(), { once: true });
    setTimeout(() => { if (modal.parentElement) modal.remove(); }, 400);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { render };
})();
