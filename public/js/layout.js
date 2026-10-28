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
  adminLog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  guide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V6a2 2 0 0 1 2-2h13v15.5"/><path d="M6 22a2 2 0 0 1-2-2.5C4 18.5 5 18 6 18h13"/><path d="M9 8h7M9 11h5"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  partners: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="7" height="11"/><rect x="14" y="6" width="7" height="15"/><path d="M6 14h1M6 17h1M17 10h1M17 13h1M17 16h1"/></svg>',
};

const MENU_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';

// permission: null/undefined = luon hien (moi tai khoan); ten khac = phai co
// user.permissions[ten] = true moi hien (xem authService.js#issueSession - quyen duoc "chup"
// vao session luc dang nhap, khong can goi them API o day).
const NAV_ITEMS = [
  { key: 'scan', href: '/index.html', label: 'Quét voucher', icon: NAV_ICONS.scan, permission: 'canRedeemVoucher' },
  { key: 'report', href: '/report.html', label: 'Báo cáo đối soát', icon: NAV_ICONS.report, permission: 'canViewReconciliation' },
  { key: 'summary-report', href: '/summary-report.html', label: 'Báo cáo tổng hợp', icon: NAV_ICONS.summaryReport, permission: 'canViewSummary' },
  { key: 'used-vouchers', href: '/used-vouchers.html', label: 'Voucher đã sử dụng', icon: NAV_ICONS.usedVouchers, permission: 'canViewUsedVouchers' },
  { key: 'guide-business', href: '/guide-business.html', label: 'Hướng dẫn nghiệp vụ', icon: NAV_ICONS.guide, permission: 'canViewBusinessGuide' },
  { key: 'guide-system', href: '/guide-system.html', label: 'Hướng dẫn hệ thống', icon: NAV_ICONS.guide, permission: 'canViewSystemGuide' },
  // M16: chi hien voi tai khoan duoc gan quan tri gioi han theo 1 he thong voucher (vd Fuji) -
  // xem requirePartnerAdmin.js/partnerAdminService.js. Tai khoan quan tri day du KHONG co quyen
  // nay (permissions.isPartnerAdmin luon false - xem permissionService.js#ADMIN_PERMISSIONS) nen
  // muc nay tu an voi ho, khong trung lap voi man hinh "Tai khoan" day du da co san.
  { key: 'partner-admin', href: '/partner-admin.html', label: 'Quản trị đối tác', icon: NAV_ICONS.users, permission: 'isPartnerAdmin' },
  // v3.84: quyen RIENG (khong con la "chi can xem 1 trong 3 bao cao" nhu truoc) - mac dinh TAT
  // cho nhan vien thuong, tu dong BAT cho Quan tri doi tac/Quan tri day du - xem permissionService.js.
  // Server (emailSchedule.routes.js) con doi hoi THEM dieu kien co quyen xem bao cao, nhung o day
  // chi can kiem tra DUNG quyen nay la du de quyet dinh an/hien menu (truong hop co quyen nay ma
  // khong co quyen bao cao nao la hiem, HCRC/doi tac se cap ca 2 cung luc trong thuc te).
  { key: 'email-schedules', href: '/email-schedules.html', label: 'Lịch gửi email báo cáo', icon: NAV_ICONS.email, permission: 'canManageEmailSchedules' },
  { key: 'security', href: '/security.html', label: 'Bảo mật', icon: NAV_ICONS.security },
];

