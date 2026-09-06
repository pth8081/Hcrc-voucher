const os = require('os');

/**
 * So worker HTTP muon chay - doc tu bien CLUSTER_WORKERS trong .env, khong can sua code:
 *   CLUSTER_WORKERS=1        (mac dinh - 1 tien trinh duy nhat, tuong thich nguoc hoan toan)
 *   CLUSTER_WORKERS=4        (chay dung 4 worker)
 *   CLUSTER_WORKERS=max      (chay bang dung so nhan CPU cua may)
 * Gia tri khong hop le (chu khac "max", so am, 0, rong) deu roi ve mac dinh 1.
 */
function resolveWorkerCount(env = process.env) {
  const raw = String(env.CLUSTER_WORKERS || '1').trim().toLowerCase();
  if (raw === 'max') return os.cpus().length;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

module.exports = { resolveWorkerCount };
