# HCRC Voucher Redemption App

Ung dung danh cho **don vi doi tac khong dung phan mem ban hang (POS)** de:

1. Quan ly thong tin cac don vi thu hoi voucher.
2. Quet ma voucher (bang dien thoai/camera hoac may scan ma vach HID) tai quay.
3. Doi chieu ngay lap tuc voi **Core Voucher API** (he thong phat hanh voucher da co san) de biet voucher da tieu hay chua.
4. Neu voucher **chua tieu**: hien thi trang thai, menh gia, ngay cap, han su dung; cho phep xac nhan thu hoi va luu vao CSDL.
5. Neu voucher **da tieu**: bao "voucher da su dung", bat buoc quet ma khac.
6. Xuat bao cao doi soat hang ngay theo tung dia diem, doi chieu voi Core system.

Stack: **Node.js (Express) + MSSQL** (dung lai schema hien co cua ban).

---

## 1. Kien truc tong quan

```
Dien thoai / May scan HID (web app chay tren trinh duyet)
        |
        v
   Node.js API (Express)  ---->  Core Voucher API (he thong phat hanh, da co san)
        |
        v
   MSSQL (VOUCHER_SYNC, VoucherScanLogs, RedemptionUnits, Locations_*, Users, ...)
```

- App **khong tu quan ly** trang thai "da tieu / chua tieu" cua voucher — do la trach nhiem cua Core Voucher API (nguon su that duy nhat, single source of truth), tranh 2 he thong lech nhau.
- Moi lan quet, app goi `checkVoucher()` sang Core API truoc, roi moi cho phep nguoi dung bam "Xac nhan thu hoi" (goi `redeemVoucher()`).
- Khi thu hoi thanh cong, app ghi 1 dong vao bang `VOUCHER_SYNC` (bang co san trong schema cua ban) de dung lai cho bao cao doi soat/dong bo hien tai — khong tao bang moi song song lam phan manh du lieu.
- Moi lan quet (ca thanh cong lan that bai) duoc ghi vao bang moi `VoucherScanLogs` de phuc vu tra soat, chong gian lan, debug khieu nai tu doi tac.

## 2. Cac bang du lieu

### Da co san (khong thay doi cau truc)
- `Users`, `Locations_Group`, `Locations_Detail`: dang nhap, quan ly dia diem.
- `VOUCHER_SYNC`: noi luu ban ghi thu hoi thanh cong (app ghi vao day).

### Bo sung (xem thu muc `sql/`)
- `RedemptionUnits` (001): thong tin nghiep vu chi tiet cua **don vi thu hoi** — ma doi tac, ten, nguoi lien he, dia chi, MST, tai khoan ngan hang, han muc/ngay... Lien ket 1-1 voi `Locations_Detail` qua `LocationDetailId`, khong dung cham bang cu.
- `VoucherScanLogs` (002): log toan bo luot quet/kiem tra (ca CHECK va REDEEM), phuc vu doi soat va dieu tra khi co tranh chap.
- Cac index ho tro (003) tren `VOUCHER_SYNC` de truy van bao cao nhanh hon.

Chay migration:

```bash
npm run migrate
```

(script doc va thuc thi tuan tu cac file `.sql` trong `sql/`, an toan chay lai nhieu lan nho `IF NOT EXISTS`).

## 3. Cai dat & chay

```bash
npm install
cp .env.example .env   # dien thong tin MSSQL + Core API that vao .env
npm run migrate        # tao bang bo sung
npm run dev             # chay server dev (auto-reload)
```

Mo trinh duyet: `http://localhost:3000` (may scan may vach cam vao PC/tablet, con dien thoai dung camera).

## 4. Tich hop voi Core Voucher API (QUAN TRONG — can chinh theo API that)

File duy nhat can sua khi tich hop voi Core API cua ban: **`src/services/coreVoucherService.js`**.

Hien tai code gia dinh hop dong nhu sau — hay sua lai cho khop:

**Kiem tra voucher** — `POST {CORE_API_BASE_URL}{CORE_API_CHECK_PATH}`
```json
// request
{ "voucherCode": "ABC123456789" }

// response mong doi (200)
{
  "found": true,
  "status": "UNUSED",              // UNUSED | USED | EXPIRED | CANCELLED
  "serial": "SR-000123",
  "valueAmt": 200000,
  "issueDate": "2026-01-01T00:00:00Z",
  "expiryDate": "2026-12-31T23:59:59Z"
}
```

