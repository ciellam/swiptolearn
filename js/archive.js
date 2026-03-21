/* ============================================
   ARCHIVE — Dismissed/skipped cards view
   ============================================ */

const Archive = (() => {
  const container = document.getElementById('archive-content');

  function render() {
    const archived = Cards.getArchivedCards();
    container.innerHTML = '';

    if (archived.length === 0) {
      container.innerHTML = `
        <div class="library-placeholder">
          <div class="placeholder-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect x="12" y="20" width="40" height="28" rx="4" stroke="currentColor" stroke-width="2.5" opacity="0.3"/>
              <path d="M12 28h40" stroke="currentColor" stroke-width="2" opacity="0.3"/>
              <path d="M26 36h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
            </svg>
          </div>
          <p>No archived cards yet</p>
          <p style="font-size: 0.8rem; opacity: 0.6;">Cards you skip will appear here</p>
        </div>
      `;
      return;
    }

    // Category filter tabs
    const filterBar = document.createElement('div');
    filterBar.className = 'library-filters';

    const allCategories = ['all', ...Cards.categories.map(c => c.id)];
    let activeFilter = 'all';

    allCategories.forEach(catId => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${catId === 'all' ? 'filter-btn--active' : ''}`;
      btn.dataset.filter = catId;

      if (catId === 'all') {
        btn.textContent = `All (${archived.length})`;
      } else {
        const cat = Cards.getCategoryById(catId);
        const count = archived.filter(c => c.category === catId).length;
        if (count === 0) return;
        btn.textContent = `${cat.name} (${count})`;
        btn.style.setProperty('--filter-color', cat.accentGradient[0]);
      }

      btn.addEventListener('click', () => {
        filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
        btn.classList.add('filter-btn--active');
        activeFilter = catId;
        const cards = catId === 'all' ? archived : archived.filter(c => c.category === catId);
        renderArchiveList(cards);
      });

      filterBar.appendChild(btn);
    });

    container.appendChild(filterBar);

    // Content list
    const content = document.createElement('div');
    content.id = 'archive-list';
    content.className = 'library-list';
    container.appendChild(content);

    renderArchiveList(archived);
  }

  function renderArchiveList(cards) {
    const list = document.getElementById('archive-list');
    if (!list) return;
    list.innerHTML = '';

    if (cards.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No cards in this category</p>';
      return;
    }

    cards.forEach(card => {
      const category = Cards.getCategoryById(card.category);
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
        </div>
        <button class="archive-restore-btn" aria-label="Restore to feed">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h8M6 4l-4 4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 3v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      `;

      // Tap card to expand fullscreen
      item.addEventListener('click', (e) => {
        if (e.target.closest('.archive-restore-btn')) return;
        openArchiveCard(card);
      });

      // Restore button
      item.querySelector('.archive-restore-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        Cards.restoreCard(card.id);
        render();
      });

      list.appendChild(item);
    });
  }

  function openArchiveCard(card) {
    const category = Cards.getCategoryById(card.category);
    const gradColors = category ? category.accentGradient : ['#888', '#666'];
    const gradStart = gradColors[0];

    const overlay = document.createElement('div');
    overlay.className = 'archive-fullscreen';

    overlay.innerHTML = `
      <div class="archive-fullscreen-inner">
        <button class="card-close-btn archive-close-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="card-meta" style="padding: var(--space-md) var(--space-lg) 0; padding-right: 56px;">
          <span class="card-category" style="color: ${gradStart}">
            ${category ? category.name : ''}
          </span>
          <span class="card-type">${card.type}</span>
        </div>
        <h3 class="card-detail-title" style="padding: var(--space-sm) var(--space-lg) var(--space-md);">${card.front}</h3>
        <div class="card-answer" style="padding: 0 var(--space-lg);">${card.back}</div>
        <div class="card-tags" style="padding: var(--space-md) var(--space-lg);">
          ${card.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
        </div>
        <div style="padding: var(--space-md) var(--space-lg) var(--space-2xl);">
          <button class="archive-restore-action-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h8M6 4l-4 4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 3v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Restore to feed
          </button>
        </div>
      </div>
    `;

    // Close button
    overlay.querySelector('.archive-close-btn').addEventListener('click', () => {
      closeOverlay(overlay);
    });

    // Restore button
    overlay.querySelector('.archive-restore-action-btn').addEventListener('click', () => {
      Cards.restoreCard(card.id);
      closeOverlay(overlay);
      render();
    });

    // Tap backdrop to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay(overlay);
    });

    document.body.appendChild(overlay);
    document.body.classList.add('card-expanded-active');
    requestAnimationFrame(() => overlay.classList.add('archive-fullscreen--open'));
  }

  function closeOverlay(overlay) {
    document.body.classList.remove('card-expanded-active');
    overlay.classList.remove('archive-fullscreen--open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    setTimeout(() => { if (overlay.parentElement) overlay.remove(); }, 400);
  }

  return { render };
})();
