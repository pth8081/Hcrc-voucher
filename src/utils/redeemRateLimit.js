// M19: chong gian lan/hack kieu "thu hoi tuan tu that nhanh" bang 1 tai khoan (vd script goi
// thang API lien tuc, moi lan xong ngay lap tuc goi tiep - KHONG bi chan boi withUserScanLock()
// trong voucherService.js, vi khoa do chi chan request CHONG LAP THOI GIAN, khong chan goi tuan
// tu nhanh). Dem so lan THU HOI THANH CONG (khong tinh CHECK, khong tinh cac lan bi tu choi/loi)
// cua tung tai khoan trong 1 cua so thoi gian truot; qua nguong thi tam khoa CA thu hoi lan
// quet cua tai khoan do mot thoi gian - cung mau hinh voi guessGuard.js (bo dem trong bo nho,
// KHONG dung chung giua nhieu worker khi CLUSTER_WORKERS > 1, chap nhan duoc cung ly do da ap
// dung cho guessGuard/loginGuard: moi worker tu gioi han rieng, gioi han THUC TE cao hon N lan
// neu chay nhieu worker, nhung van tot hon KHONG co gioi han gi).
//
// Cau hinh qua .env (xem .env.example), KHONG can sua code de chinh nguong:
//   REDEEM_RATE_LIMIT_ENABLED=true|false        (mac dinh true)
//   REDEEM_RATE_LIMIT_MAX=20                     (toi da N lan thu hoi THANH CONG)
//   REDEEM_RATE_LIMIT_WINDOW_MINUTES=1           (trong cua so M phut gan nhat)
//   REDEEM_RATE_LIMIT_LOCK_MINUTES=5             (tam khoa bao lau neu vuot nguong)

function positiveNumberOrDefault(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const ENABLED = (process.env.REDEEM_RATE_LIMIT_ENABLED ?? 'true') === 'true';
const MAX_REDEEMS = positiveNumberOrDefault(process.env.REDEEM_RATE_LIMIT_MAX, 20);
const WINDOW_MS = positiveNumberOrDefault(process.env.REDEEM_RATE_LIMIT_WINDOW_MINUTES, 1) * 60 * 1000;
const LOCK_MS = positiveNumberOrDefault(process.env.REDEEM_RATE_LIMIT_LOCK_MINUTES, 5) * 60 * 1000;

const state = new Map(); // userId -> { timestamps: number[] (moc thoi gian cac lan thu hoi thanh cong gan day), lockedUntil }

/** Nem loi 429 neu tai khoan dang bi tam khoa do vuot nguong toc do - goi dau redeemVoucher(),
 * TRUOC moi buoc khac (cung vi tri voi guessGuard.assertNotLocked). */
function assertNotLocked(userId) {
  if (!ENABLED) return;
  const s = state.get(userId);
  if (s && s.lockedUntil && Date.now() < s.lockedUntil) {
    const remainSec = Math.ceil((s.lockedUntil - Date.now()) / 1000);
    const err = new Error(`Tai khoan userId=${userId} dang tam khoa thu hoi do vuot qua toc do cho phep`);
    err.statusCode = 429;
    err.publicMessage = `Tai khoan cua ban da thu hoi qua nhieu voucher trong thoi gian ngan, tam khoa ${Math.ceil(
      LOCK_MS / 60000
    )} phut de phong gian lan. Thu lai sau ${remainSec} giay.`;
    throw err;
  }
}

/** Ghi nhan 1 lan THU HOI THANH CONG (goi o cuoi redeemVoucher(), CHI o nhanh thanh cong - khong
 * goi cho CHECK hay cho cac lan bi tu choi/loi) - neu vuot nguong trong cua so M phut, tam khoa
 * NGAY (khong doi den lan goi tiep theo moi phat hien). */
function recordSuccess(userId) {
  if (!ENABLED) return;
  const now = Date.now();
  let s = state.get(userId);
  if (!s) {
    s = { timestamps: [], lockedUntil: 0 };
    state.set(userId, s);
  }
  s.timestamps.push(now);
  // Don cac moc da qua cua so, tranh bo nho phinh to vo han theo thoi gian chay cua tien trinh.
  s.timestamps = s.timestamps.filter((t) => now - t <= WINDOW_MS);
  if (s.timestamps.length > MAX_REDEEMS) {
    s.lockedUntil = now + LOCK_MS;
  }
}

module.exports = { assertNotLocked, recordSuccess };
