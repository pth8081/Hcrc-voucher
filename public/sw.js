// Service worker: CHI cache "vo" ung dung (HTML/CSS/JS tinh) de cai dat nhanh + mo lai
// nhanh. KHONG bao gio cache/queue cac request toi /api/ (kiem tra + thu hoi voucher) -
// luon phai qua mang that de xac minh voi Core, tranh mo lai dung rui ro double-spend
// da duoc chan o tang nghiep vu (xem voucherService.js).

const CACHE_NAME = 'hcrc-shell-v8';

const PRECACHE_URLS = [
  '/login.html',
  '/index.html',
  '/units.html',
  '/report.html',
  '/summary-report.html',
  '/used-vouchers.html',
  '/api-connection.html',
  '/security.html',
  '/users.html',
  '/admin-log.html',
  '/2fa-setup.html',
  '/2fa-verify.html',
  '/change-password.html',
  '/css/style.css',
  '/css/api-connection.css',
  '/css/twofa.css',
  '/css/users.css',
  '/css/summary-report.css',
  '/js/api.js',
  '/js/layout.js',
  '/js/login.js',
  '/js/scan.js',
  '/js/units.js',
  '/js/report.js',
  '/js/summary-report.js',
  '/js/used-vouchers.js',
  '/js/api-connection.js',
  '/js/security.js',
  '/js/users.js',
  '/js/admin-log.js',
  '/js/twofa.js',
  '/js/twofa-setup.js',
  '/js/twofa-verify.js',
  '/js/change-password.js',
  '/js/pwa.js',
  '/js/webauthn.js',
  '/js/vendor/simplewebauthn-browser.umd.min.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Khong dong gi voi API - luon di thang ra mang, khong cache, khong fallback offline.
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Chi xu ly tai nguyen cung origin (bo qua Google Fonts/unpkg - de trinh duyet tu cache theo HTTP cache binh thuong).
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first: luon uu tien lay ban MOI NHAT tu mang khi con ket noi (nguoi dung dang mo
  // app thi hau nhu luon co mang, vi con can goi API kiem tra/thu hoi voucher) - cache chi
  // dung lam phuong an du phong khi mat mang. Truoc day dung cache-first (tra cache ngay, cap
  // nhat cache ngam cho LAN SAU) khien nguoi dung phai mo lai app 2 lan moi thay tinh nang moi
  // sau khi deploy ban moi - day chinh la nguyen nhan da gap.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
