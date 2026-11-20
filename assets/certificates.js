/**
 * BCE ESPORTS — Public Certificate Verification
 */
(function () {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbyr1jpPFtXFh2H6n9TV123vz8NOEsoOTBl6NHSLTG662vmvh2M-5VZIRs1Lri3s6QSnnw/exec';

  const inputEl  = document.getElementById('certIdInput');
  const formEl   = document.getElementById('verifyForm');
  const btnEl    = document.getElementById('verifyBtn');
  const resultEl = document.getElementById('resultArea');

  if (!formEl || !inputEl || !btnEl || !resultEl) return;

  function escapeHTML(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function setLoading(on) {
    if (on) { btnEl.disabled = true; btnEl.textContent = 'Verifying…'; }
    else    { btnEl.disabled = false; btnEl.textContent = 'Verify →'; }
  }

  function renderLoading() {
    resultEl.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <div class="loading-text">Verifying Certificate…</div>
      </div>`;
  }

  function renderError(title, message, icon) {
    resultEl.innerHTML = `
      <div class="error-state">
        <span class="error-icon">${icon || '⚠️'}</span>
        <h3 class="error-title">${escapeHTML(title)}</h3>
        <p class="error-msg">${escapeHTML(message)}</p>
        <button type="button" class="btn btn-outline" id="retryBtn">Try Again</button>
      </div>`;
    document.getElementById('retryBtn')?.addEventListener('click', () => {
      resultEl.innerHTML = '';
      inputEl.value = '';
      inputEl.focus();
    });
  }

  function renderCertificate(data) {
    const isRevoked = String(data.status || '').toLowerCase() === 'revoked';
    const bannerClass = isRevoked ? 'revoked' : 'valid';
    const iconChar = isRevoked ? '⚠' : '✓';
    const statusLabel = isRevoked ? 'REVOKED' : 'VALID';
    const badgeClass = isRevoked ? 'badge-revoked' : 'badge-valid';

    const previewHTML = renderPreview(data);

    const downloadHTML = isRevoked
      ? `<button type="button" class="btn btn-outline download-btn" disabled style="opacity:.5;cursor:not-allowed">
           <span class="icon">🚫</span> Certificate Revoked
         </button>`
      : (data.hasFile
          ? `<button type="button" class="btn btn-primary download-btn" id="downloadBtn">
               <span class="icon">⬇</span> Download Certificate
             </button>`
          : `<button type="button" class="btn btn-outline download-btn" disabled style="opacity:.5;cursor:not-allowed">
               <span class="icon">📄</span> No File Attached
             </button>`);

    resultEl.innerHTML = `
      <div class="cert-card">
        <div class="cert-banner ${bannerClass}">
          <div class="status-icon ${bannerClass}">${iconChar}</div>
          <div class="banner-text">
            <h2>${isRevoked ? 'Certificate Revoked' : 'Certificate Verified'}</h2>
            <p>${isRevoked ? 'This certificate is no longer valid.' : 'This is an authentic BCE ESPORTS certificate.'}</p>
          </div>
        </div>
        <div class="cert-body">
          <div class="cert-grid">
            <div class="cert-preview-col">
              ${previewHTML}
              <div id="qrContainer" style="display:none">
                <div class="qr-wrap" id="qrWrap"></div>
                <div class="qr-caption">Scan to Verify</div>
              </div>
            </div>
            <div class="cert-details-col">
              <h3>Certificate Details</h3>
              <div class="detail-row">
                <span class="detail-label">Certificate ID</span>
                <span class="detail-value mono">${escapeHTML(data.certificateId)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Recipient</span>
                <span class="detail-value">${escapeHTML(data.recipientName || '—')}</span>
              </div>
              ${data.teamName ? `
              <div class="detail-row">
                <span class="detail-label">Team</span>
                <span class="detail-value">${escapeHTML(data.teamName)}</span>
              </div>` : ''}
              ${data.tournamentName ? `
              <div class="detail-row">
                <span class="detail-label">Tournament</span>
                <span class="detail-value">${escapeHTML(data.tournamentName)}</span>
              </div>` : ''}
              ${data.gameName ? `
              <div class="detail-row">
                <span class="detail-label">Game</span>
                <span class="detail-value">${escapeHTML(data.gameName)}</span>
              </div>` : ''}
              ${data.achievement ? `
              <div class="detail-row">
                <span class="detail-label">Achievement</span>
                <span class="detail-value">${escapeHTML(data.achievement)}</span>
              </div>` : ''}
              ${data.certificateType ? `
              <div class="detail-row">
                <span class="detail-label">Type</span>
                <span class="detail-value">${escapeHTML(data.certificateType)}</span>
              </div>` : ''}
              <div class="detail-row">
                <span class="detail-label">Issue Date</span>
                <span class="detail-value">${escapeHTML(formatDate(data.issueDate))}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value"><span class="badge ${badgeClass}">${statusLabel}</span></span>
              </div>
              <div class="cert-actions">${downloadHTML}</div>
              ${isRevoked ? `
                <div class="revoked-note">
                  <span class="icon">⚠️</span>
                  <span>This certificate has been revoked by BCE ESPORTS administration and cannot be downloaded. If you believe this is an error, please contact us.</span>
                </div>` : ''}
            </div>
          </div>
        </div>
      </div>`;

    try { renderQRCode(data.certificateId); } catch (e) {}

    const dlBtn = document.getElementById('downloadBtn');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => downloadCertificate(data.certificateId, dlBtn));
    }
  }

  function renderPreview(data) {
    if (!data.hasFile) {
      return `
        <div class="preview-box">
          <span class="preview-icon">📄</span>
          <div class="preview-label">No File</div>
          <div class="preview-hint">This certificate does not have an attached file.</div>
        </div>`;
    }
    const ft = String(data.fileType || '').toLowerCase();
    const isImage = ft === 'png' || ft === 'jpg' || ft === 'jpeg';
    const previewable = !!data.previewAvailable && isImage;

    if (previewable) {
      setTimeout(() => loadPreviewImage(data.certificateId), 300);
      return `<div class="preview-box" id="previewBox">
                <div class="spinner" style="width:32px;height:32px;border-width:2px"></div>
                <div class="preview-label">Loading Preview…</div>
              </div>`;
    }
    if (isImage) {
      return `
        <div class="preview-box">
          <span class="preview-icon">🖼️</span>
          <div class="preview-label">Image Certificate</div>
          <div class="preview-hint">Preview unavailable inline. Download to view.</div>
        </div>`;
    }
    if (ft === 'pdf') {
      return `
        <div class="preview-box">
          <span class="preview-icon">📄</span>
          <div class="preview-label">PDF Certificate</div>
          <div class="preview-hint">Download to view the full document.</div>
        </div>`;
    }
    return `
      <div class="preview-box">
        <span class="preview-icon">📎</span>
        <div class="preview-label">Certificate File</div>
      </div>`;
  }

  async function loadPreviewImage(certificateId) {
    const box = document.getElementById('previewBox');
    if (!box) return;
    try {
      const res = await fetchJSON(API_URL, { action: 'certificate.download', certificateId });
      if (!res.success || !res.data || !res.data.base64) throw new Error('no preview');
      const url = base64ToBlobURL(res.data.base64, res.data.mimeType);
      box.classList.add('has-image');
      box.innerHTML = `<img src="${url}" alt="Certificate Preview" onerror="this.parentElement.innerHTML='<div class=preview-label>Preview Failed</div>'">`;
    } catch (e) {
      box.innerHTML = `
        <span class="preview-icon">🖼️</span>
        <div class="preview-label">Preview Unavailable</div>
        <div class="preview-hint">Click download to view.</div>`;
    }
  }

  function renderQRCode(certificateId) {
    const container = document.getElementById('qrContainer');
    const wrap = document.getElementById('qrWrap');
    if (!container || !wrap || typeof QRCode === 'undefined') return;
    const url = window.location.origin + window.location.pathname + '?id=' + encodeURIComponent(certificateId);
    wrap.innerHTML = '';
    new QRCode(wrap, { text: url, width: 160, height: 160, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    container.style.display = 'block';
  }

  async function downloadCertificate(certificateId, btn) {
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> Preparing…';
    try {
      const res = await fetchJSON(API_URL, { action: 'certificate.download', certificateId });
      if (!res.success || !res.data || !res.data.base64) throw new Error(res.message || 'Download failed');
      triggerBrowserDownload(res.data.base64, res.data.fileName, res.data.mimeType);
      btn.innerHTML = '<span class="icon">✓</span> Downloaded';
      setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 2000);
    } catch (e) {
      alert('Download failed: ' + (e.message || 'Please try again.'));
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  function triggerBrowserDownload(base64, fileName, mimeType) {
    const bytes = base64ToBytes(base64);
    const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'certificate';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function base64ToBytes(base64) {
    const bin = atob(base64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function base64ToBlobURL(base64, mimeType) {
    const bytes = base64ToBytes(base64);
    const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    return URL.createObjectURL(blob);
  }

  async function fetchJSON(url, body) {
    const resp = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    });
    if (!resp.ok) throw new Error('Network error (' + resp.status + ')');
    const text = await resp.text();
    try { return JSON.parse(text); }
    catch (e) { throw new Error('Invalid response from server'); }
  }

  async function verifyCertificate(certId) {
    const id = String(certId || '').trim().toUpperCase();
    if (!id) {
      renderError('Certificate ID Required', 'Please enter a certificate ID to verify.', '🔍');
      return;
    }
    inputEl.value = id;
    setLoading(true);
    renderLoading();
    try {
      const res = await fetchJSON(API_URL, { action: 'certificate.verify', certificateId: id });
      setLoading(false);
      if (!res.success) {
        renderError('Certificate Not Found',
          res.message || 'We could not find a certificate with that ID. Please check and try again.',
          '❌');
        return;
      }
      renderCertificate(res.data);
    } catch (e) {
      setLoading(false);
      renderError('Verification Failed', e.message || 'Network error. Please try again.', '⚠️');
    }
  }

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    verifyCertificate(inputEl.value);
  });

  inputEl.addEventListener('input', () => {
    const pos = inputEl.selectionStart;
    inputEl.value = inputEl.value.toUpperCase();
    inputEl.setSelectionRange(pos, pos);
  });

  const params = new URLSearchParams(window.location.search);
  const autoId = params.get('id');
  if (autoId) {
    inputEl.value = autoId.toUpperCase();
    setTimeout(() => verifyCertificate(autoId), 400);
  }

  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('active'));
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('active'));
    });
  }
})();