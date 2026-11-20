/**
 * BCE ESPORTS — TOURNAMENTS LIST PAGE
 */
(function () {
  'use strict';

  const MAIN = window.MAIN;
  if (!MAIN) { console.error('main.js not loaded'); return; }

  const { fetchJSON, escapeHTML } = MAIN;

  /* ============ AUDIO TRIGGER (page-specific) ============ */
  document.addEventListener('click', function (e) {
    const registerLink = e.target.closest('a[href*="register.html"]');
    if (registerLink) {
      const audio = document.getElementById('registerAudio');
      if (audio && audio.paused) {
        audio.play().catch(function (error) {
          console.warn('Audio playback blocked or failed:', error);
        });
      }
    }
  }, true);

  /* ============ STATE ============ */
  let tournaments = [];
  let activeStatus = 'all';
  let activeGame = 'all';
  let searchTerm = '';

  /* ============ DOM REFS ============ */
  const grid = document.getElementById('tournamentsGrid');
  const visibleCountEl = document.getElementById('visibleCount');
  const totalCountEl = document.getElementById('totalCount');
  const countAll = document.getElementById('countAll');
  const countUpcoming = document.getElementById('countUpcoming');
  const countLive = document.getElementById('countLive');
  const countCompleted = document.getElementById('countCompleted');
  const searchInput = document.getElementById('searchInput');
  const gameSelect = document.getElementById('gameSelect');
  const resetBtn = document.getElementById('resetFilters');
  const filterTabs = document.querySelectorAll('.filter-tab');

  if (!grid) return;

  /* ============ HELPERS ============ */
  function gameSlug(gameId) {
    const g = String(gameId || '').toLowerCase().replace(/\s+/g, '');
    if (g.includes('bgmi') || g.includes('pubg')) return 'bgmi';
    if (g.includes('free') || g === 'ff' || g === 'freefire') return 'freefire';
    if (g.includes('valorant') || g === 'val') return 'valorant';
    if (g.includes('cod')) return 'codm';
    if (g.includes('chess')) return 'chess';
    return g || 'other';
  }

  function statusLabel(status) {
    const s = String(status || 'upcoming').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatDateRange(start, end) {
    if (!start && !end) return 'Date TBA';
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    if (s && isNaN(s.getTime())) return 'Date TBA';
    if (e && isNaN(e.getTime())) return 'Date TBA';
    if (s && e) {
      const sameYear = s.getFullYear() === e.getFullYear();
      const sStr = s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
      const eStr = e.toLocaleDateString('en-IN', opts);
      return sStr + ' – ' + eStr;
    }
    if (s) return s.toLocaleDateString('en-IN', opts);
    if (e) return e.toLocaleDateString('en-IN', opts);
    return 'Date TBA';
  }

  function formatFee(fee) {
    const n = Number(fee);
    if (!n || isNaN(n) || n <= 0) return 'Free';
    return '₹' + n;
  }

  function formatPrize(prize) {
    const n = Number(prize);
    if (!n || isNaN(n) || n <= 0) return '—';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(0) + 'K';
    return '₹' + n;
  }

  function formatTeamSize(format, rosterSize) {
    if (format) return format;
    if (rosterSize) return rosterSize + 'v' + rosterSize;
    return 'Squad';
  }

  function mapTournament(row) {
    const scopeRaw = String(row.Scope || '').trim();
    const collegeRaw = String(row.CollegeName || '').trim();
    const isIntra = scopeRaw === 'Intra College' || (scopeRaw === '' && collegeRaw !== '');
    return {
      id: row.TournamentID || '',
      name: row.Name || 'Untitled Tournament',
      game: gameSlug(row.GameID),
      gameName: row.GameID || 'Game',
      status: String(row.Status || 'upcoming').toLowerCase(),
      category: row.Category || 'Tournament',
      scope: isIntra ? 'Intra College' : 'Public',
      collegeName: collegeRaw,
      dateRange: formatDateRange(row.TournamentStartAt, row.TournamentEndAt),
      teams: row.MaxTeams != null ? row.MaxTeams : 0,
      entry: formatFee(row.EntryFee),
      prize: formatPrize(row.PrizePool),
      teamSize: formatTeamSize(row.TeamFormat, row.RosterSize)
    };
  }

  /* ============ LOAD ============ */
  async function loadTournaments() {
    grid.innerHTML = `
      <div class="loading-state">
        <div class="state-icon">⏳</div>
        <div class="state-title">Loading Tournaments...</div>
        <div class="state-desc">Fetching live data from server</div>
      </div>
    `;

    try {
      const data = await fetchJSON('getTournaments');
      const rows = data.filter(r =>
        r.IsPublished === undefined ||
        r.IsPublished === true ||
        String(r.IsPublished).toUpperCase() === 'TRUE'
      );

      tournaments = rows.map(mapTournament);
      updateCounts();
      render();
    } catch (err) {
      console.error('Tournaments load error:', err);
      grid.innerHTML = `
        <div class="error-state">
          <div class="state-icon">⚠️</div>
          <div class="state-title">Unable to Load Tournaments</div>
          <div class="state-desc">${escapeHTML(err.message || 'Network error')}. Please try again.</div>
          <button class="btn btn-primary btn-sm" id="retryBtn">Retry</button>
        </div>
      `;
      document.getElementById('retryBtn')?.addEventListener('click', loadTournaments);
      visibleCountEl.textContent = '0';
      totalCountEl.textContent = '0';
    }
  }

  /* ============ BUILD CARD ============ */
  function buildCard(t) {
    const safeStatus = ['upcoming', 'live', 'completed', 'cancelled'].includes(t.status) ? t.status : 'upcoming';
    const scopeBadge = t.scope === 'Intra College'
      ? `<span class="scope-badge intra">🎓 Intra College</span>`
      : `<span class="scope-badge public">🌐 Public</span>`;

    let actionBtn = '';
    if (t.status === 'upcoming') {
      actionBtn = `<a href="register.html?tid=${encodeURIComponent(t.id)}" class="btn btn-primary btn-sm btn-block" onclick="event.stopPropagation();">Register</a>`;
    } else if (t.status === 'live') {
      actionBtn = `<a href="results.html?tid=${encodeURIComponent(t.id)}" class="btn btn-outline btn-sm btn-block" onclick="event.stopPropagation();">View Live</a>`;
    } else {
      actionBtn = `<a href="results.html?tid=${encodeURIComponent(t.id)}" class="btn btn-outline btn-sm btn-block" onclick="event.stopPropagation();">View Results</a>`;
    }

    return `
      <article class="tournament-card" data-tid="${encodeURIComponent(t.id)}" style="cursor:pointer;">
        <div class="tournament-banner">
          <span class="status-badge status-${safeStatus}">${escapeHTML(statusLabel(t.status))}</span>
          <span class="game-badge">${escapeHTML(t.gameName)}</span>
          ${scopeBadge}
        </div>
        <div class="tournament-body">
          <span class="tournament-category">${escapeHTML(t.category)} · ${escapeHTML(t.teamSize)}</span>
          <h3 class="tournament-title">${escapeHTML(t.name)}</h3>
          <div class="tournament-date">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            ${escapeHTML(t.dateRange)}
          </div>
          <div class="tournament-meta">
            <div class="meta-item"><div class="meta-label">Teams</div><div class="meta-value">${escapeHTML(t.teams)}</div></div>
            <div class="meta-item"><div class="meta-label">Entry</div><div class="meta-value">${escapeHTML(t.entry)}</div></div>
            <div class="meta-item"><div class="meta-label">Prize</div><div class="meta-value">${escapeHTML(t.prize)}</div></div>
          </div>
          <div class="tournament-actions">${actionBtn}</div>
        </div>
      </article>
    `;
  }

  /* ============ RENDER ============ */
  function render() {
    const filtered = tournaments.filter(t => {
      const matchStatus = activeStatus === 'all' || t.status === activeStatus;
      const matchGame = activeGame === 'all' || t.game === activeGame;
      const term = searchTerm.toLowerCase();
      const matchSearch = term === '' ||
        t.name.toLowerCase().includes(term) ||
        t.gameName.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term);
      return matchStatus && matchGame && matchSearch;
    });

    if (filtered.length === 0) {
      const hasAny = tournaments.length > 0;
      grid.innerHTML = `
        <div class="empty-state">
          <div class="state-icon">🔍</div>
          <div class="state-title">${hasAny ? 'No tournaments match your filters' : 'No tournaments yet'}</div>
          <div class="state-desc">${hasAny ? 'Try changing your filters or search term.' : 'Check back soon — new tournaments are being added.'}</div>
          ${hasAny ? '<button class="btn btn-primary btn-sm" id="clearEmptyBtn">Clear Filters</button>' : ''}
        </div>
      `;
      document.getElementById('clearEmptyBtn')?.addEventListener('click', clearFilters);
    } else {
      grid.innerHTML = filtered.map(buildCard).join('');
      // Wire card clicks (avoids inline onclick)
      grid.querySelectorAll('.tournament-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('a')) return; // let link clicks through
          const tid = card.dataset.tid;
          if (tid) window.location.href = 'tournament.html?tid=' + tid;
        });
      });
    }

    visibleCountEl.textContent = filtered.length;
    totalCountEl.textContent = tournaments.length;

    const hasFilters = activeStatus !== 'all' || activeGame !== 'all' || searchTerm !== '';
    resetBtn.classList.toggle('hidden', !hasFilters);
  }

  function updateCounts() {
    countAll.textContent = tournaments.length;
    countUpcoming.textContent = tournaments.filter(t => t.status === 'upcoming').length;
    countLive.textContent = tournaments.filter(t => t.status === 'live').length;
    countCompleted.textContent = tournaments.filter(t => t.status === 'completed').length;
  }

  /* ============ EVENTS ============ */
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeStatus = tab.dataset.filterStatus;
      render();
    });
  });

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    render();
  });

  gameSelect.addEventListener('change', (e) => {
    activeGame = e.target.value;
    render();
  });

  function clearFilters() {
    activeStatus = 'all';
    activeGame = 'all';
    searchTerm = '';
    filterTabs.forEach(t => t.classList.toggle('active', t.dataset.filterStatus === 'all'));
    searchInput.value = '';
    gameSelect.value = 'all';
    render();
  }

  resetBtn.addEventListener('click', clearFilters);

  /* ============ INIT ============ */
  loadTournaments();
})();