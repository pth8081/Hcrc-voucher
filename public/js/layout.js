/** Logo mark HCRC (tui hang mau xanh + quai mau cam, goi nhac bo nhan dien thuong hieu). */
const BRAND_MARK_SVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M11 12.5V9.8a6 6 0 0 1 12 0v2.7" stroke="#ee7d1a" stroke-width="2.6" stroke-linecap="round" fill="none"/>
  <rect x="5" y="12" width="24" height="17" rx="5.5" fill="#56a13a"/>
  <path d="M12.3 20.3c1 1.7 2.9 2.6 4.7 2.6s3.7-.9 4.7-2.6" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`;

const NAV_ICONS = {
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3M7 12h10"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
  units: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V8l8-5 8 5v13M9 21v-6h6v6M4 21h16"/></svg>',
  connection: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15l6-6M11 5l1.5-1.5a3.5 3.5 0 1 1 5 5L16 10M13 19l-1.5 1.5a3.5 3.5 0 1 1-5-5L8 14"/></svg>',
  security: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6M16 9.5c1.4.3 2.5 1.5 2.5 3M14.5 4.2c1.6.4 2.8 1.9 2.8 3.7 0 1.5-.8 2.8-2 3.4"/></svg>',
  summaryReport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
  usedVouchers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4M9 13l2 2 4-4"/></svg>',
};

const MENU_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';

const NAV_ITEMS = [
  { key: 'scan', href: '/index.html', label: 'Quet voucher', icon: NAV_ICONS.scan },
  { key: 'report', href: '/report.html', label: 'Bao cao doi soat', icon: NAV_ICONS.report },
  { key: 'summary-report', href: '/summary-report.html', label: 'Bao cao tong hop', icon: NAV_ICONS.summaryReport },
  { key: 'used-vouchers', href: '/used-vouchers.html', label: 'Voucher da su dung', icon: NAV_ICONS.usedVouchers },
  { key: 'units', href: '/units.html', label: 'Don vi thu hoi', icon: NAV_ICONS.units },
  { key: 'connection', href: '/api-connection.html', label: 'Ket noi API', icon: NAV_ICONS.connection },
  { key: 'security', href: '/security.html', label: 'Bao mat', icon: NAV_ICONS.security },
  { key: 'users', href: '/users.html', label: 'Tai khoan', icon: NAV_ICONS.users },
];

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function renderTopbar(activeKey) {
  const mount = document.getElementById('topbar');
  if (!mount) return;

  if (typeof requireAuth === 'function') requireAuth();
  const user = typeof getUser === 'function' ? getUser() : null;
  const displayName = user ? user.fullName || user.username : '';

  mount.outerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <a href="/index.html" class="brand">
          <span class="brand-mark">${BRAND_MARK_SVG(30)}</span>
          <span>
            <span class="brand-word">HCRC</span>
            <span class="brand-tagline">Thu hoi voucher</span>
          </span>
        </a>
        <button type="button" class="topbar-toggle" id="topbarToggle" aria-label="Mo menu" aria-expanded="false">
          ${MENU_ICON}
        </button>
        <div class="topbar-panel" id="topbarPanel">
          <nav class="nav-links">
            ${NAV_ITEMS.map(
              (item) => `
              <a href="${item.href}" class="nav-link ${item.key === activeKey ? 'active' : ''}">
                ${item.icon}<span>${item.label}</span>
              </a>`
            ).join('')}
          </nav>
          <div class="topbar-user">
            <div class="user-avatar">${initials(displayName)}</div>
            <div class="user-meta">
              <span class="user-name">${escapeHtmlLayout(displayName)}</span>
              <span>
                <a href="/security.html" id="webauthnRegisterLink" class="user-logout">Cai van tay/Face ID</a>
                &middot;
                <a href="#" id="logoutLink" class="user-logout">Dang xuat</a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;

  const topbarToggle = document.getElementById('topbarToggle');
  const topbarPanel = document.getElementById('topbarPanel');
  topbarToggle.addEventListener('click', () => {
    const isOpen = topbarPanel.classList.toggle('open');
    topbarToggle.setAttribute('aria-expanded', String(isOpen));
  });
  document.addEventListener('click', (e) => {
    if (!topbarPanel.classList.contains('open')) return;
    if (topbarPanel.contains(e.target) || topbarToggle.contains(e.target)) return;
    topbarPanel.classList.remove('open');
    topbarToggle.setAttribute('aria-expanded', 'false');
  });

  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    clearSession();
    window.location.href = '/login.html';
  });

  // Dang ky passkey can 1 form binh thuong (khong dung window.prompt() - hop thoai chan nay
  // hay lam trang MAT FOCUS truoc khi trinh duyet kip goi API vân tay/Face ID, gay loi "The
  // document is not focused." tren nhieu dien thoai) nen chi dan huong sang trang "Bao mat"
  // (co san danh sach + form dang ky, xem security.js) thay vi lam ngay tai day.
  const registerLink = document.getElementById('webauthnRegisterLink');
  if (!(typeof webauthnSupported === 'function' && webauthnSupported())) {
    registerLink.style.display = 'none';
  }
}

function escapeHtmlLayout(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