**Thu hoi (danh dau da tieu)** — `POST {CORE_API_BASE_URL}{CORE_API_REDEEM_PATH}`
```json
// request
{
  "voucherCode": "ABC123456789",
  "redeemedBy": "username",
  "locationsGroup": "GRP01",
  "locationsDetail": "LOC01",
  "transNum": "260903153000A1B2C3"
}

// response mong doi (200)
{ "success": true, "status": "REDEEMED", "transRef": "...", "redeemedAt": "2026-09-03T15:30:00Z" }
```

Neu Core API that co field name/cau truc khac, chi can sua 2 ham `normalizeCheckResponse()` va `normalizeRedeemResponse()` trong file tren — phan con lai cua app khong can dong vao.

App co goi lai `checkVoucher()` mot lan nua ngay truoc khi thuc su redeem (chong truong hop 2 nguoi quet cung 1 voucher gan nhu dong thoi); ngoai ra viec dam bao **khong the tieu trung 1 voucher 2 lan** van phai do Core API xu ly (vi du bang unique constraint / optimistic lock ben do), vi day la nguon du lieu goc.

## 5. API cua app nay (danh cho web/mobile UI)

Tat ca endpoint (tru `/auth/login`) yeu cau header `Authorization: Bearer <token>`.

| Method | Path | Mo ta |
|---|---|---|
| POST | `/api/auth/login` | Dang nhap, tra ve JWT |
| GET | `/api/locations/groups` | Danh sach nhom dia diem |
| GET | `/api/locations/details` | Danh sach dia diem chi tiet |
| GET | `/api/redemption-units` | Danh sach don vi thu hoi |
| POST | `/api/redemption-units` | Them don vi thu hoi (can quyen admin) |
| PUT | `/api/redemption-units/:id` | Cap nhat don vi thu hoi (can quyen admin) |
| POST | `/api/vouchers/check` | Quet/kiem tra voucher qua Core API (khong doi trang thai) |
| POST | `/api/vouchers/redeem` | Xac nhan thu hoi (goi Core API + luu VOUCHER_SYNC) |
| GET | `/api/reports/daily?date=YYYY-MM-DD` | Bao cao doi soat theo ngay |

Vi du `POST /api/vouchers/check`:
```json
{ "voucherCode": "ABC123456789", "scanMethod": "HID_SCANNER" }
```
Tra ve khi chua tieu:
```json
{
  "success": true,
  "data": {
    "canRedeem": true,
    "status": "UNUSED",
    "voucherSerial": "SR-000123",
    "valueAmt": 200000,
    "issueDate": "2026-01-01T00:00:00Z",
    "expiryDate": "2026-12-31T23:59:59Z"
  }
}
```
Tra ve khi da tieu:
```json
{
  "success": true,
  "data": { "canRedeem": false, "status": "USED", "message": "Voucher nay da duoc su dung. Vui long quet ma voucher khac." }
}
```

## 6. Giao dien web (thu muc `public/`)

- `login.html`: dang nhap.
- `index.html`: man hinh quet chinh — 1 o input nhan du lieu tu may scan HID (tu dong focus, Enter = kiem tra) va nut "Quet bang camera" (dung thu vien `html5-qrcode` qua CDN) cho dien thoai/tablet khong co may scan roi.
- `units.html`: quan ly thong tin don vi thu hoi voucher (them/xem).
- `report.html`: bao cao doi soat theo ngay, theo tung dia diem.

Luong quet tren UI:
1. Quet/nhap ma -> goi `/vouchers/check`.
2. Neu **chua tieu**: hien menh gia/han dung/ngay cap + nut "Xac nhan thu hoi".
3. Bam xac nhan -> goi `/vouchers/redeem` -> luu vao `VOUCHER_SYNC`, hien thong bao thanh cong, tu dong focus lai o quet cho ma tiep theo.
4. Neu **da tieu**: hien canh bao do, chi con nut "Quet ma khac" — khong cho thu hoi.

## 7. Bao mat & van hanh de xuat

- Doi mat khau demo, dat `JWT_SECRET` ngau nhien du dai truoc khi deploy.
- Nen dat app sau HTTPS (may scan/camera tren dien thoai yeu cau HTTPS de truy cap camera, tru localhost).
- Xem xet gioi han `DailyLimitAmount` trong `RedemptionUnits` va canh bao khi don vi vuot han muc thu hoi/ngay.
- Dinh ky (cron) doi chieu `VOUCHER_SYNC.Sync = 'N'` voi Core system de dam bao khong co giao dich nao bi "mo treo" khi mang loi luc goi redeem.
