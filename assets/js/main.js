/**
 * BCE ESPORTS — MAIN SHARED JAVASCRIPT
 * Auto-injects standard navbar + footer quick buttons on every page.
 */
(function () {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbyr1jpPFtXFh2H6n9TV123vz8NOEsoOTBl6NHSLTG662vmvh2M-5VZIRs1Lri3s6QSnnw/exec';

  /* ============================================================
     NAVIGATION — EDIT HERE TO CHANGE NAV ACROSS ALL PAGES
     ============================================================ */
  const NAV_ITEMS = [
    { label: 'Home',         href: 'index.html' },
    { label: 'About',        href: 'about.html' },
    { label: 'Tournaments',  href: 'tournaments.html' },
    { label: 'Teams',        href: 'teams.html' },
    { label: 'Results',      href: 'results.html' },
    { label: 'Leaderboard',  href: 'leaderboard.html' },
    { label: 'Certificates', href: 'certificates.html' },
    { label: 'News',         href: 'news.html' },
    { label: 'Contact',      href: 'contact.html' }
  ];

  // Pages that should highlight a different nav item
  const ACTIVE_PAGE_MAP = {
    'tournament.html': 'tournaments.html'
  };

  /* ============ HELPERS ============ */

  function escapeHTML(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function safeGradient(v) {
    const s = String(v || '').trim();
    if (/^linear-gradient\([a-zA-Z0-9#%,.\s()\-]+\)$/i.test(s)) return s;
    return 'linear-gradient(135deg,#e10600,#7a0400)';
  }

  function initials(name) {
    const s = String(name || '').trim();
    if (!s) return '??';
    const p = s.split(/\s+/);
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
    return s.slice(0, 2).toUpperCase();
  }

  function formatDate(v) {
    if (!v) return 'TBA';
    const d = new Date(v);
    if (isNaN(d.getTime())) return 'TBA';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function formatPrizeShort(n) {
    n = Number(n) || 0;
    if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return String(n);
  }

  /* ============ NETWORK ============ */

  async function fetchJSON(action) {
    const response = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, { redirect: 'follow' });
    if (!response.ok) throw new Error(`${action} failed (${response.status})`);
    const result = await response.json();
    if (!result || result.success !== true || !Array.isArray(result.data)) {
      throw new Error((result && result.message) || `Invalid response from ${action}`);
    }
    return result.data;
  }

  async function fetchJSONWithParams(action, params) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const response = await fetch(`${API_URL}?${qs}`, { redirect: 'follow' });
    if (!response.ok) throw new Error(`${action} failed (${response.status})`);
    const result = await response.json();
    if (!result || result.success !== true || !Array.isArray(result.data)) {
      throw new Error((result && result.message) || `Invalid response from ${action}`);
    }
    return result.data;
  }

  async function fetchConfig() {
    try {
      const response = await fetch(`${API_URL}?action=getConfig`, { redirect: 'follow' });
      const result = await response.json();
      if (!result || result.success !== true) return {};
      return result.data || {};
    } catch (e) {
      return {};
    }
  }

  /* ============ NAV AUTO-INJECT ============ */

  function renderNav() {
    const navInner = document.querySelector('.nav .nav-inner');
    if (!navInner) return;

    const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const activeHref = ACTIVE_PAGE_MAP[path] || path;

    const linksHTML = NAV_ITEMS.map(item => {
      const isActive = item.href.toLowerCase() === activeHref;
      return `<a href="${item.href}" class="nav-link${isActive ? ' active' : ''}">${escapeHTML(item.label)}</a>`;
    }).join('');

    navInner.innerHTML = `
      <a href="index.html" class="logo" aria-label="BCE Esports Home">
        <div class="logo-mark">B</div>
        <div class="logo-text">
          <span class="logo-main">BCE</span>
          <span class="logo-sub">ESPORTS</span>
        </div>
      </a>
      <div class="nav-links" id="navLinks">
        ${linksHTML}
        <a href="register.html" class="nav-cta btn btn-primary btn-sm">Register</a>
      </div>
      <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation menu">
        <svg fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24">
          <path d="M3 6h18M3 12h18M3 18h18"/>
        </svg>
      </button>
    `;
  }

  /* ============ FOOTER QUICK BUTTONS AUTO-INJECT ============ */

  function renderFooterQuickLinks() {
    const footer = document.querySelector('.footer');
    if (!footer) return;
    if (footer.querySelector('.footer-quick-links')) return;

    const footerBottom = footer.querySelector('.footer-bottom');
    if (!footerBottom) return;

    const quickLinks = document.createElement('div');
    quickLinks.className = 'footer-quick-links';
    quickLinks.innerHTML = `
      <a href="index.html#reg-status" class="footer-quick-btn">
        <span>📋</span> Check Registration Status
      </a>
      <a href="gallery.html" class="footer-quick-btn">
        <span>🖼️</span> Browse Gallery
      </a>
    `;

    footerBottom.parentNode.insertBefore(quickLinks, footerBottom);
  }

  /* ============ NAV TOGGLE ============ */

  function setupNavToggle() {
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    if (!navToggle || !navLinks) return;
    navToggle.addEventListener('click', () => navLinks.classList.toggle('active'));
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('active'));
    });
  }

  /* ============ REVEAL OBSERVER ============ */

  function setupReveal() {
    const revealEls = document.querySelectorAll('.reveal');
    if (!revealEls.length) return;
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => revealObserver.observe(el));
  }

  /* ============ EXPOSE ============ */

  window.MAIN = {
    API_URL,
    escapeHTML,
    safeGradient,
    initials,
    formatDate,
    formatPrizeShort,
    fetchJSON,
    fetchJSONWithParams,
    fetchConfig,
    NAV_ITEMS
  };

  /* ============ INIT ============ */
  renderNav();
  renderFooterQuickLinks();
  setupNavToggle();
  setupReveal();
})();
