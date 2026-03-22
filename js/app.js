/* ============================================
   APP — Initialization, Routing, Navigation
   ============================================ */

const App = (() => {
  const views = {
    feed: document.getElementById('feed-view'),
    library: document.getElementById('library-view'),
    archive: document.getElementById('archive-view'),
  };
  const nav = document.getElementById('bottom-nav');
  const navTabs = document.querySelectorAll('.nav-tab');

  let currentView = null;
  let feedInitialized = false;

  async function start() {
    // Show bottom nav
    nav.hidden = false;
    document.body.classList.remove('locked');

    // Load card data
    await Cards.loadData();
    Cards.buildQueue();

    // Listen for hash changes
    window.addEventListener('hashchange', onHashChange);

    // Navigate to current hash or default
    const hash = window.location.hash.slice(1);
    navigateTo(hash === 'library' ? 'library' : 'feed');
  }

  function onHashChange() {
    const hash = window.location.hash.slice(1);
    if (views[hash]) {
      navigateTo(hash);
    }
  }

  function navigateTo(viewName) {
    if (currentView === viewName) return;

    // Hide all views
    Object.entries(views).forEach(([name, el]) => {
      if (name === viewName) {
        el.hidden = false;
        el.classList.add('view-enter');
        el.addEventListener('animationend', () => {
          el.classList.remove('view-enter');
        }, { once: true });
      } else {
        el.hidden = true;
        el.classList.remove('view-enter');
      }
    });

    // Update nav active state
    navTabs.forEach(tab => {
      const isActive = tab.dataset.view === viewName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    // Update hash
    if (window.location.hash !== `#${viewName}`) {
      history.replaceState(null, '', `#${viewName}`);
    }

    currentView = viewName;

    // Initialize views on first visit
    if (viewName === 'feed' && !feedInitialized) {
      initFeed();
      feedInitialized = true;
    }

    if (viewName === 'library') {
      Library.render();
    }

    if (viewName === 'archive') {
      Archive.render();
    }
  }

  // --- Feed ---
  let lastSwipedCard = null;
  let lastSwipeAction = null; // 'save' or 'dismiss'

  function initFeed() {
    const feedContent = document.getElementById('feed-content');
    feedContent.innerHTML = '';

    // Category filter bar
    const filterBar = document.createElement('div');
    filterBar.className = 'feed-filters';
    filterBar.id = 'feed-filters';

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn filter-btn--active';
    allBtn.dataset.filter = 'all';
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', () => applyFeedFilter('all'));
    filterBar.appendChild(allBtn);

    Cards.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.filter = cat.id;
      btn.textContent = cat.name;
      btn.style.setProperty('--filter-color', cat.accentGradient[0]);
      btn.addEventListener('click', () => applyFeedFilter(cat.id));
      filterBar.appendChild(btn);
    });

    feedContent.appendChild(filterBar);

    // Create card stack container
    const stack = document.createElement('div');
    stack.className = 'card-stack';
    stack.innerHTML = `
      <div class="swipe-indicator swipe-indicator--save">Save</div>
      <div class="swipe-indicator swipe-indicator--dismiss">Skip</div>
    `;
    feedContent.appendChild(stack);

    // Undo button (hidden by default)
    const undoBtn = document.createElement('button');
    undoBtn.className = 'undo-btn';
    undoBtn.id = 'undo-btn';
    undoBtn.hidden = true;
    undoBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 8l-3 3 3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M1 11h10a5 5 0 000-10H8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Undo
    `;
    undoBtn.addEventListener('click', handleUndo);
    feedContent.appendChild(undoBtn);

    renderCurrentCards();
  }

  function renderCurrentCards() {
    const stack = document.querySelector('.card-stack');
    if (!stack) return;

    // Remove old cards (keep indicators)
    stack.querySelectorAll('.card').forEach(c => c.remove());
    stack.querySelectorAll('.feed-empty').forEach(c => c.remove());

    const current = Cards.getCurrentCard();
    const next = Cards.getNextCard();
    const afterNext = Cards.getCardAfterNext();

    if (!current) {
      const empty = document.createElement('div');
      empty.className = 'feed-empty';
      empty.innerHTML = '<p>You\'ve seen all the cards!</p><p>Come back later for more.</p>';
      stack.appendChild(empty);
      return;
    }

    // Render third card (deepest in stack)
    if (afterNext) {
      const afterNextEl = Cards.renderCard(afterNext, { isStack2: true });
      stack.appendChild(afterNextEl);
    }

    // Render next card behind (stack effect)
    if (next) {
      const nextEl = Cards.renderCard(next, { isStack: true });
      stack.appendChild(nextEl);
    }

    // Render current card on top
    const currentEl = Cards.renderCard(current);
    stack.appendChild(currentEl);

    // Init swipe on current card
    const swipeCallbacks = {
      onRight: () => {
        lastSwipedCard = current;
        lastSwipeAction = 'save';
        Cards.saveCard(current.id);
        Cards.advanceQueue();
        renderCurrentCards();
        showUndo();
      },
      onLeft: () => {
        lastSwipedCard = current;
        lastSwipeAction = 'dismiss';
        Cards.dismissCard(current.id);
        Cards.advanceQueue();
        renderCurrentCards();
        showUndo();
      },
    };
    // Store callbacks so expand/collapse can re-init swipe
    currentEl._swipeCallbacks = swipeCallbacks;
    Swipe.destroy();
    Swipe.init(currentEl, swipeCallbacks);
  }

  function showUndo() {
    const btn = document.getElementById('undo-btn');
    if (!btn) return;
    btn.hidden = false;
    btn.classList.remove('undo-btn--fade');
    // Auto-hide after 4 seconds
    clearTimeout(btn._timeout);
    btn._timeout = setTimeout(() => {
      btn.classList.add('undo-btn--fade');
      setTimeout(() => { btn.hidden = true; }, 300);
    }, 4000);
  }

  function handleUndo() {
    if (!lastSwipedCard) return;
    const btn = document.getElementById('undo-btn');

    if (lastSwipeAction === 'save') {
      Cards.removeFromLibrary(lastSwipedCard.id);
    }
    // Undo dismiss is automatic since under 200 cards they stay in pool

    // Go back one in queue
    Cards.undoAdvance(lastSwipedCard);
    lastSwipedCard = null;
    lastSwipeAction = null;

    if (btn) {
      btn.hidden = true;
      clearTimeout(btn._timeout);
    }

    renderCurrentCards();
  }

  function applyFeedFilter(categoryId) {
    const filterBar = document.getElementById('feed-filters');
    if (filterBar) {
      filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
      const active = filterBar.querySelector(`[data-filter="${categoryId}"]`);
      if (active) active.classList.add('filter-btn--active');
    }
    Cards.setFeedFilter(categoryId);
    renderCurrentCards();
  }

  // Nav tab click handling
  navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const viewName = tab.dataset.view;
      window.location.hash = viewName;
    });
  });

  return { start, navigateTo, renderCurrentCards };
})();

// Lock body scroll while on lock screen
document.body.classList.add('locked');
