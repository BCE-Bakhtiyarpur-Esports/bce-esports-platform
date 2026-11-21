/**
 * BCE ESPORTS — HOME PAGE
 * Fixed: announcements + gallery use correct backend fields.
 * Direct fetch, top-3 featured sections, banner images, animated counters.
 */
(function () {
  'use strict';

  const API_URL = "https://script.google.com/macros/s/AKfycbyr1jpPFtXFh2H6n9TV123vz8NOEsoOTBl6NHSLTG662vmvh2M-5VZIRs1Lri3s6QSnnw/exec";

  /* ============ HELPERS ============ */
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  function safeGradient(input) {
    const fallback = 'linear-gradient(135deg, #e10600, #7a0400)';
    if (!input) return fallback;
    const s = String(input).trim();
    if (/^(linear|radial|conic)-gradient\(/i.test(s)) return s;
    if (/^#[0-9a-f]{3,8}$/i.test(s)) return 'linear-gradient(135deg, ' + s + ', #0a0a0a)';
    if (/^(rgb|hsl)a?\(/i.test(s)) return 'linear-gradient(135deg, ' + s + ', #0a0a0a)';
    return fallback;
  }
  async function fetchAction(action, params) {
    const qs = new URLSearchParams(Object.assign({ action: action }, params || {}));
    const res = await fetch(API_URL + '?' + qs.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (!json || json.success === false) throw new Error((json && json.message) || 'Request failed');
    return json.data;
  }
  function formatDateShort(d) {
    if (!d) return 'TBA';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return 'TBA';
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  function formatDateFull(d) {
    if (!d) return 'TBA';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return 'TBA';
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function formatPrize(n) {
    const v = Number(n) || 0;
    if (!v) return 'Free';
    if (v >= 100000) return '₹' + (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (v >= 1000) return '₹' + (v / 1000).toFixed(0) + 'K';
    return '₹' + v;
  }
  function statusLabel(s) { s = String(s || 'upcoming').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function isPublished(row) {
    const p = row && row.IsPublished;
    if (p === undefined || p === null || p === '') return true;
    if (p === true) return true;
    const s = String(p).toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'YES';
  }

  const GRADIENTS = [
    'linear-gradient(135deg, #e10600, #7a0400)',
    'linear-gradient(135deg, #ff6b35, #c1121f)',
    'linear-gradient(135deg, #7209b7, #3a0ca3)',
    'linear-gradient(135deg, #06d6a0, #0a8754)',
    'linear-gradient(135deg, #118ab2, #073b4c)',
    'linear-gradient(135deg, #f72585, #7209b7)',
    'linear-gradient(135deg, #ffb703, #fb8500)',
    'linear-gradient(135deg, #06d6a0, #118ab2)',
    'linear-gradient(135deg, #ef476f, #c1121f)',
    'linear-gradient(135deg, #264653, #2a9d8f)'
  ];
  function hashGradient(name) {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return GRADIENTS[Math.abs(h) % GRADIENTS.length];
  }

  function animateCounter(el, target, duration, isMoney) {
    if (!el) return;
    const startTime = performance.now();
    el.classList.add('counting');
    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(target * eased);
      el.textContent = isMoney ? formatPrize(value) : value;
      if (progress < 1) requestAnimationFrame(update);
      else el.classList.remove('counting');
    }
    requestAnimationFrame(update);
  }

  /* ============ STATE ============ */
  const state = {
    games: {},
    tournaments: [],
    tournamentsById: {},
    teams: [],
    teamsById: {}
  };

  /* ============ GAMES ============ */
  async function loadGames() {
    try {
      const data = await fetchAction('getGames');
      (data || []).forEach(function (g) {
        const id = String(g.GameID || '').trim();
        if (id) state.games[id] = g.Name || g.name || id;
      });
    } catch (e) { console.warn('Games load failed:', e); }
  }

  /* ============ STATS ============ */
  async function loadStats() {
    try {
      const [tourns, teams, games] = await Promise.all([
        fetchAction('getTournaments').catch(function () { return []; }),
        fetchAction('getTeams').catch(function () { return []; }),
        fetchAction('getGames').catch(function () { return []; })
      ]);
      const published = (tourns || []).filter(isPublished);
      const prizeSum = published.reduce(function (s, t) { return s + (Number(t.PrizePool) || 0); }, 0);

      animateCounter(document.getElementById('statTournaments'), published.length, 900, false);
      animateCounter(document.getElementById('statTeams'), (teams || []).length, 900, false);
      animateCounter(document.getElementById('statGames'), (games || []).length || 5, 900, false);
      animateCounter(document.getElementById('statPrize'), prizeSum, 1200, true);
    } catch (e) { console.warn('Stats load failed:', e); }
  }

  /* ============ TOURNAMENTS ============ */
  async function loadTournaments() {
    const grid = document.getElementById('homeTournamentsGrid');
    const viewMore = document.getElementById('tournamentsViewMore');
    if (!grid) return;

    try {
      const data = await fetchAction('getTournaments');
      const published = (data || []).filter(isPublished);

      state.tournaments = published;
      published.forEach(function (t) { state.tournamentsById[t.TournamentID] = t; });

      if (!published.length) {
        grid.innerHTML = '<p class="data-message">No tournaments available.</p>';
        return;
      }

      const order = { live: 0, upcoming: 1, completed: 2, cancelled: 3 };
      const sorted = published.slice().sort(function (a, b) {
        const sa = String(a.Status || '').toLowerCase();
        const sb = String(b.Status || '').toLowerCase();
        const oa = order[sa] !== undefined ? order[sa] : 9;
        const ob = order[sb] !== undefined ? order[sb] : 9;
        if (oa !== ob) return oa - ob;
        const da = new Date(a.TournamentStartAt || 0).getTime() || 0;
        const db = new Date(b.TournamentStartAt || 0).getTime() || 0;
        return sa === 'completed' ? db - da : da - db;
      });

      const top3 = sorted.slice(0, 3);
      grid.innerHTML = top3.map(buildTournamentCard).join('');
      if (viewMore) viewMore.style.display = published.length > 3 ? 'flex' : 'none';
    } catch (err) {
      console.error('Tournaments load error:', err);
      grid.innerHTML = '<p class="data-message">Unable to load tournaments.</p>';
    }
  }

  function buildTournamentCard(t) {
    const statusVal = String(t.Status || 'upcoming').toLowerCase();
    const gameId = String(t.GameID || '').trim();
    const gameName = state.games[gameId] || gameId || 'Game';
    const banner = String(t.BannerURL || '').trim();
    const entryFee = Number(t.EntryFee) || 0;
    const maxTeams = Number(t.MaxTeams) || 0;
    const prize = formatPrize(t.PrizePool);

    const start = formatDateShort(t.TournamentStartAt);
    const end = formatDateShort(t.TournamentEndAt);
    const dateStr = t.TournamentStartAt ? (start + (end && end !== start ? ' – ' + end : '')) : 'TBA';

    const bannerImg = banner
      ? '<img src="' + escapeHTML(banner) + '" alt="' + escapeHTML(t.Name || '') + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '';

    return '<a href="tournament.html?tid=' + encodeURIComponent(t.TournamentID) + '" class="home-tourn-card">' +
      '<div class="home-tourn-banner">' +
        bannerImg +
        '<span class="home-tourn-badge-status ' + statusVal + '">' + statusLabel(statusVal) + '</span>' +
        '<span class="home-tourn-badge-game">' + escapeHTML(gameName) + '</span>' +
      '</div>' +
      '<div class="home-tourn-body">' +
        '<div class="home-tourn-category">' + escapeHTML(t.Category || 'Tournament') + '</div>' +
        '<div class="home-tourn-name">' + escapeHTML(t.Name || 'Untitled Tournament') + '</div>' +
        '<div class="home-tourn-date">📅 ' + escapeHTML(dateStr) + '</div>' +
        '<div class="home-tourn-stats">' +
          '<div class="home-tourn-stat"><div class="home-tourn-stat-value' + (prize !== 'Free' ? ' accent' : '') + '">' + escapeHTML(prize) + '</div><div class="home-tourn-stat-label">Prize</div></div>' +
          '<div class="home-tourn-stat"><div class="home-tourn-stat-value">' + (maxTeams || '—') + '</div><div class="home-tourn-stat-label">Teams</div></div>' +
          '<div class="home-tourn-stat"><div class="home-tourn-stat-value">' + (entryFee > 0 ? '₹' + entryFee : 'Free') + '</div><div class="home-tourn-stat-label">Entry</div></div>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  /* ============ TEAMS ============ */
  async function loadTeams() {
    const grid = document.getElementById('homeTeamsGrid');
    const viewMore = document.getElementById('teamsViewMore');
    if (!grid) return;

    try {
      const [teamsData, standingsData] = await Promise.all([
        fetchAction('getTeams').catch(function () { return []; }),
        fetchAction('getStandings').catch(function () { return []; })
      ]);

      const statsByTeam = {};
      (standingsData || []).forEach(function (s) {
        const tid = String(s.TeamID || '');
        if (!tid) return;
        if (!statsByTeam[tid]) statsByTeam[tid] = { matches: 0, wins: 0, kills: 0, points: 0 };
        statsByTeam[tid].matches += Number(s.MatchesPlayed || 0);
        statsByTeam[tid].wins += Number(s.Wins || 0);
        statsByTeam[tid].kills += Number(s.Kills || 0);
        statsByTeam[tid].points += Number(s.Points || 0);
      });

      const teams = (teamsData || []).map(function (t) {
        const tid = String(t.TeamID || '');
        const name = t.Name || t.TeamName || 'Unnamed Team';
        const tag = t.Tag || t.TeamTag || '';
        const tournamentId = String(t.TournamentID || '');
        const tourn = state.tournamentsById[tournamentId] || {};
        const stats = statsByTeam[tid] || { matches: 0, wins: 0, kills: 0, points: 0 };

        return {
          id: tid,
          name: name,
          tag: tag,
          tournamentId: tournamentId,
          tournamentName: tourn.Name || '',
          logoUrl: String(t.LogoURL || t.Logo || '').trim(),
          gradient: hashGradient(name),
          stats: stats
        };
      });

      state.teams = teams;
      teams.forEach(function (t) { state.teamsById[t.id] = t; });

      if (!teams.length) {
        grid.innerHTML = '<p class="data-message">No teams available.</p>';
        return;
      }

      const sorted = teams.slice().sort(function (a, b) {
        if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
        if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
        return a.name.localeCompare(b.name);
      });

      const top3 = sorted.slice(0, 3);
      grid.innerHTML = top3.map(buildTeamCard).join('');
      if (viewMore) viewMore.style.display = teams.length > 3 ? 'flex' : 'none';
    } catch (err) {
      console.error('Teams load error:', err);
      grid.innerHTML = '<p class="data-message">Unable to load teams.</p>';
    }
  }

  function buildTeamCard(t) {
    const logoImg = t.logoUrl
      ? '<img src="' + escapeHTML(t.logoUrl) + '" alt="' + escapeHTML(t.name) + '" onerror="this.style.display=\'none\'">'
      : '';
    const tournLine = t.tournamentName
      ? '<div class="home-team-tourn">🏆 ' + escapeHTML(t.tournamentName) + '</div>'
      : '';

    return '<a href="teams.html" class="home-team-card" style="--team-gradient: ' + t.gradient + ';">' +
      '<div class="home-team-logo">' + escapeHTML(initials(t.name)) + logoImg + '</div>' +
      '<div class="home-team-name">' + escapeHTML(t.name) + '</div>' +
      (t.tag ? '<span class="home-team-tag">' + escapeHTML(t.tag) + '</span>' : '<span class="home-team-tag">—</span>') +
      tournLine +
      '<div class="home-team-stats">' +
        '<span><strong>' + t.stats.matches + '</strong> M</span>' +
        '<span><strong>' + t.stats.wins + '</strong> W</span>' +
        '<span><strong>' + t.stats.points + '</strong> Pts</span>' +
      '</div>' +
    '</a>';
  }

  /* ============ RESULTS ============ */
  async function loadResults() {
    const grid = document.getElementById('homeResultsGrid');
    const viewMore = document.getElementById('resultsViewMore');
    if (!grid) return;

    try {
      const matches = await fetchAction('getMatches').catch(function () { return []; });
      const completed = (matches || []).filter(function (m) {
        const st = String(m.Status || '').toLowerCase();
        return st === 'completed' && (m.Teams || []).some(function (t) {
          return t.Placement !== undefined && t.Placement !== '' && Number(t.Placement) > 0;
        });
      });

      if (!completed.length) {
        grid.innerHTML = '<p class="data-message">No results yet. Check back after the first match is completed.</p>';
        return;
      }

      const sorted = completed.slice().sort(function (a, b) {
        return new Date(b.ScheduledAt || 0).getTime() - new Date(a.ScheduledAt || 0).getTime();
      });

      const top3 = sorted.slice(0, 3);
      grid.innerHTML = top3.map(buildResultCard).join('');
      if (viewMore) viewMore.style.display = completed.length > 3 ? 'flex' : 'none';
    } catch (err) {
      console.error('Results load error:', err);
      grid.innerHTML = '<p class="data-message">Unable to load results.</p>';
    }
  }

  function buildResultCard(m) {
    const tourn = state.tournamentsById[String(m.TournamentID || '')] || {};
    const teams = (m.Teams || []).slice().sort(function (a, b) {
      return (Number(a.Placement) || 999) - (Number(b.Placement) || 999);
    });

    const round = m.Round || 'Match';
    const map = m.Map || '';
    const dateStr = m.ScheduledAt ? formatDateShort(m.ScheduledAt) : '';
    const displayTeams = teams.slice(0, 2);

    const teamsHtml = displayTeams.map(function (t) {
      const place = Number(t.Placement) || 0;
      const isWinner = place === 1;
      const teamName = t.TeamName || 'Unknown';
      const points = t.TotalPoints != null ? Number(t.TotalPoints) : null;

      return '<div class="home-result-team' + (isWinner ? ' winner' : '') + '">' +
        '<div class="home-result-team-logo" style="background: ' + hashGradient(teamName) + ';">' + escapeHTML(initials(teamName)) + '</div>' +
        '<div class="home-result-team-info">' +
          '<div class="home-result-team-name">' + escapeHTML(teamName) + '</div>' +
          '<div class="home-result-team-stats">' +
            '<span class="place">#' + place + '</span>' +
            (points !== null ? '<span class="pts">' + points + ' pts</span>' : '') +
          '</div>' +
        '</div>' +
        (isWinner ? '<span class="home-result-trophy">🏆</span>' : '') +
      '</div>';
    }).join('');

    const tournLine = tourn.Name ? ' · ' + escapeHTML(tourn.Name) : '';

    return '<a href="results.html" class="home-result-card">' +
      '<div class="home-result-header">' +
        '<div>' +
          '<div class="home-result-round">' + escapeHTML(round) + tournLine + '</div>' +
          (map ? '<div class="home-result-map">🗺 ' + escapeHTML(map) + '</div>' : '') +
        '</div>' +
        '<div class="home-result-date">' + escapeHTML(dateStr) + '</div>' +
      '</div>' +
      '<div class="home-result-teams">' + teamsHtml + '</div>' +
    '</a>';
  }

  /* ============ LEADERBOARD ============ */
  async function loadLeaderboard() {
    const body = document.getElementById('homeLeaderboardBody');
    const desc = document.getElementById('homeLeaderboardDesc');
    if (!body) return;

    try {
      const order = { live: 0, upcoming: 1, completed: 2 };
      const sortedT = state.tournaments.slice().sort(function (a, b) {
        const oa = order[String(a.Status || '').toLowerCase()];
        const ob = order[String(b.Status || '').toLowerCase()];
        return (oa !== undefined ? oa : 9) - (ob !== undefined ? ob : 9);
      });
      const target = sortedT[0];

      if (!target) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No standings available.</td></tr>';
        return;
      }

      const rows = await fetchAction('getStandings', { tournamentId: target.TournamentID }).catch(function () { return []; });
      const sorted = (rows || []).slice().sort(function (a, b) {
        return (Number(a.Rank) || 999) - (Number(b.Rank) || 999);
      }).slice(0, 5);

      if (desc) desc.textContent = 'Top teams in ' + (target.Name || 'this tournament') + '.';
      if (!sorted.length) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No standings for this tournament yet.</td></tr>';
        return;
      }

      body.innerHTML = sorted.map(function (r) {
        const rank = Number(r.Rank) || 0;
        const rc = rank <= 3 ? 'rank-' + rank : '';
        return '<tr class="' + rc + '">' +
          '<td><span class="rank-badge-inline">#' + rank + '</span></td>' +
          '<td>' + (Number(r.MatchesPlayed) || 0) + '</td>' +
          '<td>' + (Number(r.Wins) || 0) + '</td>' +
          '<td>' + (Number(r.Kills) || 0) + '</td>' +
          '<td><strong style="color:var(--red);">' + (Number(r.Points) || 0) + '</strong></td>' +
        '</tr>';
      }).join('');
    } catch (e) {
      console.warn('Leaderboard load failed:', e);
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">Unable to load standings.</td></tr>';
    }
  }

  /* ============ ANNOUNCEMENTS (FIXED) ============ */
  async function loadAnnouncements() {
    const grid = document.getElementById('homeAnnouncementsGrid');
    if (!grid) return;

    try {
      const data = await fetchAction('getAnnouncements').catch(function () { return []; });
      const published = (data || []).filter(isPublished).slice(0, 3);

      if (!published.length) {
        grid.innerHTML = '<p class="data-message">No announcements available.</p>';
        return;
      }

      grid.innerHTML = published.map(buildAnnouncementCard).join('');
    } catch (e) {
      console.error('Announcements load error:', e);
      grid.innerHTML = '<p class="data-message">Unable to load announcements.</p>';
    }
  }

  function buildAnnouncementCard(n) {
    // Match backend field names exactly (as used in admin panel)
    const title      = n.Title || n.title || 'Untitled';
    const category   = n.Category || n.category || 'Update';
    const excerpt    = n.Excerpt || n.excerpt || n.Body || n.Content || n.body || n.content || '';
    const coverLabel = n.CoverLabel || n.coverLabel || category.toUpperCase();
    const slug       = encodeURIComponent(n.Slug || n.slug || n.AnnouncementID || '');
    const grad       = safeGradient(n.CoverGradient || n.coverGradient);
    const dateStr    = formatDateFull(n.PublishedAt || n.publishedAt || n.CreatedAt || n.createdAt);
    const excerptStr = String(excerpt).substring(0, 160);

    return '<article class="announcement-card">' +
      '<div class="announcement-image" style="background:' + grad + ';">' + escapeHTML(coverLabel) + '</div>' +
      '<div class="announcement-body">' +
        '<div class="announcement-meta">' +
          '<span class="announcement-category">' + escapeHTML(category) + '</span>' +
          '<span class="announcement-date">' + escapeHTML(dateStr) + '</span>' +
        '</div>' +
        '<h3 class="announcement-title">' + escapeHTML(title) + '</h3>' +
        '<p class="announcement-excerpt">' + escapeHTML(excerptStr) + '</p>' +
        '<a href="news.html?slug=' + slug + '" class="announcement-link">Read More →</a>' +
      '</div>' +
    '</article>';
  }

  /* ============ GALLERY (FIXED) ============ */
  async function loadGallery() {
    const grid = document.getElementById('homeGalleryGrid');
    if (!grid) return;

    try {
      const data = await fetchAction('getGallery').catch(function () { return []; });
      const published = (data || []).filter(isPublished).slice(0, 5);

      if (!published.length) {
        grid.innerHTML = '<p class="data-message">No gallery items available.</p>';
        return;
      }

      const sizes = ['wide', '', '', 'tall', ''];
      grid.innerHTML = published.map(function (g, idx) {
        return buildGalleryCard(g, idx, sizes);
      }).join('');
    } catch (e) {
      console.error('Gallery load error:', e);
      grid.innerHTML = '<p class="data-message">Unable to load gallery.</p>';
    }
  }

  function buildGalleryCard(g, idx, sizes) {
    // Match backend field names exactly
    const type       = String(g.Type || g.type || 'photo').toLowerCase();
    const mediaUrl   = g.MediaURL || g.mediaUrl || g.mediaURL || g.VideoURL || g.videoUrl || g.URL || g.url || '';
    const isVideo    = type === 'video' || /youtube|youtu\.be|\.mp4|\.webm/i.test(String(mediaUrl));
    const title      = g.MetaText || g.metaText || g.Title || g.title || g.Caption || g.caption || 'Gallery';
    const grad       = safeGradient(g.CoverGradient || g.coverGradient);
    const thumbUrl   = g.ThumbnailURL || g.thumbnailUrl || g.thumbnail || (type === 'photo' ? mediaUrl : '');
    const size       = g.SizeHint || g.sizeHint || sizes[idx] || '';

    const imgHtml = thumbUrl
      ? '<img src="' + escapeHTML(thumbUrl) + '" alt="" loading="lazy" class="gallery-img" onerror="this.style.display=\'none\'">'
      : '';

    const playIcon = isVideo
      ? '<div class="gallery-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>'
      : '';

    return '<a href="gallery.html" class="gallery-item ' + size + '" style="background:' + grad + ';">' +
      imgHtml +
      playIcon +
      '<div class="gallery-overlay">' +
        '<div class="gallery-overlay-text">' + escapeHTML(title) + '</div>' +
      '</div>' +
    '</a>';
  }

  /* ============ SOCIAL ============ */
  function renderSocial() {
    const grid = document.getElementById('socialGrid');
    if (!grid) return;
    const socials = [
      { name: 'Discord', icon: '💬', url: 'https://discord.gg/', gradient: 'linear-gradient(135deg, #5865F2, #404EED)' },
      { name: 'Instagram', icon: '📸', url: 'https://instagram.com/', gradient: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' },
      { name: 'YouTube', icon: '▶', url: 'https://youtube.com/', gradient: 'linear-gradient(135deg, #FF0000, #cc0000)' },
      { name: 'WhatsApp', icon: '💚', url: 'https://wa.me/', gradient: 'linear-gradient(135deg, #25D366, #128C7E)' }
    ];
    grid.innerHTML = socials.map(function (s) {
      return '<a href="' + s.url + '" target="_blank" rel="noopener" class="social-card" style="--social-gradient: ' + s.gradient + ';">' +
        '<div class="social-icon">' + s.icon + '</div>' +
        '<div class="social-name">' + s.name + '</div>' +
      '</a>';
    }).join('');
  }

  /* ============ REG STATUS ============ */
  function setupRegStatus() {
    const form = document.getElementById('regStatusForm');
    const btn = document.getElementById('regStatusBtn');
    const results = document.getElementById('regStatusResults');
    const contactInput = document.getElementById('regContactInput');
    const idInput = document.getElementById('regIdInput');
    if (!form || !btn || !results) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const contact = (contactInput.value || '').trim();
      const regId = (idInput.value || '').trim();
      if (!contact) return;

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Checking...';
      results.innerHTML = '';

      try {
        const params = { contact: contact };
        if (regId) params.regId = regId;
        const data = await fetchAction('getRegistrationStatus', params);
        const rows = Array.isArray(data) ? data : [];

        if (!rows.length) {
          results.innerHTML = '<div class="reg-result-item"><div class="reg-result-info"><h4>No registrations found</h4><p>Please verify your email or phone number and try again.</p></div></div>';
        } else {
          results.innerHTML = rows.map(function (r) {
            const status = String(r.status || 'pending').toLowerCase();
            return '<div class="reg-result-item">' +
              '<div class="reg-result-info">' +
                '<h4>' + escapeHTML(r.tournamentName || 'Tournament') + '</h4>' +
                '<p>' + escapeHTML(r.teamName || 'Team') + ' · Reg ID: ' + escapeHTML(r.registrationId || '—') + '</p>' +
                '<p style="font-size:11px;margin-top:4px;color:var(--text-muted);">Submitted: ' + escapeHTML(r.submittedAt || '—') + '</p>' +
              '</div>' +
              '<span class="reg-status-pill ' + status + '">' + status.toUpperCase() + '</span>' +
            '</div>';
          }).join('');
        }
      } catch (err) {
        results.innerHTML = '<div class="reg-result-item"><div class="reg-result-info"><h4 style="color:#f87171;">Error</h4><p>' + escapeHTML(err.message || 'Unable to check status') + '</p></div></div>';
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  }

  /* ============ NAV + AUDIO ============ */
  function setupNav() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        links.classList.toggle('open');
        document.body.classList.toggle('nav-open');
      });
    }
  }

  function setupAudio() {
    const audio = document.getElementById('homeBgMusic');
    if (!audio) return;
    audio.volume = 0.5;
    const play = function () {
      audio.play().catch(function () {});
      document.removeEventListener('click', play);
      document.removeEventListener('keydown', play);
      document.removeEventListener('touchstart', play);
    };
    document.addEventListener('click', play);
    document.addEventListener('keydown', play);
    document.addEventListener('touchstart', play);
  }

  /* ============ REVEAL ============ */
  function setupReveal() {
    const revealEls = document.querySelectorAll('.reveal');
    if (!revealEls.length) return;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach(function (el) { observer.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('revealed'); });
    }
  }

  /* ============ INIT ============ */
  async function init() {
    setupNav();
    setupAudio();
    setupReveal();
    setupRegStatus();
    renderSocial();

    await loadGames();
    await Promise.all([
      loadStats(),
      loadTournaments(),
      loadTeams(),
      loadResults(),
      loadAnnouncements(),
      loadGallery()
    ]);

    loadLeaderboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
