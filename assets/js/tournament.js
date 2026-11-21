/**
 * BCE ESPORTS — TOURNAMENT DETAIL PAGE
 * Fixed: direct fetch (no MAIN dependency), banner hero, dynamic game names
 */
(function () {
  'use strict';

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyr1jpPFtXFh2H6n9TV123vz8NOEsoOTBl6NHSLTG662vmvh2M-5VZIRs1Lri3s6QSnnw/exec";

  /* ============ HELPERS ============ */
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  async function fetchAction(action, params) {
    const qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    const res = await fetch(API_URL + '?' + qs.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let json;
    try { json = await res.json(); }
    catch (e) { throw new Error('Invalid response from server'); }
    if (!json || json.success === false) {
      throw new Error((json && json.message) || 'Request failed');
    }
    return json.data;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const tournamentId = urlParams.get('tid') || urlParams.get('id');

  let tournamentData = null;
  const gamesMap = {};

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

  /* ============ FORMATTERS ============ */
  function formatDateTime(str) {
    if (!str) return 'TBA';
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(str);
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatShortDate(str) {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatPrize(p) {
    const n = Number(p);
    if (!n || isNaN(n) || n <= 0) return '₹0';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(0) + 'K';
    return '₹' + n;
  }

  function gameName(id) {
    if (id == null || id === '') return 'Game';
    return gamesMap[String(id)] || String(id);
  }

  function isIntraCollege(t) {
    const scopeRaw = String(t.Scope || '').trim();
    const collegeRaw = String(t.CollegeName || '').trim();
    if (scopeRaw === 'Intra College') return true;
    if (scopeRaw === 'Public') return false;
    return collegeRaw !== '';
  }

  /* ============ TABS ============ */
  function setupTabs() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        const panel = document.querySelector('.tab-panel[data-panel="' + tab.dataset.tab + '"]');
        if (panel) panel.classList.add('active');
      });
    });
  }

  /* ============ LOAD GAMES (for display names) ============ */
  async function loadGames() {
    try {
      const list = await fetchAction('getGames');
      (list || []).forEach(function (g) {
        const id = String(g.GameID != null ? g.GameID : (g.ID != null ? g.ID : '')).trim();
        if (!id) return;
        gamesMap[id] = g.Name || g.name || id;
      });
    } catch (e) {
      console.warn('[Tournament] Could not load games list:', e);
    }
  }

  /* ============ LOAD TOURNAMENT ============ */
  async function loadTournamentData() {
    const notice = document.getElementById('loadingNotice');

    if (!tournamentId) {
      if (notice) {
        notice.innerHTML = '⚠️ <strong>Error:</strong> No Tournament ID provided in URL.';
        notice.style.background = '#4a0a0a';
      }
      return;
    }

    try {
      const t = await fetchAction('getTournament', { id: tournamentId });
      if (!t) throw new Error('Tournament not found');
      tournamentData = t;

      if (notice) notice.style.display = 'none';

      /* -------- BANNER -------- */
      const bannerUrl = String(t.BannerURL || '').trim();
      const bannerWrap = document.getElementById('t-banner-wrap');
      const bannerImg = document.getElementById('t-banner-img');
      if (bannerUrl && bannerWrap && bannerImg) {
        bannerImg.onerror = function () { bannerWrap.style.display = 'none'; };
        bannerImg.src = bannerUrl;
        bannerImg.alt = t.Name || 'Tournament Banner';
        bannerWrap.style.display = 'block';
      }

      /* -------- HERO -------- */
      document.getElementById('t-breadcrumb-name').textContent = t.Name || 'Tournament';
      document.getElementById('t-name').textContent = t.Name || 'Untitled Tournament';

      const statusBadge = document.getElementById('t-status');
      const statusVal = String(t.Status || 'upcoming').toLowerCase();
      statusBadge.textContent = (t.Status || 'UPCOMING').toUpperCase();
      statusBadge.className = 'badge badge-status-' +
        (['live', 'upcoming', 'completed', 'archived'].includes(statusVal) ? statusVal : 'upcoming');

      const gName = gameName(t.GameID);
      document.getElementById('t-game').textContent = gName;

      /* -------- SCOPE -------- */
      const intra = isIntraCollege(t);
      const collegeName = String(t.CollegeName || '').trim();
      const scopeBadge = document.getElementById('t-scope-badge');

      if (intra) {
        scopeBadge.className = 'badge badge-scope-intra';
        scopeBadge.textContent = '🎓 Intra College';
        document.getElementById('t-category').textContent = collegeName || 'Intra College';
        document.getElementById('college-info-card').style.display = 'block';
        document.getElementById('college-display-name').textContent = collegeName || 'this college';
        document.getElementById('i-college-row').style.display = 'flex';
        document.getElementById('i-college').textContent = collegeName || '-';
        document.getElementById('i-scope').textContent = 'Intra College';
      } else {
        scopeBadge.className = 'badge badge-scope-public';
        scopeBadge.textContent = '🌐 Public';
        document.getElementById('t-category').textContent = t.Category || 'Esports';
        document.getElementById('i-scope').textContent = 'Public';
      }

      /* -------- DATES + FORMAT -------- */
      const start = formatShortDate(t.TournamentStartAt) || 'TBA';
      const end = formatShortDate(t.TournamentEndAt);
      document.getElementById('t-dates').innerHTML = '📅 ' + start + (end ? ' – ' + end : '');
      document.getElementById('t-format').innerHTML = '👥 ' + (t.TeamFormat || 'Squad');

      /* -------- REGISTER BUTTON -------- */
      const regBtn = document.getElementById('t-register-btn');
      const regNote = document.getElementById('t-register-note');
      if (statusVal === 'completed' || statusVal === 'archived') {
        regBtn.textContent = 'Tournament Ended';
        regBtn.className = 'btn btn-disabled';
        regBtn.removeAttribute('href');
        regNote.textContent = '';
      } else if (statusVal === 'live') {
        regBtn.textContent = 'Registration Closed';
        regBtn.className = 'btn btn-disabled';
        regBtn.removeAttribute('href');
        regNote.textContent = 'Tournament is live';
      } else {
        regBtn.href = 'register.html?tid=' + encodeURIComponent(t.TournamentID);
        regBtn.textContent = 'Register Team';
        regNote.textContent = intra ? '🎓 Student ID verification required' : 'Open to everyone';
      }

      /* -------- QUICK STATS -------- */
      document.getElementById('t-prize').textContent = formatPrize(t.PrizePool);
      document.getElementById('t-fee').textContent = Number(t.EntryFee) > 0 ? '₹' + t.EntryFee : 'Free';
      document.getElementById('t-quick-format').textContent = t.TeamFormat || 'Squad';

      /* -------- DESCRIPTION -------- */
      document.getElementById('t-desc').innerHTML = t.Description
        ? '<p>' + escapeHTML(t.Description).replace(/\n/g, '<br>') + '</p>'
        : '<p>No description provided for this tournament yet.</p>';

      /* -------- SIDEBAR -------- */
      document.getElementById('i-game').textContent = gName;
      document.getElementById('i-format').textContent = t.TeamFormat || '-';
      document.getElementById('i-max').textContent = t.MaxTeams || '-';
      document.getElementById('i-fee').textContent = Number(t.EntryFee) > 0 ? '₹' + t.EntryFee : 'Free';
      document.getElementById('i-prize').textContent = formatPrize(t.PrizePool);

      /* -------- SUB-TABS (parallel) -------- */
      await Promise.all([
        loadSchedule(t.TournamentID),
        loadStandings(t.TournamentID),
        loadTeams(t.TournamentID, t.MaxTeams)
      ]);
    } catch (error) {
      console.error('Fetch Error:', error);
      if (notice) {
        notice.innerHTML = '⚠️ <strong>Error:</strong> ' +
          escapeHTML(error.message || 'Could not connect to database.');
        notice.style.background = '#4a0a0a';
      }
    }
  }

  /* ============ LOAD SCHEDULE ============ */
  async function loadSchedule(tid) {
    const container = document.getElementById('scheduleContent');
    try {
      const matches = await fetchAction('getMatches', { tournamentId: tid }) || [];
      if (!matches.length) {
        container.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-state-icon">📅</div>' +
            '<div class="empty-state-title">No matches scheduled yet</div>' +
            '<div class="empty-state-desc">Check back once the schedule is published.</div>' +
          '</div>';
        return;
      }

      const sorted = matches.slice().sort(function (a, b) {
        const na = Number(a.MatchNumber || 0);
        const nb = Number(b.MatchNumber || 0);
        if (na !== nb) return na - nb;
        return new Date(a.ScheduledAt || 0).getTime() - new Date(b.ScheduledAt || 0).getTime();
      });

      container.innerHTML = sorted.map(function (m) {
        const teams = (m.Teams || []);
        const s = String(m.Status || 'upcoming').toLowerCase();
        const teamsHtml = teams.length
          ? teams.map(function (t) {
              return '<span style="display:inline-block;background:var(--bg-secondary);padding:4px 10px;border-radius:4px;font-size:12px;margin:2px;">' +
                escapeHTML(t.TeamName || t.TeamID) + '</span>';
            }).join('')
          : '<span style="color:var(--text-muted);font-size:12px;">Teams TBA</span>';

        return '<div class="match-card">' +
          '<div class="match-card-head">' +
            '<div class="match-card-head-left">' +
              '<span class="match-round">' + escapeHTML(m.Round || 'Match') + '</span>' +
              (m.Map ? '<span class="match-map">🗺 ' + escapeHTML(m.Map) + '</span>' : '') +
              '<span class="status-badge ' + s + '">' + s.toUpperCase() + '</span>' +
            '</div>' +
            '<span class="match-time">' + formatDateTime(m.ScheduledAt) + '</span>' +
          '</div>' +
          '<div style="padding:16px 20px;">' +
            '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">' +
              teams.length + ' Teams' +
            '</div>' +
            '<div>' + teamsHtml + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch (e) {
      console.error('Schedule load failed', e);
      container.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Could not load schedule</div></div>';
    }
  }

  /* ============ LOAD STANDINGS ============ */
  async function loadStandings(tid) {
    const container = document.getElementById('standingsContent');
    try {
      const rows = await fetchAction('getStandings', { tournamentId: tid }) || [];
      if (!rows.length) {
        container.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-state-icon">🏆</div>' +
            '<div class="empty-state-title">Standings will appear once matches start</div>' +
            '<div class="empty-state-desc">Results are updated after every game.</div>' +
          '</div>';
        return;
      }

      const sorted = rows.slice().sort(function (a, b) {
        return Number(a.Rank || 999) - Number(b.Rank || 999);
      });

      container.innerHTML = '<div class="data-table-wrap"><table class="data-table">' +
        '<thead><tr>' +
          '<th class="center" style="width:60px;">Rank</th>' +
          '<th>Team</th>' +
          '<th class="center" style="width:80px;">Matches</th>' +
          '<th class="center" style="width:70px;">Wins</th>' +
          '<th class="center" style="width:70px;">Kills</th>' +
          '<th class="center" style="width:80px;">Points</th>' +
        '</tr></thead>' +
        '<tbody>' + sorted.map(function (r) {
          const rank = Number(r.Rank) || 0;
          const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
          return '<tr class="' + rankClass + '">' +
            '<td class="rank-num">#' + (rank || '—') + '</td>' +
            '<td><div class="team-name-cell"><span class="name">' +
              escapeHTML(r.TeamName || r.TeamID) +
            '</span></div></td>' +
            '<td class="center stat-cell">' + (r.MatchesPlayed || 0) + '</td>' +
            '<td class="center stat-cell">' + (r.Wins || 0) + '</td>' +
            '<td class="center stat-cell kills">' + (r.Kills || 0) + '</td>' +
            '<td class="center stat-cell points">' + (r.Points || 0) + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>';
    } catch (e) {
      console.error('Standings load failed', e);
      container.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Could not load standings</div></div>';
    }
  }

  /* ============ LOAD TEAMS ============ */
  async function loadTeams(tid, maxTeams) {
    const container = document.getElementById('teamsContent');
    try {
      const teams = await fetchAction('getTournamentTeams', { tournamentId: tid }) || [];
      if (!teams.length) {
        container.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-state-icon">👥</div>' +
            '<div class="empty-state-title">No teams registered yet</div>' +
            '<div class="empty-state-desc">Be the first team to sign up!</div>' +
          '</div>';
        document.getElementById('t-teams').textContent = '0 / ' + (maxTeams || 0);
        return;
      }

      document.getElementById('t-teams').textContent = teams.length + ' / ' + (maxTeams || 0);
      container.innerHTML =
        '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;font-family:\'Orbitron\',sans-serif;text-transform:uppercase;letter-spacing:1px;">' +
          teams.length + ' Team' + (teams.length !== 1 ? 's' : '') + ' Registered' +
        '</div>' +
        '<div class="team-grid">' + teams.map(function (t) {
          return '<div class="team-card">' +
            '<div class="team-logo">' + escapeHTML(initials(t.TeamName)) + '</div>' +
            '<div class="team-info">' +
              '<div class="team-info-name">' + escapeHTML(t.TeamName) + '</div>' +
              (t.TeamTag ? '<div class="team-info-tag">' + escapeHTML(t.TeamTag) + '</div>' : '') +
            '</div>' +
          '</div>';
        }).join('') + '</div>';
    } catch (e) {
      console.error('Teams load failed', e);
      document.getElementById('t-teams').textContent = '0 / ' + (maxTeams || 0);
      container.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Could not load teams</div></div>';
    }
  }

  /* ============ INIT ============ */
  setupTabs();

  // Load games first (for display names), then tournament data
  loadGames().finally(function () {
    loadTournamentData();
  });
})();
