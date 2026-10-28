const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requirePartnerAdmin, requirePartnerAdminFeature } = require('../middleware/requirePartnerAdmin');
const controller = require('../controllers/partnerAdmin.controller');

const router = express.Router();
router.use(authenticate, requirePartnerAdmin);

// Tab "Quan ly tai khoan"
router.get('/users', requirePartnerAdminFeature('canManageAccounts'), controller.list);
router.post('/users', requirePartnerAdminFeature('canManageAccounts'), controller.create);
router.put('/users/:userId/active', requirePartnerAdminFeature('canManageAccounts'), controller.setActive);
router.put('/users/:userId/remove-connection', requirePartnerAdminFeature('canManageAccounts'), controller.removeOwnConnection);
router.put('/users/:userId/profile', requirePartnerAdminFeature('canManageAccounts'), controller.updateUserProfile);
router.put('/users/:userId/permissions', requirePartnerAdminFeature('canManageAccounts'), controller.updateUserPermissions);
router.put('/users/:userId/location', requirePartnerAdminFeature('canManageAccounts'), controller.updateUserLocation);
router.put('/users/:userId/report-access-group', requirePartnerAdminFeature('canManageAccounts'), controller.updateUserReportAccessGroup);
router.put('/users/:userId/company', requirePartnerAdminFeature('canManageAccounts'), controller.updateUserCompany);

// Tab "Cong ty & Diem tieu" - GET mo them cho tab "Quan ly tai khoan" (dropdown Cong ty/Diem tieu
// luc tao/sua tai khoan, xem controller.create/updateUserLocation) - THEM/SUA/XOA that can dung
// quyen "Cong ty & Diem tieu".
router.get('/companies', requirePartnerAdminFeature(['canManageAccounts', 'canManageOrg']), controller.listCompanies);
router.post('/companies', requirePartnerAdminFeature('canManageOrg'), controller.createCompany);
router.put('/companies/:id', requirePartnerAdminFeature('canManageOrg'), controller.updateCompany);
router.get('/companies/:id/convert-preview', requirePartnerAdminFeature('canManageOrg'), controller.companyConvertPreview);
router.delete('/companies/:id', requirePartnerAdminFeature('canManageOrg'), controller.removeCompany);

router.get('/units', requirePartnerAdminFeature(['canManageAccounts', 'canManageOrg']), controller.listUnits);
router.post('/units', requirePartnerAdminFeature('canManageOrg'), controller.createUnit);
router.put('/units/:id', requirePartnerAdminFeature('canManageOrg'), controller.updateUnit);
router.delete('/units/:id', requirePartnerAdminFeature('canManageOrg'), controller.removeUnit);

// Tab "Nhom quyen xem bao cao" - cung quyen "Cong ty & Diem tieu" (gan voi cung 1 khu vuc quan
// ly cong ty/bao cao) - GET mo them cho tab "Quan ly tai khoan" (dropdown gan nhom cho nhan vien).
router.get('/report-access-groups', requirePartnerAdminFeature(['canManageAccounts', 'canManageOrg']), controller.listReportAccessGroups);
router.post('/report-access-groups', requirePartnerAdminFeature('canManageOrg'), controller.createReportAccessGroup);
router.put('/report-access-groups/:id', requirePartnerAdminFeature('canManageOrg'), controller.updateReportAccessGroup);
router.delete('/report-access-groups/:id', requirePartnerAdminFeature('canManageOrg'), controller.removeReportAccessGroup);

// Tab "Nhat ky quan tri"
router.get('/audit-log', requirePartnerAdminFeature('canViewAuditLog'), controller.auditLog);
router.get('/audit-log/export', requirePartnerAdminFeature('canViewAuditLog'), controller.auditLogExport);

// Tab "Hoat dong quet/thu hoi"
router.get('/scan-log', requirePartnerAdminFeature('canViewScanLog'), controller.scanLog);
router.get('/scan-log/export', requirePartnerAdminFeature('canViewScanLog'), controller.scanLogExport);

module.exports = router;
