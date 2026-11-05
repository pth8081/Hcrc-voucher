const coreReconciliationService = require('../services/coreReconciliationService');
const companyService = require('../services/companyService');
const apiConnectionService = require('../services/apiConnectionService');
const auditLogService = require('../services/auditLogService');

/** Danh sach Cong ty/He thong voucher de hien 2 o chon tren man "Doi soat cheo Core" - pham vi
 * (ALL/CONNECTION) da duoc middleware tinh san, KHONG doc lai quyen o day. Quan tri doi tac
 * (scope CONNECTION) chi thay cong ty do CHINH ho tao (companyService.listByConnection) va
 * KHONG can chon he thong (da bi ep ve dung 1 he thong cua ho - an o UI nen tra systems rong). */
async function getFilters(req, res, next) {
  try {
    if (req.reconcileScope === 'ALL') {
      const [companies, systems] = await Promise.all([companyService.list(), apiConnectionService.listOptions()]);
      res.json({
        success: true,
        data: {
          scope: 'ALL',
          companies: companies.map((c) => ({ id: c.Id, name: c.CompanyName })),
          systems: systems.map((s) => ({ id: s.id, name: s.name })),
        },
      });
      return;
    }
    const companies = await companyService.listByConnection(req.reconcileConnectionId);
    res.json({
      success: true,
      data: {
        scope: 'CONNECTION',
        companies: companies.map((c) => ({ id: c.Id, name: c.CompanyName })),
        systems: [],
      },
    });
  } catch (err) {
    next(err);
  }
}

function parseBody(body) {
  return {
    companyId: body.companyId ? Number(body.companyId) : null,
    connectionIds: Array.isArray(body.connectionIds) ? body.connectionIds : null,
    fromDate: body.fromDate,
    toDate: body.toDate,
  };
}

async function estimate(req, res, next) {
  try {
    const data = await coreReconciliationService.estimateCount(req, parseBody(req.body));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function start(req, res, next) {
  try {
    const result = await coreReconciliationService.startRun(req, parseBody(req.body));
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'START_CORE_RECONCILIATION',
      targetUsername: String(result.runId),
      detail: { ...parseBody(req.body), totalCount: result.totalCount },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listRuns(req, res, next) {
  try {
    const rows = await coreReconciliationService.listRuns(req);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function getRun(req, res, next) {
  try {
    const run = await coreReconciliationService.getRun(req, Number(req.params.id));
    if (!run) return res.status(404).json({ success: false, message: 'Khong tim thay lan doi soat nay' });
    res.json({ success: true, data: run });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const run = await coreReconciliationService.getRun(req, Number(req.params.id));
    if (!run) return res.status(404).json({ success: false, message: 'Khong tim thay lan doi soat nay' });
    if (run.status === 'RUNNING') {
      return res.status(400).json({ success: false, message: 'Lan doi soat nay chua chay xong, vui long doi roi xuat lai' });
    }
    const buffer = await coreReconciliationService.buildExcelBuffer(run);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="doi-soat-core-${run.id}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function sendEmail(req, res, next) {
  try {
    await coreReconciliationService.sendRunEmail(req, Number(req.params.id), req.body.recipients);
    await auditLogService.log({
      actorUsername: req.user.username,
      action: 'SEND_CORE_RECONCILIATION_EMAIL',
      targetUsername: String(req.params.id),
      detail: { recipients: req.body.recipients },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getFilters, estimate, start, listRuns, getRun, exportExcel, sendEmail };
