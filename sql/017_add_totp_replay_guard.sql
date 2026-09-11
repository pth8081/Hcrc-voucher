-- =====================================================================
-- 017_add_totp_replay_guard.sql
-- M1 (dot ra soat sau): otplib chi kiem tra 1 ma TOTP con hop le trong window (+-1 buoc, 30s/
-- buoc), KHONG tu chan viec dung LAI cung 1 ma nhieu lan trong luc con hop le - ai chan duoc 1
-- ma dung (qua vai nguoi go, camera, log...) co the tai su dung trong toi da ~90 giay. Them cot
-- luu buoc thoi gian (counter) cua ma DA DUNG GAN NHAT de tu choi ma trung/cu hon - chi tien,
-- khong lui. Ap dung duoc vi AdminTwoFactor la bang app nay tu tao them (migration 007), KHONG
-- phai bang dung chung voi Core.
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.AdminTwoFactor') AND name = 'LastUsedCounter')
BEGIN
    ALTER TABLE dbo.AdminTwoFactor ADD LastUsedCounter BIGINT NULL;
END
GO
