/**
 * BCE ESPORTS — Tournament Page FINAL
 * SINGLE countdown display:
 *   - Registration open   → "REGISTRATION CLOSES IN"
 *   - Registration closed → "STARTS IN"
 *   - Live/completed      → no countdown
 * Auto-switches in real-time.
 */
(function () {
  'use strict';

  const API_URL = "https://script.google.com/macros/s/AKfycbyr1jpPFtXFh2H6n9TV123vz8NOEsoOTBl6NHSLTG662vmvh2M-5VZIRs1Lri3s6QSnnw/exec";
  const CACHE_PREFIX = 'bce:tourn:v3:';
  const CACHE_TTL = {
    tournament: 10 * 60 * 1000,
    games: 60 * 60 * 1000,
    matches: 60 * 1000,
    standings: 2 * 60 * 1000,
    teams: 5 * 60 * 1000,
    allTournaments: 15 * 60 * 1000
  };
  const REGISTRATION_CLOSE_OFFSET_MS = 24 * 60 * 60 * 1000; // 24h before start

  const urlParams = new URLSearchParams(window.location.search);
  const tournamentId = urlParams.get('tid') || urlParams.get('id');

  const state = {
    tournament: null,
    gamesMap: {},
    matches: [],
    standings: [],
    teams: [],
    athletesByTeam: null,
    registrationOpen: false,
    registrationCloseAt: null,
    timerMain: null,
    currentTeamForModal: null,
    currentMatchId: null,
    lastFocusedBeforeModal: null
  };

  /* ============ CACHE ============ */
  const Cache = {
    get(key) {
      try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || typeof p !== 'object' || !p.ts) return null;
        return p;
      } catch (_) { return null; }
    },
    set(key, data) {
      try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); }
      catch (_) { try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) {} }
    }
  };

  /* ============ UTILS ============ */
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
  function formatPrize(p) {
    const n = Number(p);
    if (!n || isNaN(n) || n <= 0) return '₹0';
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(0) + 'K';
    return '₹' + n;
  }
  function formatDateTime(str) {
    if (!str) return 'TBA';
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(str);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function formatShortDate(str) {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function gameName(id) {
    if (id == null || id === '') return 'Game';
    return state.gamesMap[String(id)] || String(id);
  }
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ============ REGISTRATION CLOSE TIME ============ */
  function getRegistrationCloseTime(t) {
    if (!t) return null;
    if (t.RegistrationCloseAt) {
      const d = new Date(t.RegistrationCloseAt);
      if (!isNaN(d.getTime()) && d.getTime() > 0) return d;
    }
    if (t.TournamentStartAt) {
      const start = new Date(t.TournamentStartAt);
      if (!isNaN(start.getTime())) {
        return new Date(start.getTime() - REGISTRATION_CLOSE_OFFSET_MS);
      }
    }
    return null;
  }

  function isRegistrationOpen(t, teamCount) {
    if (!t) return false;
    const s = String(t.Status || '').toLowerCase();
    if (s === 'completed' || s === 'archived' || s === 'live') return false;
    const maxTeams = Number(t.MaxTeams) || 0;
    if (maxTeams > 0 && teamCount >= maxTeams) return false;
    const closeAt = getRegistrationCloseTime(t);
    if (closeAt && Date.now() >= closeAt.getTime()) return false;
    return true;
  }

  /* ============ FETCH ============ */
  async function fetchAction(action, params) {
    const qs = new URLSearchParams(Object.assign({ action }, params || {}));
    const res = await fetch(API_URL + '?' + qs.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let json;
    try { json = await res.json(); }
    catch (_) { throw new Error('Invalid response'); }
    if (!json || json.success === false) throw new Error((json && json.message) || 'Request failed');
    return json.data;
  }

  async function loadWithCache({ action, params, cacheKey, ttl, onData, onError }) {
    const cached = Cache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < ttl) {
      try { onData(cached.data, 'cache'); } catch (e) { console.error(e); }
      if ((Date.now() - cached.ts) > ttl * 0.5) {
        fetchAction(action, params).then(fresh => {
          if (fresh != null) Cache.set(cacheKey, fresh);
          try { onData(fresh, 'fresh-bg'); } catch (e) { console.error(e); }
        }).catch(() => {});
      }
      return;
    }
    if (cached) {
      try { onData(cached.data, 'stale'); } catch (e) { console.error(e); }
    }
    try {
      const fresh = await fetchAction(action, params);
      if (fresh != null) Cache.set(cacheKey, fresh);
      try { onData(fresh, 'fresh'); } catch (e) { console.error(e); }
    } catch (err) {
      if (!cached) onError?.(err);
    }
  }

  /* ============ TOAST ============ */
  function toast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.textContent = message;
    container.appendChild(el);
    void el.offsetWidth;
    el.classList.add('toast--show');
    setTimeout(() => {
      el.classList.remove('toast--show');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  /* ============ RENDER HERO ============ */
  function renderHero(t) {
    document.title = (t.Name || 'Tournament') + ' — BCE Esports';

    setText('breadcrumb-name', t.Name || 'Tournament');
    
    // NEW TITLE FORMATTING LOGIC
    const titleEl = document.getElementById('hero-title');
    if (titleEl) {
      const rawName = (t.Name || 'Untitled Tournament').trim();
      const words = rawName.split(' ');
      
      if (words.length >= 3) {
        const line1 = words.slice(0, words.length - 2).join(' ');
        const line2 = words[words.length - 2]; // "RANBHOOMI"
        const line3 = words[words.length - 1]; // "2026"
        titleEl.innerHTML = `
          <span class="line1">${escapeHTML(line1)}</span>
          <span class="line2">${escapeHTML(line2)}</span>
          <span class="line3">${escapeHTML(line3)}</span>
        `;
      } else if (words.length === 2) {
        titleEl.innerHTML = `
          <span class="line1">${escapeHTML(words[0])}</span>
          <span class="line2">${escapeHTML(words[1])}</span>
        `;
      } else {
        titleEl.innerHTML = `<span class="line2">${escapeHTML(rawName)}</span>`;
      }
    }

    const statusVal = String(t.Status || 'upcoming').toLowerCase();
    const statusTones = { upcoming: 'blue', live: 'green', completed: 'muted', archived: 'muted' };
    const statusEl = document.getElementById('hero-status');
    if (statusEl) {
      statusEl.textContent = statusVal.toUpperCase();
      statusEl.dataset.tone = statusTones[statusVal] || 'blue';
    }

    const gameEl = document.getElementById('hero-game');
    if (gameEl) gameEl.textContent = gameName(t.GameID);

    const startDate = formatShortDate(t.TournamentStartAt) || 'TBA';
    const endDate = formatShortDate(t.TournamentEndAt);
    setText('meta-dates', endDate && endDate !== startDate ? `${startDate} – ${endDate}` : startDate);
    setText('meta-format', t.TeamFormat || 'Squad');
    const max = Number(t.MaxTeams) || 0;
    setText('meta-teams', max > 0 ? `Up to ${max} teams` : 'Open slots');

    setupCountdowns(t);
    updateRegistrationCTA(t);
    renderRegistrationStatus();
  }

  /* ============ SINGLE COUNTDOWN (REG OR START) ============ */
  function buildCountdownUnits(remaining) {
    if (remaining <= 0) return '';
    const d = Math.floor(remaining / 86400000);
    const h = Math.floor((remaining % 86400000) / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return (d > 0 ? `<div class="cd-unit"><span class="cd-val">${d}</span><span class="cd-name">DAYS</span></div>` : '') +
      `<div class="cd-unit"><span class="cd-val">${String(h).padStart(2, '0')}</span><span class="cd-name">HRS</span></div>` +
      `<div class="cd-unit"><span class="cd-val">${String(m).padStart(2, '0')}</span><span class="cd-name">MIN</span></div>` +
      `<div class="cd-unit"><span class="cd-val">${String(s).padStart(2, '0')}</span><span class="cd-name">SEC</span></div>`;
  }

  function setupCountdowns(t) {
    if (state.timerMain) { clearInterval(state.timerMain); state.timerMain = null; }

    const regEl = document.getElementById('hero-deadline');
    const startEl = document.getElementById('hero-countdown');
    if (!regEl || !startEl) return;

    const statusVal = String(t.Status || '').toLowerCase();
    if (statusVal === 'completed' || statusVal === 'archived' || statusVal === 'live') {
      regEl.style.display = 'none';
      startEl.style.display = 'none';
      return;
    }

    const closeAt = getRegistrationCloseTime(t);
    const startAtRaw = t.TournamentStartAt ? new Date(t.TournamentStartAt) : null;
    const startAt = startAtRaw && !isNaN(startAtRaw.getTime()) ? startAtRaw : null;
    state.registrationCloseAt = closeAt;

    let currentMode = null;

    const decideMode = () => {
      const now = Date.now();
      const maxTeams = Number(t.MaxTeams) || 0;
      const slotsFull = maxTeams > 0 && state.teams.length >= maxTeams;

      if (closeAt && closeAt.getTime() > now && !slotsFull) return 'reg';
      if (startAt && startAt.getTime() > now) return 'start';
      return 'none';
    };

    const applyMode = (mode) => {
      if (mode === 'reg') {
        regEl.style.display = 'block';
        startEl.style.display = 'none';
      } else if (mode === 'start') {
        startEl.style.display = 'block';
        regEl.style.display = 'none';
      } else {
        regEl.style.display = 'none';
        startEl.style.display = 'none';
      }
    };

    const tick = () => {
      const mode = decideMode();

      if (mode !== currentMode) {
        currentMode = mode;
        regEl.classList.remove('is-urgent');
        applyMode(mode);
        updateRegistrationCTA(state.tournament);
      }

      if (mode === 'reg') {
        const remaining = closeAt.getTime() - Date.now();
        const urgent = remaining > 0 && remaining < 3600000; // < 1h
        regEl.classList.toggle('is-urgent', urgent);
        const labelEl = document.getElementById('cd-label-deadline');
        const unitsEl = document.getElementById('cd-units-deadline');
        if (labelEl) labelEl.textContent = urgent ? '⏰ CLOSING SOON' : '⏰ REGISTRATION CLOSES IN';
        if (unitsEl) unitsEl.innerHTML = buildCountdownUnits(remaining);
      } else if (mode === 'start') {
        const unitsEl = document.getElementById('cd-units-start');
        if (unitsEl) unitsEl.innerHTML = buildCountdownUnits(startAt.getTime() - Date.now());
      }
    };

    tick();
    state.timerMain = setInterval(tick, 1000);
  }

  /* ============ REGISTRATION CTA ============ */
  function updateRegistrationCTA(t) {
    if (!t) return;
    const heroBtn = document.getElementById('hero-register');
    const note = document.getElementById('hero-register-note');
    const sticky = document.getElementById('sticky-cta');
    const s = String(t.Status || '').toLowerCase();
    const isOpen = isRegistrationOpen(t, state.teams.length);
    state.registrationOpen = isOpen;

    const setDisabled = (label, noteText) => {
      if (heroBtn) {
        heroBtn.innerHTML = `<span>${label}</span>`;
        heroBtn.classList.add('is-disabled');
        heroBtn.removeAttribute('href');
      }
      if (note) note.textContent = noteText || '';
      if (sticky) sticky.style.display = 'none';
    };

    if (s === 'completed' || s === 'archived') return setDisabled('TOURNAMENT ENDED', 'This tournament has ended');
    if (s === 'live') return setDisabled('REGISTRATION CLOSED', 'Tournament is live');
    if (Number(t.MaxTeams) > 0 && state.teams.length >= Number(t.MaxTeams)) {
      return setDisabled('REGISTRATION FULL', 'All slots filled');
    }
    if (state.registrationCloseAt && Date.now() >= state.registrationCloseAt.getTime()) {
      return setDisabled('REGISTRATION CLOSED', 'Deadline passed');
    }
    if (!isOpen) return setDisabled('REGISTRATION CLOSED', 'Registration is closed');

    const regUrl = 'register.html?tid=' + encodeURIComponent(t.TournamentID);
    if (heroBtn) {
      heroBtn.innerHTML = '<span>REGISTER TEAM</span><span class="hero-cta-arrow" aria-hidden="true">→</span>';
      heroBtn.classList.remove('is-disabled');
      heroBtn.setAttribute('href', regUrl);
    }
    if (note) {
      const closeAt = state.registrationCloseAt;
      let noteText = '🌐 Open to everyone';
      if (closeAt) {
        const hoursLeft = Math.max(0, Math.floor((closeAt.getTime() - Date.now()) / 3600000));
        if (hoursLeft < 48) noteText += ` · ⏰ ${hoursLeft}h left`;
      }
      note.textContent = noteText;
    }
    if (sticky) {
      sticky.style.display = '';
      sticky.setAttribute('href', regUrl);
    }
  }

  /* ============ REGISTRATION STATUS BANNER ============ */
  function renderRegistrationStatus() {
    if (!state.tournament) return;
    const el = document.getElementById('regStatus');
    if (!el) return;

    let regId = null;
    try { regId = localStorage.getItem('bce:last-reg:' + state.tournament.TournamentID); } catch (_) {}
    if (!regId) { el.style.display = 'none'; return; }

    el.style.display = 'block';
    setText('regStatusTitle', 'Already registered');
    setText('regStatusSub', 'Team submitted · Tap to check status');

    const heroBtn = document.getElementById('hero-register');
    if (heroBtn) {
      heroBtn.innerHTML = '<span>VIEW REGISTRATION</span><span class="hero-cta-arrow" aria-hidden="true">→</span>';
      heroBtn.classList.remove('is-disabled');
      heroBtn.setAttribute('href', 'registration-status.html');
    }
    const sticky = document.getElementById('sticky-cta');
    if (sticky) {
      const span = sticky.querySelector('span');
      if (span) span.textContent = 'VIEW STATUS';
      sticky.setAttribute('href', 'registration-status.html');
    }
  }

  /* ============ STATS & SOCIAL PROOF ============ */
  function renderStats(t) {
    setText('stat-prize', formatPrize(t.PrizePool));
    setText('stat-fee', Number(t.EntryFee) > 0 ? '₹' + t.EntryFee : 'Free');
    setText('stat-format', t.TeamFormat || 'Squad');
    setText('sp-prize', formatPrize(t.PrizePool));
  }

  function updateTeamsCount(count) {
    const max = Number(state.tournament?.MaxTeams) || 0;
    setText('stat-teams', max > 0 ? `${count} / ${max}` : String(count));
    setText('sp-teams', String(count));

    const bar = document.getElementById('capacity-bar');
    const fill = document.getElementById('capacity-fill');
    const label = document.getElementById('capacity-label');

    if (max > 0 && bar) {
      bar.style.display = 'block';
      const pct = Math.min(100, (count / max) * 100);
      if (fill) fill.style.width = pct + '%';
      if (label) label.textContent = `${count} of ${max} slots filled · ${Math.max(0, max - count)} remaining`;
    }
    const metaTeams = document.getElementById('meta-teams');
    if (metaTeams && max > 0) metaTeams.textContent = `${count} / ${max} teams`;
  }

  function updatePlayersCount() {
    if (!state.athletesByTeam) return;
    let total = 0;
    Object.keys(state.athletesByTeam).forEach(k => { total += state.athletesByTeam[k].length; });
    setText('sp-players', String(total));
  }

  function updateMatchesCount() {
    setText('sp-matches', String(state.matches.length));
  }

  /* ============ OVERVIEW ============ */
  function renderOverview(t) {
    const desc = document.getElementById('panel-desc');
    if (desc) {
      desc.innerHTML = t.Description
        ? '<p>' + escapeHTML(t.Description).replace(/\n/g, '<br>') + '</p>'
        : '<div class="panel-empty panel-empty--small"><div class="panel-empty-title">No description yet</div><div class="panel-empty-text">The organizer hasn\'t added details for this tournament.</div></div>';
    }

    setText('info-game', gameName(t.GameID));
    setText('info-format', t.TeamFormat || 'Squad');
    setText('info-max', Number(t.MaxTeams) > 0 ? t.MaxTeams + ' teams' : 'Open');
    setText('info-fee', Number(t.EntryFee) > 0 ? '₹' + t.EntryFee : 'Free');
    setText('info-prize', formatPrize(t.PrizePool));

    const sd = formatShortDate(t.TournamentStartAt);
    const ed = formatShortDate(t.TournamentEndAt);
    setText('info-dates', sd && ed ? `${sd} – ${ed}` : (sd || 'TBA'));

    const closeAt = getRegistrationCloseTime(t);
    const closeEl = document.getElementById('info-regclose');
    if (closeEl) {
      closeEl.textContent = closeAt ? formatDateTime(closeAt.toISOString()) : 'Until full';
    }

    const copyBtn = document.getElementById('copyTid');
    if (copyBtn) {
      copyBtn.firstChild.textContent = t.TournamentID || '—';
      copyBtn.onclick = () => {
        try {
          navigator.clipboard.writeText(t.TournamentID);
          toast('Tournament ID copied', 'success');
        } catch (_) { toast('Could not copy', 'error'); }
      };
    }

    renderPrizeBreakdown(t);
    renderTimeline(t);
  }

  function renderPrizeBreakdown(t) {
    const card = document.getElementById('prize-card');
    const podium = document.getElementById('podium');
    if (!card || !podium) return;

    const p1 = Number(t.Prize1st) || 0;
    const p2 = Number(t.Prize2nd) || 0;
    const p3 = Number(t.Prize3rd) || 0;
    if (!p1 && !p2 && !p3) { card.style.display = 'none'; return; }

    card.style.display = '';
    podium.innerHTML =
      (p2 ? `<div class="podium-item podium-item--2"><div class="podium-place">🥈</div><div class="podium-label">2nd Place</div><div class="podium-val">${escapeHTML(formatPrize(p2))}</div></div>` : '') +
      (p1 ? `<div class="podium-item podium-item--1"><div class="podium-place">🥇</div><div class="podium-label">1st Place</div><div class="podium-val">${escapeHTML(formatPrize(p1))}</div></div>` : '') +
      (p3 ? `<div class="podium-item podium-item--3"><div class="podium-place">🥉</div><div class="podium-label">3rd Place</div><div class="podium-val">${escapeHTML(formatPrize(p3))}</div></div>` : '');
  }

  function renderTimeline(t) {
    const container = document.getElementById('timeline');
    if (!container) return;

    const now = new Date();
    const start = t.TournamentStartAt ? new Date(t.TournamentStartAt) : null;
    const end = t.TournamentEndAt ? new Date(t.TournamentEndAt) : null;
    const closeAt = getRegistrationCloseTime(t);

    const items = [];
    if (closeAt) {
      items.push({
        label: closeAt > now ? 'Registration Closes' : 'Registration Closed',
        date: formatShortDate(closeAt.toISOString()),
        state: closeAt > now ? 'upcoming' : 'past',
        sort: closeAt.getTime()
      });
    }
    if (start && !isNaN(start.getTime())) {
      items.push({
        label: start > now ? 'Tournament Begins' : 'Tournament Started',
        date: formatShortDate(t.TournamentStartAt),
        state: start > now ? 'upcoming' : (end && end > now ? 'current' : 'past'),
        sort: start.getTime()
      });
    }
    if (end && !isNaN(end.getTime())) {
      items.push({
        label: 'Tournament Ends',
        date: formatShortDate(t.TournamentEndAt),
        state: end > now ? 'upcoming' : 'past',
        sort: end.getTime()
      });
    }

    if (!items.length) {
      container.innerHTML = '<div class="panel-empty panel-empty--small"><div class="panel-empty-text">No dates scheduled yet.</div></div>';
      return;
    }
    items.sort((a, b) => a.sort - b.sort);

    container.innerHTML = items.map(item => `
      <div class="tl-item tl-item--${item.state}">
        <div class="tl-dot" aria-hidden="true"></div>
        <div class="tl-body">
          <div class="tl-label">${escapeHTML(item.label)}</div>
          <div class="tl-date">${escapeHTML(item.date)}</div>
        </div>
      </div>
    `).join('');
  }

  /* ============ SCHEDULE ============ */
  function renderSchedule(matches) {
    const container = document.getElementById('panel-schedule');
    if (!container) return;
    state.matches = matches || [];
    updateMatchesCount();

    if (!state.matches.length) {
      container.innerHTML = `
        <div class="panel-empty">
          <div class="panel-empty-icon">📅</div>
          <div class="panel-empty-title">No matches scheduled yet</div>
          <div class="panel-empty-text">The schedule will appear here once the organizer publishes it.</div>
          <a href="contact.html" class="panel-empty-cta">CONTACT ORGANIZER</a>
        </div>`;
      return;
    }

    const sorted = state.matches.slice().sort((a, b) => {
      const na = Number(a.MatchNumber || 0);
      const nb = Number(b.MatchNumber || 0);
      if (na !== nb) return na - nb;
      return new Date(a.ScheduledAt || 0) - new Date(b.ScheduledAt || 0);
    });

    const liveMatches = sorted.filter(m => String(m.Status || '').toLowerCase() === 'live');
    updateLiveBar(liveMatches);

    container.innerHTML = '<div class="match-list">' + sorted.map(m => {
      const teams = m.Teams || [];
      const st = String(m.Status || 'upcoming').toLowerCase();
      const teamsHtml = teams.length
        ? teams.map(t => `<span class="match-team">${escapeHTML(t.TeamName || t.TeamID)}</span>`).join('')
        : '<span class="match-teams-tba">Teams TBA</span>';
      const isLive = st === 'live';

      return `
        <div class="match-card${isLive ? ' is-live' : ''}" data-match-id="${escapeHTML(m.MatchID)}" data-match-round="${escapeHTML(m.Round || '')}" data-match-time="${formatDateTime(m.ScheduledAt)}">
          <div class="match-head">
            <div class="match-head-left">
              <span class="match-round">${escapeHTML(m.Round || 'Match')}</span>
              ${m.Map ? `<span class="match-map">🗺 ${escapeHTML(m.Map)}</span>` : ''}
              <span class="chip chip--${st}">${st.toUpperCase()}</span>
            </div>
            <span class="match-time">${formatDateTime(m.ScheduledAt)}</span>
          </div>
          <div class="match-body">
            <div class="match-count">${teams.length} teams</div>
            <div class="match-teams">${teamsHtml}</div>
            <div class="match-view-hint">Tap to view results →</div>
          </div>
        </div>`;
    }).join('') + '</div>';

    container.querySelectorAll('.match-card').forEach(card => {
      card.addEventListener('click', () => {
        openMatchModal(card.dataset.matchId, card.dataset.matchRound, card.dataset.matchTime);
      });
    });
  }

  function updateLiveBar(liveMatches) {
    const bar = document.getElementById('liveBar');
    if (!bar) return;
    if (!liveMatches.length) { bar.classList.remove('is-visible'); return; }

    const first = liveMatches[0];
    const text = document.getElementById('liveBarText');
    if (text) {
      const round = first.Round || 'Match';
      const map = first.Map ? ` · ${first.Map}` : '';
      text.textContent = `LIVE — ${round}${map}`;
    }
    bar.classList.add('is-visible');

    const jump = document.getElementById('liveBarJump');
    if (jump) {
      jump.onclick = () => {
        activateTab('schedule');
        const el = document.getElementById('panel-schedule');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    }
  }

  /* ============ MATCH MODAL ============ */
  async function openMatchModal(matchId, round, time) {
    const backdrop = document.getElementById('matchBackdrop');
    if (!backdrop) return;
    state.currentMatchId = matchId;
    state.lastFocusedBeforeModal = document.activeElement;

    setText('mm-round', round || 'MATCH');
    setText('mm-title', round || 'Match Details');
    setText('mm-time', time || '');

    const bodyEl = document.getElementById('mm-body');
    if (bodyEl) bodyEl.innerHTML = '<div class="modal-loading"><div class="modal-spinner" aria-hidden="true"></div><span>Loading results…</span></div>';

    backdrop.classList.add('is-open');
    document.body.classList.add('modal-open');

    try {
      const results = await fetchAction('getMatchResults', { matchId });
      if (state.currentMatchId !== matchId) return;

      const match = state.matches.find(m => String(m.MatchID) === String(matchId)) || {};
      const teams = match.Teams || [];

      if (!results || !results.length) {
        if (bodyEl) {
          bodyEl.innerHTML = `
            <h3 class="modal-section-title"><span>Teams</span><span class="modal-section-count">${teams.length}</span></h3>
            <div class="roster-list">
              ${teams.map(t => `<div class="player"><div class="player-avatar">${escapeHTML(initials(t.TeamName || t.TeamID))}</div><div class="player-content"><div class="player-row"><span class="player-ign">${escapeHTML(t.TeamName || t.TeamID)}</span></div>${t.TeamTag ? `<div class="player-real">${escapeHTML(t.TeamTag)}</div>` : ''}</div></div>`).join('')}
            </div>
            <div class="no-roster" style="margin-top:16px;">
              <div class="no-roster-title">No results yet</div>
              <div class="no-roster-text">Results will appear here once this match is completed.</div>
            </div>`;
        }
        focusModalClose('mm-close');
        return;
      }

      const sorted = results.slice().sort((a, b) => {
        const pa = Number(a.Placement) || 999;
        const pb = Number(b.Placement) || 999;
        return pa - pb;
      });

      if (bodyEl) {
        bodyEl.innerHTML = `
          <h3 class="modal-section-title"><span>Results</span><span class="modal-section-count">${sorted.length}</span></h3>
          <div class="mm-table-wrap">
            <table class="mm-table">
              <thead>
                <tr>
                  <th style="text-align:center;width:60px;">#</th>
                  <th>Team</th>
                  <th style="text-align:center;width:70px;">Kills</th>
                  <th style="text-align:center;width:80px;">Placement</th>
                  <th style="text-align:center;width:70px;">Points</th>
                </tr>
              </thead>
              <tbody>
                ${sorted.map(r => {
                  const pl = Number(r.Placement) || 0;
                  const plClass = pl >= 1 && pl <= 3 ? `mm-place--${pl}` : '';
                  return `
                    <tr>
                      <td class="mm-place ${plClass}">${pl || '—'}</td>
                      <td>${escapeHTML(r.TeamName || r.TeamID)}</td>
                      <td class="mm-num">${r.Kills || 0}</td>
                      <td class="mm-num">${r.PlacementPoints || 0}</td>
                      <td class="mm-num mm-points">${r.TotalPoints || 0}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`;
      }
      focusModalClose('mm-close');
    } catch (err) {
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div class="no-roster">
            <div class="no-roster-title">Could not load results</div>
            <div class="no-roster-text">${escapeHTML(err.message || 'Please try again.')}</div>
          </div>`;
      }
      focusModalClose('mm-close');
    }
  }

  function focusModalClose(id) {
    const btn = document.getElementById(id);
    if (btn) { try { btn.focus(); } catch (_) {} }
  }

  function closeMatchModal() {
    const backdrop = document.getElementById('matchBackdrop');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    state.currentMatchId = null;
    if (state.lastFocusedBeforeModal) {
      try { state.lastFocusedBeforeModal.focus(); } catch (_) {}
      state.lastFocusedBeforeModal = null;
    }
  }

  /* ============ STANDINGS ============ */
  function renderStandings(rows) {
    const container = document.getElementById('panel-standings');
    if (!container) return;
    state.standings = rows || [];

    if (!state.standings.length) {
      container.innerHTML = `
        <div class="panel-empty">
          <div class="panel-empty-icon">🏆</div>
          <div class="panel-empty-title">Standings coming soon</div>
          <div class="panel-empty-text">Rankings will appear once the first match is played.</div>
          <a href="results.html" class="panel-empty-cta">BROWSE RESULTS</a>
        </div>`;
      return;
    }

    const sorted = state.standings.slice().sort((a, b) => Number(a.Rank || 999) - Number(b.Rank || 999));

    container.innerHTML = `
      <div class="board-wrap">
        <table class="board">
          <thead>
            <tr>
              <th class="board-rank-col">#</th>
              <th>Team</th>
              <th class="board-num-col">MP</th>
              <th class="board-num-col">W</th>
              <th class="board-num-col">K</th>
              <th class="board-num-col board-points-col">PTS</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(r => {
              const rank = Number(r.Rank) || 0;
              const rankClass = rank >= 1 && rank <= 3 ? `board-row--top${rank}` : '';
              return `
                <tr class="${rankClass}">
                  <td class="board-rank">${rank || '—'}</td>
                  <td class="board-team">${escapeHTML(r.TeamName || r.TeamID)}</td>
                  <td class="board-num">${r.MatchesPlayed || 0}</td>
                  <td class="board-num">${r.Wins || 0}</td>
                  <td class="board-num board-kills">${r.Kills || 0}</td>
                  <td class="board-num board-points">${r.Points || 0}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ============ TEAMS ============ */
  function renderTeams(teams) {
    const container = document.getElementById('panel-teams');
    if (!container) return;
    state.teams = teams || [];
    updateTeamsCount(state.teams.length);
    if (state.tournament) updateRegistrationCTA(state.tournament);

    if (!state.teams.length) {
      container.innerHTML = `
        <div class="panel-empty">
          <div class="panel-empty-icon">👥</div>
          <div class="panel-empty-title">No teams registered yet</div>
          <div class="panel-empty-text">Be the first to claim a slot in this tournament.</div>
          <a href="#" class="panel-empty-cta" id="emptyRegBtn">REGISTER NOW</a>
        </div>`;
      const btn = document.getElementById('emptyRegBtn');
      if (btn && state.tournament) {
        btn.href = 'register.html?tid=' + encodeURIComponent(state.tournament.TournamentID);
      }
      return;
    }

    const rankByTeam = {};
    state.standings.forEach(s => {
      if (s.TeamID) rankByTeam[String(s.TeamID)] = Number(s.Rank) || 0;
    });

    container.innerHTML = `
      <div class="teams-meta">${state.teams.length} team${state.teams.length !== 1 ? 's' : ''} registered · Tap to view roster</div>
      <div class="team-grid">
        ${state.teams.map(t => {
          const tid = String(t.TeamID || '');
          const rank = rankByTeam[tid] || 0;
          const roster = state.athletesByTeam?.[tid] || [];
          const playerCount = roster.length;
          const verifiedCount = roster.filter(p => String(p.Status || '').toLowerCase() === 'verified').length;
          const allVerified = playerCount > 0 && verifiedCount === playerCount;
          const someVerified = verifiedCount > 0;

          return `
            <button type="button" class="team-card" data-team-id="${escapeHTML(t.TeamID)}" data-team-name="${escapeHTML(t.TeamName || t.TeamID)}" data-team-tag="${escapeHTML(t.TeamTag || '')}" aria-label="View roster for ${escapeHTML(t.TeamName || t.TeamID)}">
              ${rank > 0 ? `<span class="team-rank-badge">#${rank}</span>` : ''}
              <div class="team-logo">${escapeHTML(initials(t.TeamName))}</div>
              <div class="team-info">
                <div class="team-name">${escapeHTML(t.TeamName || t.TeamID)}</div>
                <div class="team-meta">
                  ${t.TeamTag ? `<span class="team-meta-item">${escapeHTML(t.TeamTag)}</span>` : ''}
                  ${playerCount > 0 ? `<span class="team-meta-item">${playerCount} player${playerCount !== 1 ? 's' : ''}</span>` : ''}
                  ${allVerified ? `<span class="team-meta-item verified">✓ All verified</span>` : (someVerified ? `<span class="team-meta-item pending">⏳ ${verifiedCount}/${playerCount}</span>` : '')}
                </div>
              </div>
              <div class="team-arrow" aria-hidden="true">→</div>
            </button>`;
        }).join('')}
      </div>`;

    container.querySelectorAll('.team-card').forEach(card => {
      card.addEventListener('click', () => {
        openRosterModal(card.dataset.teamId, card.dataset.teamName, card.dataset.teamTag);
      });
    });
  }

  /* ============ ROSTER MODAL ============ */
  async function loadAthletesOnce() {
    if (state.athletesByTeam !== null) return state.athletesByTeam;
    try {
      const list = await fetchAction('getAllAthletes') || [];
      state.athletesByTeam = {};
      list.forEach(a => {
        const tid = String(a.TeamID || '');
        if (!tid) return;
        if (!state.athletesByTeam[tid]) state.athletesByTeam[tid] = [];
        state.athletesByTeam[tid].push(a);
      });
      updatePlayersCount();
    } catch (e) {
      console.warn('[Tournament] Athletes load failed:', e);
      state.athletesByTeam = {};
    }
    return state.athletesByTeam;
  }

  async function openRosterModal(teamId, teamName, teamTag) {
    const backdrop = document.getElementById('rosterBackdrop');
    if (!backdrop) return;
    state.currentTeamForModal = teamId;
    state.lastFocusedBeforeModal = document.activeElement;

    const logo = document.getElementById('rm-logo');
    if (logo) logo.textContent = initials(teamName);
    setText('rm-name', teamName || 'Unnamed Team');
    setText('rm-tag', teamTag || '—');

    const st = state.standings.find(s => String(s.TeamID) === String(teamId)) || {};
    setText('rm-rank', st.Rank ? '#' + st.Rank : '—');
    setText('rm-matches', st.MatchesPlayed || 0);
    setText('rm-wins', st.Wins || 0);
    setText('rm-points', st.Points || 0);

    const rosterEl = document.getElementById('rm-roster');
    const countEl = document.getElementById('rm-count');
    if (rosterEl) rosterEl.innerHTML = '<div class="modal-loading"><div class="modal-spinner" aria-hidden="true"></div><span>Loading players…</span></div>';
    if (countEl) countEl.textContent = '…';

    backdrop.classList.add('is-open');
    document.body.classList.add('modal-open');

    await loadAthletesOnce();
    if (state.currentTeamForModal !== teamId) return;

    const roster = (state.athletesByTeam[teamId] || []).slice().sort((a, b) => {
      if (a.IsCaptain && !b.IsCaptain) return -1;
      if (!a.IsCaptain && b.IsCaptain) return 1;
      return (Number(a.Slot) || 999) - (Number(b.Slot) || 999);
    });

    if (countEl) countEl.textContent = roster.length;

    if (!roster.length) {
      if (rosterEl) {
        rosterEl.innerHTML = `
          <div class="no-roster">
            <div class="no-roster-icon" aria-hidden="true">👥</div>
            <div class="no-roster-title">No players yet</div>
            <div class="no-roster-text">Roster will appear once players complete verification.</div>
          </div>`;
      }
      focusModalClose('rm-close');
      return;
    }

    if (rosterEl) {
      rosterEl.innerHTML = '<div class="roster-list">' + roster.map(p => {
        const ign = p.IGN || 'Unknown';
        const realName = p.RealName || '';
        const isCaptain = !!p.IsCaptain;
        const roleText = isCaptain ? 'Captain' : ('Slot ' + (p.Slot || '?'));
        const uid = p.UID || p.RollNumber || '';
        const tags = [];
        if (uid) tags.push(`<span class="player-tag player-tag--uid">🆔 ${escapeHTML(uid)}</span>`);
        if (p.Branch || p.Year) {
          const parts = [];
          if (p.Branch) parts.push(escapeHTML(p.Branch));
          if (p.Year) parts.push(escapeHTML(p.Year) + ' Yr');
          tags.push(`<span class="player-tag">📚 ${parts.join(' · ')}</span>`);
        }
        if (p.College) tags.push(`<span class="player-tag">🏫 ${escapeHTML(p.College)}</span>`);

        const sv = String(p.Status || 'pending').toLowerCase();
        const sc = ['verified', 'pending', 'rejected'].indexOf(sv) !== -1 ? sv : 'pending';
        const sl = sc === 'verified' ? '✓' : (sc === 'rejected' ? '✕' : '⏳');

        return `
          <div class="player ${isCaptain ? 'player--captain' : ''}">
            <div class="player-avatar">${escapeHTML(initials(ign))}${isCaptain ? '<span class="player-crown" aria-label="Captain">👑</span>' : ''}</div>
            <div class="player-content">
              <div class="player-row">
                <span class="player-ign">${escapeHTML(ign)}</span>
                <span class="player-role ${isCaptain ? 'player-role--captain' : ''}">${escapeHTML(roleText)}</span>
              </div>
              ${realName ? `<div class="player-real">${escapeHTML(realName)}</div>` : ''}
              ${tags.length ? `<div class="player-tags">${tags.join('')}</div>` : ''}
            </div>
            <span class="player-status player-status--${sc}" title="${sc}">${sl}</span>
          </div>`;
      }).join('') + '</div>';
    }
    focusModalClose('rm-close');
  }

  function closeRosterModal() {
    const backdrop = document.getElementById('rosterBackdrop');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    state.currentTeamForModal = null;
    if (state.lastFocusedBeforeModal) {
      try { state.lastFocusedBeforeModal.focus(); } catch (_) {}
      state.lastFocusedBeforeModal = null;
    }
  }

  /* ============ SIMILAR ============ */
  function renderSimilar(allTournaments) {
    if (!allTournaments || !state.tournament) return;
    const others = allTournaments
      .filter(t => String(t.TournamentID) !== String(state.tournament.TournamentID))
      .filter(t => String(t.Status || '').toLowerCase() !== 'archived')
      .slice(0, 8);

    if (!others.length) return;

    const card = document.getElementById('similar-card');
    const list = document.getElementById('similar');
    if (!card || !list) return;
    card.style.display = '';
    list.innerHTML = others.map(t => `
      <a href="tournament.html?tid=${encodeURIComponent(t.TournamentID)}" class="similar-card">
        <div class="similar-card-title">${escapeHTML(t.Name || 'Tournament')}</div>
        <div class="similar-card-meta">${escapeHTML(gameName(t.GameID))} · ${escapeHTML(String(t.Status || '').toUpperCase())}</div>
      </a>`).join('');
  }

  /* ============ TABS ============ */
  function activateTab(name) {
    const tabs = Array.from(document.querySelectorAll('.tabs-tab'));
    const panels = Array.from(document.querySelectorAll('.panel'));
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => {
      const on = p.dataset.panel === name;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
  }

  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll('.tabs-tab'));
    tabs.forEach(tab => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
      tab.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(tab);
        let next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); activateTab(next.dataset.tab); next.focus(); }
      });
    });
  }

  /* ============ SHARE ============ */
  function setupShare() {
    const btn = document.getElementById('hero-share');
    if (btn) {
      btn.addEventListener('click', async () => {
        const url = window.location.href;
        const title = state.tournament?.Name || 'BCE Esports Tournament';
        const text = `Check out ${title} on BCE Esports!`;
        if (navigator.share) {
          try { await navigator.share({ title, text, url }); return; } catch (_) {}
        }
        try { await navigator.clipboard.writeText(url); toast('Link copied', 'success'); }
        catch (_) { toast('Could not copy', 'error'); }
      });
    }
    document.querySelectorAll('.share-btn').forEach(b => {
      b.addEventListener('click', async () => {
        const type = b.dataset.share;
        const url = window.location.href;
        const title = state.tournament?.Name || 'BCE Esports Tournament';
        const text = `Check out ${title} on BCE Esports!`;
        try {
          if (type === 'copy') {
            await navigator.clipboard.writeText(url);
            toast('Link copied', 'success');
          } else if (type === 'whatsapp') {
            window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank');
          } else if (type === 'twitter') {
            window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank');
          }
        } catch (_) { toast('Could not share', 'error'); }
      });
    });
  }

  /* ============ STICKY CTA ============ */
  function setupStickyCTA() {
    const hero = document.querySelector('.hero');
    const sticky = document.getElementById('sticky-cta');
    if (!hero || !sticky) return;
    if (!('IntersectionObserver' in window)) {
      if (window.innerWidth <= 768) {
        window.addEventListener('scroll', () => {
          if (window.scrollY > 400 && state.registrationOpen) sticky.classList.add('is-visible');
          else sticky.classList.remove('is-visible');
        }, { passive: true });
      }
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        sticky.classList.toggle('is-visible', !entry.isIntersecting && state.registrationOpen);
      });
    }, { threshold: 0 });
    obs.observe(hero);
  }

  /* ============ SCROLL PROGRESS ============ */
  function setupScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const h = document.documentElement.scrollHeight - window.innerHeight;
          const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
          bar.style.width = pct + '%';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ============ REVEAL ============ */
  function setupReveal() {
    document.documentElement.classList.add('js-enabled');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-revealed'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));
  }

  /* ============ FAQ ============ */
  function setupFAQ() {
    document.querySelectorAll('.faq-q').forEach(q => {
      q.addEventListener('click', () => {
        const expanded = q.getAttribute('aria-expanded') === 'true';
        const answer = q.nextElementSibling;
        q.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (answer) {
          if (expanded) answer.style.maxHeight = '0';
          else answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    });
  }

  /* ============ THEME ============ */
  function setupTheme() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    let theme = 'dark';
    try { theme = localStorage.getItem('bce:theme') || 'dark'; } catch (_) {}
    document.documentElement.setAttribute('data-theme', theme);
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('bce:theme', next); } catch (_) {}
    });
  }

  /* ============ MODALS ============ */
  function setupModals() {
    const rmClose = document.getElementById('rm-close');
    const rmBackdrop = document.getElementById('rosterBackdrop');
    const mmClose = document.getElementById('mm-close');
    const mmBackdrop = document.getElementById('matchBackdrop');
    if (rmClose) rmClose.addEventListener('click', closeRosterModal);
    if (rmBackdrop) rmBackdrop.addEventListener('click', (e) => { if (e.target === rmBackdrop) closeRosterModal(); });
    if (mmClose) mmClose.addEventListener('click', closeMatchModal);
    if (mmBackdrop) mmBackdrop.addEventListener('click', (e) => { if (e.target === mmBackdrop) closeMatchModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeRosterModal();
        closeMatchModal();
      }
    });
  }

  /* ============ KEYBOARD ============ */
  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (document.body.classList.contains('modal-open')) return;
      const k = e.key.toLowerCase();
      if (k === 'r' && state.registrationOpen) {
        window.location.href = 'register.html?tid=' + encodeURIComponent(tournamentId);
      } else if (k === 's') {
        const shareBtn = document.getElementById('hero-share');
        if (shareBtn) shareBtn.click();
      } else if (k === '1') activateTab('overview');
      else if (k === '2') activateTab('schedule');
      else if (k === '3') activateTab('standings');
      else if (k === '4') activateTab('teams');
    });
  }

  /* ============ ERROR ============ */
  function showError(message) {
    const banner = document.getElementById('errorBanner');
    const text = document.getElementById('errorText');
    if (text) text.textContent = message || 'Something went wrong.';
    if (banner) banner.classList.add('is-visible');
  }
  function hideError() {
    const banner = document.getElementById('errorBanner');
    if (banner) banner.classList.remove('is-visible');
  }
  function setupRetry() {
    const btn = document.getElementById('retryBtn');
    if (btn) btn.addEventListener('click', () => {
      hideError();
      state.athletesByTeam = null;
      init();
    });
  }

  /* ============ INIT ============ */
  function init() {
    if (!tournamentId) {
      showError('No tournament ID in the URL. Return to the tournaments page to pick one.');
      document.body.classList.add('is-ready');
      return;
    }

    loadWithCache({
      action: 'getGames',
      cacheKey: 'games',
      ttl: CACHE_TTL.games,
      onData: (list) => {
        (list || []).forEach(g => {
          const id = String(g.GameID != null ? g.GameID : '').trim();
          if (id) state.gamesMap[id] = g.Name || id;
        });
        if (state.tournament) {
          setText('hero-game', gameName(state.tournament.GameID));
          setText('info-game', gameName(state.tournament.GameID));
        }
      }
    });

    loadWithCache({
      action: 'getTournament',
      params: { id: tournamentId },
      cacheKey: `tournament:${tournamentId}`,
      ttl: CACHE_TTL.tournament,
      onData: (t) => {
        if (!t) { showError('Tournament not found.'); return; }
        state.tournament = t;
        hideError();
        document.body.classList.add('is-ready');
        renderHero(t);
        renderStats(t);
        renderOverview(t);
      },
      onError: (err) => showError(err.message || 'Could not load tournament details.')
    });

    loadWithCache({
      action: 'getMatches',
      params: { tournamentId },
      cacheKey: `matches:${tournamentId}`,
      ttl: CACHE_TTL.matches,
      onData: (rows) => renderSchedule(rows)
    });

    loadWithCache({
      action: 'getStandings',
      params: { tournamentId },
      cacheKey: `standings:${tournamentId}`,
      ttl: CACHE_TTL.standings,
      onData: (rows) => renderStandings(rows)
    });

    loadWithCache({
      action: 'getTournamentTeams',
      params: { tournamentId },
      cacheKey: `teams:${tournamentId}`,
      ttl: CACHE_TTL.teams,
      onData: (rows) => renderTeams(rows)
    });

    loadAthletesOnce().then(() => {
      if (state.teams.length) renderTeams(state.teams);
    });

    loadWithCache({
      action: 'getTournaments',
      cacheKey: 'all-tournaments',
      ttl: CACHE_TTL.allTournaments,
      onData: (list) => renderSimilar(list)
    });
  }

  /* ============ BOOT ============ */
  function boot() {
    setupScrollProgress();
    setupReveal();
    setupTabs();
    setupShare();
    setupModals();
    setupStickyCTA();
    setupRetry();
    setupFAQ();
    setupTheme();
    setupKeyboard();
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
