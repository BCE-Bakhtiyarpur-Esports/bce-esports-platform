/**
 * BCE ESPORTS — MAIN SHARED JAVASCRIPT
 * Used by all public pages. Exposes helpers via window.MAIN.
 */
(function () {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbyr1jpPFtXFh2H6n9TV123vz8NOEsoOTBl6NHSLTG662vmvh2M-5VZIRs1Lri3s6QSnnw/exec';

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
    fetchConfig
  };

  /* ============ INIT (DOM already loaded, scripts at end of body) ============ */
  setupNavToggle();
  setupReveal();
})();