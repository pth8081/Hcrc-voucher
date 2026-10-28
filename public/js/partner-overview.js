requireAuth();
renderTopbar('partner-overview');

const notAdminNotice = document.getElementById('notAdminNotice');
const overviewCard = document.getElementById('overviewCard');
const partnerList = document.getElementById('partnerList');

const STATE_LABELS = {
  active: '<span class="status-badge status-unused">ĐANG HOẠT ĐỘNG</span>',
  not_yet_active: '<span class="status-badge status-other">CHƯA KÍCH HOẠT</span>',
  expired: '<span class="status-badge status-used">ĐÃ HẾT HẠN</span>',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

(async function init() {
  let data;
  try {
    data = await apiFetch('/partner-overview');
  } catch (err) {
    notAdminNotice.classList.remove('hidden');
    overviewCard.classList.add('hidden');
    return;
  }
  render(data);
})();

function render(partners) {
  if (!partners.length) {
    partnerList.innerHTML = '<div class="card"><p class="text-muted m-0">Chưa có đối tác (kết nối API) nào được khai báo.</p></div>';
    return;
  }

  partnerList.innerHTML = partners.map((p, i) => renderPartnerCard(p, i)).join('');

  document.querySelectorAll('[data-toggle]').forEach((head) => {
    head.addEventListener('click', () => {
      const card = head.closest('.partner-overview-card');
      const expanded = card.dataset.expanded === 'true';
      card.dataset.expanded = expanded ? 'false' : 'true';
      const body = card.querySelector('.partner-overview-body');
      const btn = head.querySelector('.partner-overview-toggle-btn');
      if (body) body.classList.toggle('hidden', expanded);
      if (btn) btn.textContent = expanded ? 'Xem chi tiết' : 'Thu gọn';
    });
  });
}

function renderPartnerCard(p, index) {
  const hasData = p.companyCount > 0 || p.accountCount > 0;
  const statusBadge = p.isLocked
    ? '<span class="status-badge status-used">ĐÃ KHOÁ</span>'
    : '<span class="status-badge status-unused">ĐANG HOẠT ĐỘNG</span>';

  const statsHtml = hasData
    ? `
      <span><strong>${p.companyCount}</strong> công ty</span>
      <span><strong>${p.unitCount}</strong> điểm tiêu</span>
      <span><strong>${p.accountCount}</strong> tài khoản</span>`
    : '<span class="text-muted">Chưa có công ty/điểm tiêu/tài khoản nào</span>';

  const expandBtn = hasData
    ? `<button type="button" class="btn-secondary partner-overview-toggle-btn">Xem chi tiết</button>`
    : `<button type="button" class="btn-secondary partner-overview-toggle-btn" disabled>Xem chi tiết</button>`;

  return `
    <div class="card">
      <div class="partner-overview-card" data-expanded="false">
        <div class="partner-overview-head" data-toggle>
          <div class="partner-overview-title">
            <strong>${escapeHtml(p.name)}</strong>
            ${statusBadge}
          </div>
          <div class="partner-overview-stats">${statsHtml}</div>
          ${expandBtn}
        </div>
        ${hasData ? `<div class="partner-overview-body hidden">${renderPartnerBody(p)}</div>` : ''}
      </div>
    </div>`;
}

function renderPartnerBody(p) {
  const companiesHtml = p.companies.length
    ? `
      <h4>Công ty &amp; điểm tiêu</h4>
      <div class="table-wrap table-responsive">
      <table>
        <thead><tr><th>Công ty</th><th>Điểm tiêu</th><th>Địa điểm</th><th>Trạng thái</th></tr></thead>
        <tbody>${p.companies.map(renderCompanyRows).join('')}</tbody>
      </table>
      </div>`
    : '<p class="text-muted">Chưa có công ty nào.</p>';

  const accountsHtml = p.accounts.length
    ? `
      <h4 class="mt-20">Tài khoản</h4>
      <div class="table-wrap table-responsive">
      <table>
        <thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th></tr></thead>
        <tbody>${p.accounts.map(renderAccountRow).join('')}</tbody>
      </table>
      </div>`
    : '<p class="text-muted mt-20">Chưa có tài khoản nào.</p>';

  return companiesHtml + accountsHtml;
}

function renderCompanyRows(c) {
  const companyLabel = `${escapeHtml(c.companyName)}${c.status ? '' : ' <span class="status-badge status-used">NGỪNG HỢP TÁC</span>'}`;
  if (!c.units.length) {
    return `
      <tr>
        <td data-label="Công ty">${companyLabel}</td>
        <td data-label="Điểm tiêu" class="text-muted">-</td>
        <td data-label="Địa điểm" class="text-muted">-</td>
        <td data-label="Trạng thái" class="text-muted">-</td>
      </tr>`;
  }
  return c.units
    .map(
      (u, i) => `
      <tr>
        <td data-label="Công ty">${i === 0 ? companyLabel : ''}</td>
        <td data-label="Điểm tiêu">${escapeHtml(u.partnerName)}</td>
        <td data-label="Địa điểm">${escapeHtml(u.locationName || '-')}</td>
        <td data-label="Trạng thái">${u.status ? '<span class="status-badge status-unused">HOẠT ĐỘNG</span>' : '<span class="status-badge status-used">NGỪNG HỢP TÁC</span>'}</td>
      </tr>`
    )
    .join('');
}

function renderAccountRow(a) {
  const role = a.isPartnerAdmin
    ? '<span class="status-badge status-other">Quản trị đối tác</span>'
    : 'Nhân viên';
  const state = a.isDeleted
    ? '<span class="status-badge status-used">ĐÃ XÓA</span>'
    : STATE_LABELS[a.state] || '-';
  return `
    <tr>
      <td data-label="Tên đăng nhập">${escapeHtml(a.username)}</td>
      <td data-label="Họ tên">${escapeHtml(a.fullName || '-')}</td>
      <td data-label="Vai trò">${role}</td>
      <td data-label="Trạng thái">${state}</td>
    </tr>`;
}
