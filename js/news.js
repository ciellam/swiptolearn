/* ============================================
   NEWS — AI news feed view
   ============================================ */

const News = (() => {
  const container = document.getElementById('news-content');
  let newsData = [];

  async function loadNews() {
    try {
      const res = await fetch('data/news.json');
      newsData = await res.json();
    } catch {
      newsData = [];
    }
  }

  function render() {
    if (!container) return;
    container.innerHTML = '';

    if (newsData.length === 0) {
      container.innerHTML = `
        <div class="library-placeholder">
          <div class="placeholder-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="2.5" opacity="0.3"/>
              <path d="M24 26h16M24 32h12M24 38h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
              <circle cx="44" cy="20" r="8" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
              <path d="M42 18l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
            </svg>
          </div>
          <p>No AI news yet</p>
          <p style="font-size: 0.8rem; opacity: 0.6;">News updates arrive every week</p>
        </div>
      `;
      return;
    }

    // Group by date
    const grouped = {};
    newsData.forEach(item => {
      const d = item.date || 'Unknown';
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(item);
    });

    const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    dates.forEach(dateStr => {
      const section = document.createElement('div');
      section.className = 'news-date-section';

      const label = document.createElement('div');
      label.className = 'news-date-label';
      label.textContent = formatDate(dateStr);
      section.appendChild(label);

      grouped[dateStr].forEach(item => {
        const card = document.createElement('a');
        card.className = 'news-card';
        card.href = item.url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        card.innerHTML = `
          <div class="news-card-body">
            <div class="news-card-source">${escapeHtml(item.source || '')}</div>
            <h4 class="news-card-title">${escapeHtml(item.title)}</h4>
            <p class="news-card-summary">${escapeHtml(item.summary)}</p>
            <div class="news-card-tags">
              ${(item.tags || []).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
          <div class="news-card-arrow">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        `;

        section.appendChild(card);
      });

      container.appendChild(section);
    });
  }

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      const now = new Date();
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Yesterday';
      if (diff < 7) return `${diff} days ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { loadNews, render };
})();