// Chi hien voi tai khoan quan tri (role === 'admin'), gom vao 1 dropdown "Quan tri" thay vi
// nam rai rac ngang hang voi cac muc tren - tranh topbar qua dai khi them tinh nang moi.
// M20 (v3.81): moi muc them `permission` - 1 trong 5 quyen rieng cua tung man hinh "Quan tri"
// (adminCanManageUnits/...Connections/...Users/ViewAdminLog/...EmailSettings), mac dinh TRUE cho
// moi tai khoan Quan tri dang co san (xem permissionService.js) - khong doi gi tren giao dien tru
// khi co 1 Quan tri khac chu dong bo tick mot muc cu the cho 1 tai khoan nao do.
const ADMIN_NAV_ITEMS = [
  { key: 'units', href: '/units.html', label: 'Đơn vị thu hồi', icon: NAV_ICONS.units, permission: 'adminCanManageUnits' },
  { key: 'connection', href: '/api-connection.html', label: 'Kết nối API', icon: NAV_ICONS.connection, permission: 'adminCanManageConnections' },
  // Man hinh CHI DOC (khong co thao tac sua/xoa) - server mo cho MOI tai khoan Quan tri day du,
  // khong doi hoi 1 quyen AdminCanXxx rieng (xem partnerOverview.routes.js). KHONG the bo trong
  // `permission` o day du vay: hasPermission() coi "khong khai bao permission" la LUON hien, bat
  // ke role - se vo tinh lo muc nay ra ca menu cua tai khoan NHAN VIEN thuong (role=0, chi bi chan
  // o server, van thay duoc muc trong menu). Dung tam 5 quyen AdminCanXxx hien co (OR - co it nhat
  // 1 quyen la du, giong muc "email-schedules" o tren) de chi hien dung cho tai khoan Quan tri -
  // 1 tai khoan Quan tri binh thuong (chua bi thu het ca 5 quyen man hinh con) van thay du.
  {
    key: 'partner-overview',
    href: '/partner-overview.html',
    label: 'Quản lý đối tác',
    icon: NAV_ICONS.partners,
    permission: ['adminCanManageUnits', 'adminCanManageConnections', 'adminCanManageUsers', 'adminCanViewAdminLog', 'adminCanManageEmailSettings'],
  },
  { key: 'users', href: '/users.html', label: 'Tài khoản', icon: NAV_ICONS.users, permission: 'adminCanManageUsers' },
  { key: 'admin-log', href: '/admin-log.html', label: 'Nhật ký hệ thống', icon: NAV_ICONS.adminLog, permission: 'adminCanViewAdminLog' },
  { key: 'email-settings', href: '/email-settings.html', label: 'Thiết lập email', icon: NAV_ICONS.email, permission: 'adminCanManageEmailSettings' },
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

  // Quyen "chup" san trong session luc dang nhap (authService.js#issueSession) - phien dang
  // nhap TU TRUOC ban cap nhat nay chua co cac truong nay, coi nhu "chua ro" va HIEN het (chi
  // anh huong giao dien, server van chan dung qua requireFeature.js/requireRole.js du sao).
  const permissions = user && user.permissions ? user.permissions : null;
  const role = user && user.role ? user.role : null;
  // item.permission co the la 1 chuoi (phai co DUNG quyen do) hoac 1 mang (OR - co IT NHAT 1
  // trong cac quyen do la du, vd muc "Lich gui email bao cao" dung chung ca 3 loai bao cao).
  const hasPermission = (item) => {
    if (!item.permission || !permissions) return true;
    const required = Array.isArray(item.permission) ? item.permission : [item.permission];
    return required.some((p) => permissions[p]);
  };
  const visibleNavItems = NAV_ITEMS.filter(hasPermission);
  // M20 (v3.81): truoc day showAdminMenu chi dua vao role !== 'staff' (moi tai khoan Quan tri
  // luon thay du ca 5 muc) - gio loc THEM tung muc theo quyen rieng (adminCanManageUnits/...),
  // an ca dropdown "Quan tri" neu khong con muc nao duoc phep (vd 1 tai khoan Quan tri bi bo tick
  // het ca 5, tuy hiem nhung van co the xay ra).
  const visibleAdminNavItems = role !== 'staff' ? ADMIN_NAV_ITEMS.filter(hasPermission) : [];
  const showAdminMenu = visibleAdminNavItems.length > 0;
  const adminMenuActive = ADMIN_NAV_ITEMS.some((item) => item.key === activeKey);

  mount.outerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <a href="/index.html" class="brand">
          <span class="brand-mark">${BRAND_MARK_SVG(30)}</span>
          <span>
            <span class="brand-word">HCRC</span>
            <span class="brand-tagline">Thu hồi voucher</span>
          </span>
        </a>
        <button type="button" class="topbar-toggle" id="topbarToggle" aria-label="Mở menu" aria-expanded="false">
          ${MENU_ICON}
        </button>
        <div class="topbar-panel" id="topbarPanel">
          <nav class="nav-links">
            ${visibleNavItems.map(
              (item) => `
              <a href="${item.href}" class="nav-link ${item.key === activeKey ? 'active' : ''}">
                ${item.icon}<span>${item.label}</span>
              </a>`
            ).join('')}
            ${showAdminMenu ? `
            <div class="nav-dropdown">
              <button type="button" class="nav-link nav-dropdown-trigger ${adminMenuActive ? 'active' : ''}" id="adminMenuTrigger" aria-expanded="false">
                ${NAV_ICONS.units}<span>Quản trị</span>${NAV_ICONS.chevron}
              </button>
              <div class="nav-dropdown-panel" id="adminMenuPanel">
                ${visibleAdminNavItems.map(
                  (item) => `
                  <a href="${item.href}" class="nav-link ${item.key === activeKey ? 'active' : ''}">
                    ${item.icon}<span>${item.label}</span>
                  </a>`
                ).join('')}
              </div>
            </div>` : ''}
          </nav>
          <div class="topbar-user">
            <div class="user-avatar">${initials(displayName)}</div>
            <div class="user-meta">
              <span class="user-name">${escapeHtmlLayout(displayName)}</span>
              <span>
                <a href="/security.html" id="webauthnRegisterLink" class="user-logout">Cài vân tay/Face ID</a>
                &middot;
                <a href="#" id="logoutLink" class="user-logout">Đăng xuất</a>
                &middot;
                <span id="versionBadge" class="version-badge"></span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;

  if (typeof renderVersionBadge === 'function') renderVersionBadge();

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

  const adminMenuTrigger = document.getElementById('adminMenuTrigger');
  const adminMenuPanel = document.getElementById('adminMenuPanel');
  if (adminMenuTrigger && adminMenuPanel) {
    adminMenuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = adminMenuPanel.classList.toggle('open');
      adminMenuTrigger.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', (e) => {
      if (!adminMenuPanel.classList.contains('open')) return;
      if (adminMenuPanel.contains(e.target) || adminMenuTrigger.contains(e.target)) return;
      adminMenuPanel.classList.remove('open');
      adminMenuTrigger.setAttribute('aria-expanded', 'false');
    });
  }

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
