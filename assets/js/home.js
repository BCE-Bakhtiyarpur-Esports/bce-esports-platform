/**
 * BCE ESPORTS — HOME PAGE JAVASCRIPT
 * Home-specific logic + registration status checker.
 */
(function () {
  'use strict';

  const MAIN = window.MAIN;
  if (!MAIN) { console.error('main.js not loaded'); return; }

  const {
    fetchJSON, fetchJSONWithParams, fetchConfig,
    escapeHTML, safeGradient, initials, formatDate, formatPrizeShort
  } = MAIN;

  let teamsCache = {};

  function getTeamName(id) {
    if (!id) return 'TBD';
    const t = teamsCache[id];
    return t ? (t.Name || t.TeamName || 'Team') : 'TBD';
  }

  function getTeamGradient(id) {
    const t = teamsCache[id];
    return safeGradient(t && t.LogoGradient);
  }

  /* ============ AUDIO ============ */

  function initAudio() {
    const homeAudio = document.getElementById('homeBgMusic');
    if (!homeAudio) return;
    homeAudio.volume = 0.5;

    const forcePlayAudio = () => {
      const playPromise = homeAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          removeInteractionListeners();
        }).catch(() => {});
      }
    };
    const removeInteractionListeners = () => {
      document.removeEventListener('click', forcePlayAudio);
      document.removeEventListener('touchstart', forcePlayAudio);
      document.removeEventListener('scroll', forcePlayAudio);
      document.removeEventListener('keydown', forcePlayAudio);
    };

    forcePlayAudio();
    document.addEventListener('click', forcePlayAudio);
    document.addEventListener('touchstart', forcePlayAudio);
    document.addEventListener('scroll', forcePlayAudio, { once: true });
    document.addEventListener('keydown', forcePlayAudio);
  }

  /* ============ RENDER: STATS ============ */

  function renderStats(tournaments, teams, games) {
    const tCount = tournaments.length;
    const tmCount = teams.length;
    const gCount = games.length || new Set(tournaments.map(t => t.GameID).filter(Boolean)).size || 5;
    const prizeSum = tournaments.reduce((s, t) => s + (Number(t.PrizePool) || 0), 0);
    document.getElementById('statTournaments').textContent = tCount + '+';
    document.getElementById('statTeams').textContent = tmCount + '+';
    document.getElementById('statGames').textContent = gCount;
    document.getElementById('statPrize').textContent = '₹' + formatPrizeShort(prizeSum) + '+';
  }

  /* ============ RENDER: TOURNAMENTS ============ */

  function renderTournaments(tournaments) {
    const grid = document.getElementById('homeTournamentsGrid');
    if (!grid) return;
    const items = tournaments.slice(0, 3);
    if (!items.length) {
      grid.innerHTML = '<p class="data-message">No tournaments available.</p>';
      return;
    }
    grid.innerHTML = items.map(t => {
      const rawStatus = String(t.Status || 'upcoming').toLowerCase();
      const status = ['upcoming','live','completed','cancelled'].includes(rawStatus) ? rawStatus : 'upcoming';
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      const id = encodeURIComponent(t.TournamentID || '');
      const name = escapeHTML(t.Name || 'Untitled Tournament');
      const game = escapeHTML(t.GameID || 'Game');
      const maxTeams = escapeHTML(t.MaxTeams != null ? t.MaxTeams : '0');
      const entryFee = Number(t.EntryFee || 0);
      const prize = escapeHTML(t.PrizePool != null ? t.PrizePool : '0');
      const dateLabel = formatDate(t.TournamentStartAt);
      return `
        <article class="tournament-card">
          <div class="tournament-banner">
            <span class="status-badge status-${status}">${statusLabel.toUpperCase()}</span>
            <span class="game-badge">${game}</span>
          </div>
          <div class="tournament-body">
            <h3 class="tournament-title">${name}</h3>
            <div class="tournament-date">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              ${escapeHTML(dateLabel)}
            </div>
            <div class="tournament-meta">
              <div class="meta-item"><div class="meta-label">Teams</div><div class="meta-value">${maxTeams}</div></div>
              <div class="meta-item"><div class="meta-label">Entry</div><div class="meta-value">${entryFee > 0 ? '₹' + entryFee : 'Free'}</div></div>
              <div class="meta-item"><div class="meta-label">Prize</div><div class="meta-value">₹${prize}</div></div>
            </div>
            <div class="tournament-actions">
              <a href="tournament.html?tid=${id}" class="btn btn-primary btn-sm btn-block">View Details</a>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  /* ============ RENDER: FEATURED TEAMS ============ */

  function renderFeaturedTeams(teams) {
    const grid = document.getElementById('homeTeamsGrid');
    if (!grid) return;
    const items = teams.slice(0, 4);
    if (!items.length) {
      grid.innerHTML = '<p class="data-message">No teams registered yet.</p>';
      return;
    }
    grid.innerHTML = items.map(t => {
      const name = t.Name || t.TeamName || 'Team';
      const tag = t.Tag || t.TeamTag || '';
      const gradient = safeGradient(t.LogoGradient);
      const game = t.PrimaryGameID || 'Game';
      return `
        <a href="teams.html" class="team-card" style="--team-gradient:${gradient};">
          <div class="team-logo">${escapeHTML(initials(name))}</div>
          <div class="team-name">${escapeHTML(name)}</div>
          <div class="team-tag">${escapeHTML(tag)}</div>
          <div class="team-meta"><span>${escapeHTML(game)}</span></div>
        </a>
      `;
    }).join('');
  }

  /* ============ RENDER: ANNOUNCEMENTS ============ */

  function renderAnnouncements(announcements) {
    const grid = document.getElementById('homeAnnouncementsGrid');
    if (!grid) return;
    const published = announcements.filter(n =>
      n.IsPublished === undefined || n.IsPublished === true || String(n.IsPublished).toUpperCase() === 'TRUE'
    );
    const items = published.slice(0, 3);
    if (!items.length) {
      grid.innerHTML = '<p class="data-message">No announcements available.</p>';
      return;
    }
    grid.innerHTML = items.map(n => {
      const title = escapeHTML(n.Title || 'Untitled');
      const category = escapeHTML(n.Category || 'Update');
      const excerpt = escapeHTML(n.Excerpt || '');
      const coverLabel = escapeHTML(n.CoverLabel || 'NEWS');
      const slug = encodeURIComponent(n.Slug || n.AnnouncementID || '');
      const grad = safeGradient(n.CoverGradient);
      return `
        <article class="announcement-card">
          <div class="announcement-image" style="background:${grad};">${coverLabel}</div>
          <div class="announcement-body">
            <div class="announcement-meta">
              <span class="announcement-category">${category}</span>
              <span class="announcement-date">${escapeHTML(formatDate(n.PublishedAt))}</span>
            </div>
            <h3 class="announcement-title">${title}</h3>
            <p class="announcement-excerpt">${excerpt}</p>
            <a href="news.html?slug=${slug}" class="announcement-link">Read More →</a>
          </div>
        </article>
      `;
    }).join('');
  }

  /* ============ RENDER: GALLERY ============ */

  function renderGallery(gallery) {
    const grid = document.getElementById('homeGalleryGrid');
    if (!grid) return;
    const items = gallery.slice(0, 5);
    if (!items.length) {
      grid.innerHTML = '<p class="data-message">No gallery items available.</p>';
      return;
    }
    const sizes = ['wide', '', '', 'tall', ''];
    grid.innerHTML = items.map((g, idx) => {
      const type = String(g.Type || '').toLowerCase();
      const mediaUrl = g.MediaURL || g.VideoURL || '';
      const isVideo = type === 'video' || /youtube|youtu\.be|\.mp4/i.test(String(mediaUrl));
      const title = g.MetaText || g.Title || g.Caption || 'Gallery';
      const grad = safeGradient(g.CoverGradient);
      const thumb = g.ThumbnailURL || (type === 'photo' ? g.MediaURL : '');
      const size = g.SizeHint || sizes[idx] || '';
      const imgHtml = thumb ? `<img src="${escapeHTML(thumb)}" alt="" loading="lazy" class="gallery-img" onerror="this.style.display='none'">` : '';
      const playIcon = isVideo ? '<div class="gallery-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>' : '';
      return `
        <a href="gallery.html" class="gallery-item ${size}" style="background:${grad};">
          ${imgHtml}
          ${playIcon}
          <div class="gallery-overlay">
            <div class="gallery-overlay-text">${escapeHTML(title)}</div>
          </div>
        </a>
      `;
    }).join('');
  }

  /* ============ RENDER: RESULTS ============ */

  function buildHomeResultCard(r, tournament) {
    const teamAId = r.TeamAID || r.TeamA || r.Team1ID || r.WinnerTeamID;
    const teamBId = r.TeamBID || r.TeamB || r.Team2ID;
    const teamAName = getTeamName(teamAId);
    const teamBName = getTeamName(teamBId);
    const scoreA = r.TeamAScore != null ? r.TeamAScore : (r.ScoreA != null ? r.ScoreA : '-');
    const scoreB = r.TeamBScore != null ? r.TeamBScore : (r.ScoreB != null ? r.ScoreB : '-');
    const winnerId = r.WinnerTeamID || r.WinnerID;
    const winA = winnerId && String(winnerId) === String(teamAId);
    const winB = winnerId && String(winnerId) === String(teamBId);
    const winAByScore = !winnerId && Number(scoreA) > Number(scoreB);
    const winBByScore = !winnerId && Number(scoreB) > Number(scoreA);
    const isAWinner = winA || winAByScore;
    const isBWinner = winB || winBByScore;
    const round = r.Round || r.RoundName || r.RoundKey || '';
    const game = (tournament && tournament.GameID) || '';
    const dateLabel = formatDate(r.MatchDate || r.ScheduledAt || r.RecordedAt);
    return `
      <div class="result-card">
        <div class="result-header">
          <span class="result-game">${escapeHTML(game)}${round ? ' · ' + escapeHTML(round) : ''}</span>
          <span class="result-date">${escapeHTML(dateLabel)}</span>
        </div>
        <div class="result-match">
          <div class="result-team ${isAWinner ? 'winner' : ''}">
            <div class="result-team-logo" style="--logo-bg:${getTeamGradient(teamAId)};">${escapeHTML(initials(teamAName))}</div>
            <div class="result-team-name">${escapeHTML(teamAName)}</div>
            ${isAWinner ? '<span class="winner-tag">Winner</span>' : ''}
          </div>
          <div class="result-score">${escapeHTML(String(scoreA))}<span class="sep">:</span>${escapeHTML(String(scoreB))}</div>
          <div class="result-team ${isBWinner ? 'winner' : ''}">
            <div class="result-team-logo" style="--logo-bg:${getTeamGradient(teamBId)};">${escapeHTML(initials(teamBName))}</div>
            <div class="result-team-name">${escapeHTML(teamBName)}</div>
            ${isBWinner ? '<span class="winner-tag">Winner</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderHomeResults(results, tournament) {
    const grid = document.getElementById('homeResultsGrid');
    const desc = document.getElementById('homeResultsDesc');
    if (desc && tournament) desc.textContent = `Recent match outcomes from ${tournament.Name || 'this tournament'}.`;
    if (!grid) return;
    const items = results.slice(0, 3);
    if (!items.length) {
      grid.innerHTML = '<p class="data-message">No results available.</p>';
      return;
    }
    grid.innerHTML = items.map(r => buildHomeResultCard(r, tournament)).join('');
  }

  /* ============ RENDER: LEADERBOARD ============ */

  function renderHomeLeaderboard(standings, tournament) {
    const tbody = document.getElementById('homeLeaderboardBody');
    const desc = document.getElementById('homeLeaderboardDesc');
    if (desc && tournament) desc.textContent = `Top teams in ${tournament.Name || 'this tournament'}.`;
    if (!tbody) return;
    const top5 = standings.slice(0, 5);
    if (!top5.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No standings available.</td></tr>';
      return;
    }
    tbody.innerHTML = top5.map(s => {
      const rank = Number(s.Rank) || 0;
      const rc = rank <= 3 ? `top-${rank}` : '';
      const name = escapeHTML(s.TeamName || 'Unknown');
      const tag = s.TeamTag || '';
      const mp = Number(s.MatchesPlayed != null ? s.MatchesPlayed : (s.MP || 0));
      const w = Number(s.Wins != null ? s.Wins : (s.W || 0));
      const kills = Number(s.Kills || 0);
      const points = Number(s.Points || 0);
      return `
        <tr>
          <td>
            <div class="rank-cell">
              <span class="rank-badge ${rc}">${rank}</span>
              <span class="rank-team">${name}${tag ? ' <small>' + escapeHTML(tag) + '</small>' : ''}</span>
            </div>
          </td>
          <td>${mp}</td>
          <td>${w}</td>
          <td>${kills}</td>
          <td class="points-cell">${points}</td>
        </tr>
      `;
    }).join('');
  }

  /* ============ RENDER: SOCIAL LINKS ============ */

  function renderSocialLinks(config) {
    const grid = document.getElementById('socialGrid');
    if (!grid) return;

    const configLower = {};
    Object.keys(config || {}).forEach(k => { configLower[String(k).toLowerCase()] = config[k]; });

    function findValue(keys) {
      for (const k of keys) {
        const v = configLower[String(k).toLowerCase()];
        if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
      }
      return '';
    }

    const defs = [
      { label: 'Discord', cls: 'discord-btn', keys: ['discord_url', 'social_discord', 'discord'], icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>' },
      { label: 'Instagram', cls: '', keys: ['instagram_url', 'social_instagram', 'instagram'], icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>' },
      { label: 'YouTube', cls: '', keys: ['youtube_url', 'social_youtube', 'youtube'], icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>' },
      { label: 'Twitter / X', cls: '', keys: ['twitter_url', 'x_url', 'social_twitter', 'twitter'], icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' }
    ];

    const valid = defs.map(d => {
      const url = findValue(d.keys);
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return { ...d, url };
    }).filter(Boolean);

    if (!valid.length) {
      const section = document.getElementById('community');
      if (section) section.style.display = 'none';
      return;
    }

    grid.innerHTML = valid.map(d => `
      <a href="${escapeHTML(d.url)}" target="_blank" rel="noopener noreferrer" class="social-btn ${d.cls}">
        ${d.icon}
        ${escapeHTML(d.label)}
      </a>
    `).join('');
  }

  /* ============ REGISTRATION STATUS ============ */

  async function checkRegistrationStatus(contact, regId) {
    const resultsEl = document.getElementById('regStatusResults');
    if (!resultsEl) return;
    resultsEl.innerHTML = '<div class="reg-status-loading">Searching…</div>';

    const params = { contact };
    if (regId) params.regId = regId;

    try {
      const data = await fetchJSONWithParams('getRegistrationStatus', params);
      if (!data || !data.length) {
        resultsEl.innerHTML = '<div class="reg-status-hint">No registrations found for these details.</div>';
        return;
      }
      resultsEl.innerHTML = data.map(r => {
        const status = String(r.status || 'pending').toLowerCase();
        const payStatus = String(r.paymentStatus || 'pending').toLowerCase();
        return `
          <div class="reg-card">
            <div class="reg-card-head">
              <div>
                <div class="reg-card-title">${escapeHTML(r.teamName || 'Team')}</div>
                <div class="reg-card-tag">${escapeHTML(r.teamTag || '')}</div>
              </div>
              <div class="reg-card-id">${escapeHTML(r.registrationId || '')}</div>
            </div>
            <div class="reg-card-row">
              <span class="reg-card-label">Tournament</span>
              <span class="reg-card-value">${escapeHTML(r.tournamentName || '-')}</span>
            </div>
            <div class="reg-card-row">
              <span class="reg-card-label">Captain</span>
              <span class="reg-card-value">${escapeHTML(r.captainName || '-')}</span>
            </div>
            <div class="reg-card-row">
              <span class="reg-card-label">Submitted</span>
              <span class="reg-card-value">${escapeHTML(r.submittedAt || '-')}</span>
            </div>
            <div class="reg-card-row">
              <span class="reg-card-label">Status</span>
              <span class="reg-card-value"><span class="reg-status-badge ${status}">${escapeHTML(status)}</span></span>
            </div>
            <div class="reg-card-row">
              <span class="reg-card-label">Payment</span>
              <span class="reg-card-value"><span class="reg-status-badge ${payStatus}">${escapeHTML(payStatus)}</span></span>
            </div>
            ${r.adminNote ? `<div class="reg-card-row"><span class="reg-card-label">Note</span><span class="reg-card-value">${escapeHTML(r.adminNote)}</span></div>` : ''}
          </div>
        `;
      }).join('');
    } catch (e) {
      resultsEl.innerHTML = `<div class="reg-status-error">${escapeHTML(e.message || 'Search failed. Please try again.')}</div>`;
    }
  }

  function setupRegStatusForm() {
    const form = document.getElementById('regStatusForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const contact = document.getElementById('regContactInput').value.trim();
      const regId = document.getElementById('regIdInput').value.trim();
      if (!contact) {
        document.getElementById('regStatusResults').innerHTML = '<div class="reg-status-error">Please enter your email or phone number.</div>';
        return;
      }
      checkRegistrationStatus(contact, regId);
    });
  }

  /* ============ FETCH ALL HOME DATA ============ */

  async function fetchHomeData() {
    const config = await fetchConfig();
    renderSocialLinks(config);

    try {
      const [tournaments, announcements, teams, gallery, games] = await Promise.all([
        fetchJSON('getTournaments').catch(() => []),
        fetchJSON('getAnnouncements').catch(() => []),
        fetchJSON('getTeams').catch(() => []),
        fetchJSON('getGallery').catch(() => []),
        fetchJSON('getGames').catch(() => [])
      ]);

      teams.forEach(t => { teamsCache[t.TeamID] = t; });

      renderStats(tournaments, teams, games);
      renderTournaments(tournaments);
      renderFeaturedTeams(teams);
      renderAnnouncements(announcements);
      renderGallery(gallery);

      const completed = tournaments.find(t => String(t.Status || '').toLowerCase() === 'completed');
      if (completed) {
        try {
          const results = await fetchJSONWithParams('getMatchResults', { tournamentId: completed.TournamentID });
          renderHomeResults(results, completed);
        } catch (e) {
          const el = document.getElementById('homeResultsGrid');
          if (el) el.innerHTML = '<p class="data-message">No results available.</p>';
        }
      } else {
        const el = document.getElementById('homeResultsGrid');
        if (el) el.innerHTML = '<p class="data-message">No results available.</p>';
      }

      const live = tournaments.find(t => String(t.Status || '').toLowerCase() === 'live');
      const upcoming = tournaments.find(t => String(t.Status || '').toLowerCase() === 'upcoming');
      const standingsTourn = live || upcoming || completed;
      if (standingsTourn) {
        try {
          const standings = await fetchJSONWithParams('getStandings', { tournamentId: standingsTourn.TournamentID });
          renderHomeLeaderboard(standings, standingsTourn);
        } catch (e) {
          const el = document.getElementById('homeLeaderboardBody');
          if (el) el.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No standings available.</td></tr>';
        }
      } else { 
        const el = document.getElementById('homeLeaderboardBody');
        if (el) el.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No standings available.</td></tr>';
      }
    } catch (error) {
      console.error('Homepage load error:', error);
    }
  }

  /* ============ INIT ============ */

  initAudio();
  setupRegStatusForm();
  fetchHomeData();
})();