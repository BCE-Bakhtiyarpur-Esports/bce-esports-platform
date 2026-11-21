/**
 * BCE ESPORTS — TOURNAMENT DETAIL PAGE
 * With clickable team cards that open a full roster modal.
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

  // Roster cache
  let athletesByTeam = null; // null = not loaded yet
  let standingsByTeam = {};  // TeamID -> { rank, matches, wins, kills, points }

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

  /* ============ LOAD GAMES ============ */
  async function loadGames() {
    try {
      const list = await fetchAction('getGames');
      (list || []).forEach(function (g) {
        const id = String(g.GameID != null ? g.GameID : '').trim();
        if (!id) return;
        gamesMap[id] = g.Name || g.name || id;
      });
    } catch (e) {
      console.warn('[Tournament] Could not load games list:', e);
    }
  }

  /* ============ LOAD ATHLETES (once, cached) ============ */
  async function loadAthletesOnce() {
    if (athletesByTeam !== null) return athletesByTeam;
    try {
      const list = await fetchAction('getAllAthletes') || [];
      athletesByTeam = {};
      list.forEach(function (a) {
        const tid = String(a.TeamID || '');
        if (!tid) return;
        if (!athletesByTeam[tid]) athletesByTeam[tid] = [];
        athletesByTeam[tid].push(a);
      });
    } catch (e) {
      console.warn('[Tournament] Athletes load failed:', e);
      athletesByTeam = {};
    }
    return athletesByTeam;
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

      // Cache standings by TeamID for use in roster modal
      standingsByTeam = {};
      rows.forEach(function (r) {
        const teamId = String(r.TeamID || '');
        if (!teamId) return;
        standingsByTeam[teamId] = {
          rank: Number(r.Rank) || 0,
          matches: Number(r.MatchesPlayed || 0),
          wins: Number(r.Wins || 0),
          kills: Number(r.Kills || 0),
          points: Number(r.Points || 0)
        };
      });

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

  /* ============ LOAD TEAMS (clickable → roster modal) ============ */
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
          teams.length + ' Team' + (teams.length !== 1 ? 's' : '') + ' Registered · Click a team to view roster' +
        '</div>' +
        '<div class="team-grid">' + teams.map(function (t) {
          return '<div class="team-card" data-team-id="' + escapeHTML(t.TeamID) + '" ' +
                    'data-team-name="' + escapeHTML(t.TeamName || t.TeamID) + '" ' +
                    'data-team-tag="' + escapeHTML(t.TeamTag || '') + '">' +
            '<div class="team-logo">' + escapeHTML(initials(t.TeamName)) + '</div>' +
            '<div class="team-info">' +
              '<div class="team-info-name">' + escapeHTML(t.TeamName) + '</div>' +
              (t.TeamTag ? '<div class="team-info-tag">' + escapeHTML(t.TeamTag) + '</div>' : '') +
            '</div>' +
          '</div>';
        }).join('') + '</div>';

      // Wire up clicks
      container.querySelectorAll('.team-card').forEach(function (card) {
        card.addEventListener('click', function () {
          openRosterModal(
            card.dataset.teamId,
            card.dataset.teamName,
            card.dataset.teamTag
          );
        });
      });
    } catch (e) {
      console.error('Teams load failed', e);
      document.getElementById('t-teams').textContent = '0 / ' + (maxTeams || 0);
      container.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Could not load teams</div></div>';
    }
  }

  /* ============ ROSTER MODAL ============ */
  async function openRosterModal(teamId, teamName, teamTag) {
    const backdrop = document.getElementById('rosterModalBackdrop');
    if (!backdrop) return;

    // Header
    const logo = document.getElementById('rm-logo');
    logo.textContent = initials(teamName);
    logo.style.background = 'linear-gradient(135deg, #e10600, #7a0400)';

    document.getElementById('rm-name').textContent = teamName || 'Unnamed Team';
    document.getElementById('rm-tag').textContent = teamTag || '—';

    // Stats from standings cache
    const st = standingsByTeam[String(teamId)] || { rank: 0, matches: 0, wins: 0, points: 0 };
    document.getElementById('rm-rank').textContent = st.rank > 0 ? '#' + st.rank : '—';
    document.getElementById('rm-matches').textContent = st.matches;
    document.getElementById('rm-wins').textContent = st.wins;
    document.getElementById('rm-points').textContent = st.points;

    // Show modal with loading state
    const rosterEl = document.getElementById('rm-roster');
    const countEl = document.getElementById('rm-count');
    rosterEl.innerHTML =
      '<div class="modal-loading">' +
        '<div class="modal-loading-spinner"></div>' +
        'Loading players...' +
      '</div>';
    countEl.textContent = '…';

    backdrop.classList.add('show');
    document.body.classList.add('modal-open');

    // Fetch athletes (cached after first call)
    await loadAthletesOnce();

    const roster = (athletesByTeam[String(teamId)] || []).slice().sort(function (a, b) {
      if (a.IsCaptain && !b.IsCaptain) return -1;
      if (!a.IsCaptain && b.IsCaptain) return 1;
      return (Number(a.Slot) || 999) - (Number(b.Slot) || 999);
    });

    countEl.textContent = roster.length;

    if (!roster.length) {
      rosterEl.innerHTML =
        '<div class="no-roster">' +
          '<div class="no-roster-icon">👥</div>' +
          '<strong>No verified players yet</strong><br>' +
          'Player roster will appear once team members complete verification.' +
        '</div>';
      return;
    }

    rosterEl.innerHTML = '<div class="roster-list">' + roster.map(function (p) {
      const ign = p.IGN || 'Unknown';
      const realName = p.RealName || '';
      const avatar = initials(ign);
      const captainClass = p.IsCaptain ? ' captain' : '';
      const crownBadge = p.IsCaptain ? '<div class="player-captain-crown">👑</div>' : '';

      const roleText = p.IsCaptain ? 'Captain' : ('Slot ' + (p.Slot || '?'));
      const roleClass = p.IsCaptain ? ' captain' : '';

      const uid = p.UID || p.RollNumber || '';

      // Tags
      const tags = [];
      if (uid) {
        tags.push('<span class="player-tag uid">🎮 ' + escapeHTML(uid) + '</span>');
      }
      if (p.Branch || p.Year) {
        const branchYear = [];
        if (p.Branch) branchYear.push(escapeHTML(p.Branch));
        if (p.Year) branchYear.push(escapeHTML(p.Year) + ' Yr');
        tags.push('<span class="player-tag">📚 ' + branchYear.join(' · ') + '</span>');
      }
      if (p.College) {
        tags.push('<span class="player-tag">🏫 ' + escapeHTML(p.College) + '</span>');
      }

      const statusVal = String(p.Status || 'pending').toLowerCase();
      const statusClass = ['verified', 'pending', 'rejected'].indexOf(statusVal) !== -1 ? statusVal : 'pending';
      const statusLabel = statusClass === 'verified' ? '✓ Verified' : (statusClass === 'rejected' ? '✕ Rejected' : '⏳ Pending');

      return '<div class="player-card' + captainClass + '">' +
        '<div class="player-avatar">' +
          escapeHTML(avatar) +
          crownBadge +
        '</div>' +
        '<div class="player-content">' +
          '<div class="player-header">' +
            '<span class="player-ign">' + escapeHTML(ign) + '</span>' +
            '<span class="player-role-badge' + roleClass + '">' + escapeHTML(roleText) + '</span>' +
          '</div>' +
          (realName ? '<div class="player-realname">' + escapeHTML(realName) + '</div>' : '') +
          (tags.length ? '<div class="player-tags">' + tags.join('') + '</div>' : '') +
        '</div>' +
        '<span class="player-status ' + statusClass + '">' + statusLabel + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function closeRosterModal() {
    const backdrop = document.getElementById('rosterModalBackdrop');
    if (backdrop) backdrop.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  function bindModalEvents() {
    const backdrop = document.getElementById('rosterModalBackdrop');
    const closeBtn = document.getElementById('rosterModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeRosterModal);
    if (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) closeRosterModal();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeRosterModal();
    });
  }

  /* ============ INIT ============ */
  setupTabs();
  bindModalEvents();

  loadGames().finally(function () {
    loadTournamentData();
  });
})();
