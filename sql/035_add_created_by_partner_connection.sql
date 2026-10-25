-- =====================================================================
-- 035_add_created_by_partner_connection.sql
-- Them 1 cot moi vao dbo.VoucherAppPermissions (bang da co tu migration 014) de ghi nho DUNG 1
-- lan, KHONG BAO GIO doi lai sau do: tai khoan nhan vien nay co phai do 1 "Quan tri doi tac" (vd
-- Fuji, xem sql/031) TU TAO ra qua man hinh tu phuc vu (`partnerAdminService.js#createScopedUser`)
-- hay khong - NULL = KHONG (tai khoan do chinh quan tri day du HCRC tao qua man hinh "Tai khoan"
-- binh thuong). Co gia tri = Id cua dbo.ApiConnections (he thong voucher cua doi tac da tao ra
-- tai khoan nay).
--
-- Muc dich: tach biet 2 khai niem truoc day bi gop chung lam 1 (chi dua vao
-- UserVoucherSystems.ConnectionId HIEN TAI, xem sql/028) - "tai khoan nay DANG dung he thong
-- nao" (co the doi qua lai bat ky luc nao, vd quan tri day du cap them 1 he thong khac) KHAC voi
-- "tai khoan nay BAN DAU do AI tao ra" (co dinh vinh vien, khong doi theo UserVoucherSystems).
-- Man hinh "Quan tri doi tac" (xem partnerAdminService.js#listScopedUsers) tu ban nay CHI hien
-- tai khoan thoa CA 2 dieu kien: (1) BAN DAU do CHINH doi tac nay tao ra (cot nay), VA (2) HIEN
-- TAI van con dung he thong cua ho (UserVoucherSystems) - tranh truong hop 1 tai khoan do quan
-- tri day du HCRC tao ra tu dau, sau do duoc cap THEM quyen dung he thong Fuji (de phuc vu quet
-- ca 2 hoe thong) lai vo tinh "lo" ra trong man hinh tu quan ly cua Fuji (ho khong tao ra no, khong
-- nen thay/quan ly duoc no o man "Quan ly tai khoan"/"Nhat ky quan tri" - van thay binh thuong o
-- tab "Hoat dong quet/thu hoi" vi tab do chi loc theo ConnectionName tren tung giao dich, khong
-- phu thuoc "ai tao ra tai khoan").
--
-- Khong dat FOREIGN KEY toi ApiConnections.Id - cung quy uoc da dung o PartnerAdminConnectionId
-- (sql/031) va UserVoucherSystems.ConnectionId (sql/028), de nhat quan.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherAppPermissions') AND name = 'CreatedByPartnerConnectionId')
BEGIN
    ALTER TABLE dbo.VoucherAppPermissions ADD CreatedByPartnerConnectionId INT NULL;
END
GO

-- Backfill DUNG 1 LAN DUY NHAT (bao boc trong IF NOT EXISTS kiem tra "chua co dong nao duoc gan
-- gia tri" - khac voi cach "IF NOT EXISTS tung dong" thong thuong, vi script nay CHAY LAI MOI
-- LAN "npm run migrate" duoc goi, xem scripts/migrate.js khong co co che "file da ap dung thi bo
-- qua"): voi tai khoan nhan vien HIEN DANG dung DUNG VA CHI 1 he thong voucher cu the (loai tru he
-- thong ao "Khac", ConnectionId=0) tai THOI DIEM nang cap len ban nay, coi nhu he thong do CHINH
-- la "nguoi tao" - giu nguyen dung hanh vi hien thi da co TRUOC ban vá nay (tranh cac tai khoan
-- doi tac da tu tao tu truoc bong nhien "bien mat" khoi man hinh cua ho ngay sau khi nang cap).
-- Sau lan dau nay, cot se CO gia tri o it nhat 1 dong nen dieu kien IF NOT EXISTS ben duoi vinh
-- vien KHONG con dung nua - CHAC CHAN khong chay lai o cac lan "npm run migrate" sau, nen tai
-- khoan nhan vien MOI duoc chinh quan tri day du tao truc tiep sau thoi diem nay (du cung chi
-- dung 1 he thong) se KHONG bi "nhan nham" la cua doi tac nao ca, dung y nghia cot nay.
IF NOT EXISTS (SELECT 1 FROM dbo.VoucherAppPermissions WHERE CreatedByPartnerConnectionId IS NOT NULL)
BEGIN
    UPDATE p
    SET p.CreatedByPartnerConnectionId = single_system.ConnectionId
    FROM dbo.VoucherAppPermissions p
    INNER JOIN dbo.Users u ON u.UserID = p.UserId
    INNER JOIN (
        SELECT UserId, MIN(ConnectionId) AS ConnectionId, COUNT(*) AS SystemCount
        FROM dbo.UserVoucherSystems
        WHERE ConnectionId <> 0
        GROUP BY UserId
    ) single_system ON single_system.UserId = p.UserId AND single_system.SystemCount = 1
    WHERE ISNULL(u.status, 0) = 0;
END
GO
