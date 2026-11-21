/**
 * BCE ESPORTS — TOURNAMENTS LIST PAGE
 * Fixed: direct fetch (no MAIN dependency), banner images, dynamic games dropdown
 */
(function () {
  'use strict';

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyr1jpPFtXFh2H6n9TV123vz8NOEsoOTBl6NHSLTG662vmvh2M-5VZIRs1Lri3s6QSnnw/exec";

  /* ---------- helpers ---------- */
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fetchAction(action) {
    // Direct fetch — same pattern jo purane working version mein tha
    const res = await fetch(API_URL + '?action=' + encodeURIComponent(action), {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (!json || json.success === false) {
      throw new Error((json && json.message) || 'Request failed');
    }
    return json;
  }

  /* ============ AUDIO TRIGGER ============ */
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
  let gamesMap = {};       // GameID -> Name
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
      const sStr = s.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short',
        ...(sameYear ? {} : { year: 'numeric' })
      });
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

  function gameName(gameId) {
    if (gameId == null || gameId === '') return 'Game';
    return gamesMap[String(gameId)] || String(gameId);
  }

  function mapTournament(row) {
    const scopeRaw = String(row.Scope || '').trim();
    const collegeRaw = String(row.CollegeName || '').trim();
    const isIntra = scopeRaw === 'Intra College' || (scopeRaw === '' && collegeRaw !== '');
    const gameId = String(row.GameID || '');

    return {
      id: row.TournamentID || '',
      name: row.Name || 'Untitled Tournament',
      gameId: gameId,
      gameName: gameName(gameId),
      status: String(row.Status || 'upcoming').toLowerCase(),
      category: row.Category || 'Tournament',
      scope: isIntra ? 'Intra College' : 'Public',
      collegeName: collegeRaw,
      dateRange: formatDateRange(row.TournamentStartAt, row.TournamentEndAt),
      teams: row.MaxTeams != null ? row.MaxTeams : 0,
      entry: formatFee(row.EntryFee),
      prize: formatPrize(row.PrizePool),
      teamSize: formatTeamSize(row.TeamFormat, row.RosterSize),
      bannerUrl: String(row.BannerURL || '').trim()
    };
  }

  /* ============ LOAD GAMES (for dropdown + display names) ============ */
  async function loadGames() {
    try {
      const json = await fetchAction('getGames');
      const list = Array.isArray(json.data) ? json.data : [];

      // Reset dropdown — keep "All Games" only
      if (gameSelect) {
        gameSelect.innerHTML = '<option value="all">All Games</option>';
      }

      list.forEach(function (g) {
        const id = String(g.GameID != null ? g.GameID : (g.ID != null ? g.ID : '')).trim();
        if (!id) return;
        const name = g.Name || g.name || id;
        gamesMap[id] = name;

        if (gameSelect) {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = name;
          gameSelect.appendChild(opt);
        }
      });
    } catch (err) {
      console.warn('[Tournaments] Could not load games list:', err);
    }
  }

  /* ============ LOAD TOURNAMENTS ============ */
  async function loadTournaments() {
    grid.innerHTML = `
      <div class="loading-state">
        <div class="state-icon">⏳</div>
        <div class="state-title">Loading Tournaments...</div>
        <div class="state-desc">Fetching live data from server</div>
      </div>
    `;

    try {
      const json = await fetchAction('getTournaments');
      const rows = Array.isArray(json.data) ? json.data : [];

      // Filter published only
      const published = rows.filter(function (r) {
        return r.IsPublished === undefined ||
               r.IsPublished === true ||
               String(r.IsPublished).toUpperCase() === 'TRUE';
      });

      tournaments = published.map(mapTournament);
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
      const retry = document.getElementById('retryBtn');
      if (retry) retry.addEventListener('click', loadTournaments);
      if (visibleCountEl) visibleCountEl.textContent = '0';
      if (totalCountEl) totalCountEl.textContent = '0';
    }
  }

  /* ============ BUILD CARD (with banner image) ============ */
  function buildCard(t) {
    const safeStatus = ['upcoming', 'live', 'completed', 'cancelled'].includes(t.status)
      ? t.status : 'upcoming';

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

    const bannerImg = t.bannerUrl
      ? `<img src="${escapeHTML(t.bannerUrl)}" alt="${escapeHTML(t.name)}" loading="lazy" onerror="this.style.display='none'">`
      : '';

    return `
      <article class="tournament-card" data-tid="${encodeURIComponent(t.id)}" style="cursor:pointer;">
        <div class="tournament-banner">
          ${bannerImg}
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
    const filtered = tournaments.filter(function (t) {
      const matchStatus = activeStatus === 'all' || t.status === activeStatus;
      const matchGame = activeGame === 'all' || t.gameId === activeGame;
      const term = searchTerm.toLowerCase();
      const matchSearch = term === '' ||
        t.name.toLowerCase().indexOf(term) !== -1 ||
        t.gameName.toLowerCase().indexOf(term) !== -1 ||
        t.category.toLowerCase().indexOf(term) !== -1;
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
      const clearEmpty = document.getElementById('clearEmptyBtn');
      if (clearEmpty) clearEmpty.addEventListener('click', clearFilters);
    } else {
      grid.innerHTML = filtered.map(buildCard).join('');
      grid.querySelectorAll('.tournament-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;
          const tid = card.dataset.tid;
          if (tid) window.location.href = 'tournament.html?tid=' + tid;
        });
      });
    }

    if (visibleCountEl) visibleCountEl.textContent = filtered.length;
    if (totalCountEl) totalCountEl.textContent = tournaments.length;

    const hasFilters = activeStatus !== 'all' || activeGame !== 'all' || searchTerm !== '';
    if (resetBtn) resetBtn.classList.toggle('hidden', !hasFilters);
  }

  function updateCounts() {
    if (countAll) countAll.textContent = tournaments.length;
    if (countUpcoming) countUpcoming.textContent = tournaments.filter(function (t) { return t.status === 'upcoming'; }).length;
    if (countLive) countLive.textContent = tournaments.filter(function (t) { return t.status === 'live'; }).length;
    if (countCompleted) countCompleted.textContent = tournaments.filter(function (t) { return t.status === 'completed'; }).length;
  }

  /* ============ EVENTS ============ */
  filterTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      filterTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      activeStatus = tab.dataset.filterStatus;
      render();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', function (e) {
      searchTerm = e.target.value;
      render();
    });
  }

  if (gameSelect) {
    gameSelect.addEventListener('change', function (e) {
      activeGame = e.target.value;
      render();
    });
  }

  function clearFilters() {
    activeStatus = 'all';
    activeGame = 'all';
    searchTerm = '';
    filterTabs.forEach(function (t) {
      t.classList.toggle('active', t.dataset.filterStatus === 'all');
    });
    if (searchInput) searchInput.value = '';
    if (gameSelect) gameSelect.value = 'all';
    render();
  }

  if (resetBtn) resetBtn.addEventListener('click', clearFilters);

  /* ============ INIT ============ */
  // Dono parallel mein load — games pehle taaki names map ho jayein
  Promise.all([loadGames(), loadTournaments()]);
})();
