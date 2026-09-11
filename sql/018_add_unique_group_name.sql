-- =====================================================================
-- 018_add_unique_group_name.sql
-- Dot ra soat sau phat hien: ReportAccessGroups.GroupName truoc day KHONG co rang buoc
-- UNIQUE nao o tang CSDL - ket hop voi form tao nhom quyen chua co khoa chong bam nhanh 2
-- lan (da vá o phia giao dien, xem public/js/units.js), 1 mang cham + bam nham 2 lan co the
-- tao ra 2 nhom quyen TRUNG TEN, kho phan biet trong danh sach chon khi gan tai khoan.
--
-- CHI them rang buoc neu HIEN TAI CHUA co ten nao trung (tranh migrate that bai neu du lieu
-- that da co trung tu truoc - giong nguyen tac da ap dung cho VOUCHER_SYNC, xem README muc 8b).
-- Neu bi bo qua vi da co trung, chay lai thu cong sau khi don dep ten trung.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_ReportAccessGroups_GroupName')
BEGIN
    IF NOT EXISTS (SELECT GroupName FROM dbo.ReportAccessGroups GROUP BY GroupName HAVING COUNT(*) > 1)
    BEGIN
        ALTER TABLE dbo.ReportAccessGroups ADD CONSTRAINT UQ_ReportAccessGroups_GroupName UNIQUE (GroupName);
    END
    ELSE
    BEGIN
        PRINT 'CANH BAO: da phat hien GroupName trung trong dbo.ReportAccessGroups - BO QUA them rang buoc UNIQUE. Vui long don dep ten trung roi chay lai migration nay thu cong.';
    END
END
GO
