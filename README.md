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
- **Neu Core API mat ket noi dung luc goi bao thu hoi** (sau khi da xac nhan UNUSED it giay truoc do): app **van cho thu hoi thanh cong tai cho** (khong lam gian doan giao dich voi khach hang), ghi vao `VOUCHER_SYNC` voi `Sync='N'` nhu 1 "hang doi cho dong bo", roi 1 job chay dinh ky se tu dong gui lai — xem muc 4c.
- Moi lan quet (ca thanh cong lan that bai) duoc ghi vao bang moi `VoucherScanLogs` (**log thao tac nguoi dung**) de phuc vu tra soat, chong gian lan, debug khieu nai tu doi tac. Moi lan job dong bo chay (thanh cong/that bai) duoc ghi vao bang co san `Voucher_Exelogs` (**log he thong**), dung dung y goc cua bang nay trong schema ban gui.

## 2. Cac bang du lieu

### Da co san (khong thay doi cau truc)
- `Users`, `Locations_Group`, `Locations_Detail`: dang nhap, quan ly dia diem.
- `VOUCHER_SYNC`: noi luu ban ghi thu hoi thanh cong (app ghi vao day).

### Bo sung (xem thu muc `sql/`)
- `RedemptionUnits` (001): thong tin nghiep vu chi tiet cua **don vi thu hoi** — ma doi tac, ten, nguoi lien he, dia chi, MST, tai khoan ngan hang, han muc/ngay... Lien ket 1-1 voi `Locations_Detail` qua `LocationDetailId`, khong dung cham bang cu.
- `VoucherScanLogs` (002): log toan bo luot quet/kiem tra (ca CHECK va REDEEM), phuc vu doi soat va dieu tra khi co tranh chap.
- Cac index ho tro (003) tren `VOUCHER_SYNC` de truy van bao cao nhanh hon.
- `ApiConnections` + `ApiConnectionTestLogs` (004): luu cau hinh ket noi Core Voucher API do
  admin tu khai bao qua UI (secret duoc ma hoa) va log lich su cac lan bam nut "Test" tren
  man hinh cau hinh.
- `Voucher_Exelogs` (005, chi tao neu **CHUA** co san — moi truong that cua ban da co bang nay):
  dung lai dung muc dich goc de ghi log he thong cua job dong bo lai voucher loi — xem muc 4c.

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

## 4. Cau hinh ket noi Core Voucher API qua giao dien Admin (khuyen nghi)

Thay vi sua code, admin co the tu cau hinh + test ket noi Core API ngay tren web tai
**menu "Ket noi API"** (`/api-connection.html`, yeu cau tai khoan admin — `Users.status = 1`).

Man hinh cho phep khai bao truc quan, khong can biet lap trinh:

1. **Base URL + xac thuc**: Bearer token / API key theo header rieng / Basic Auth. Secret duoc
   **ma hoa AES-256-GCM** truoc khi luu vao DB (bang `ApiConnections`), khong bao gio tra ve
   plaintext cho trinh duyet sau khi luu (chi hien "da luu, de trong de giu nguyen").
2. **Endpoint kiem tra (Check)**: chon method GET/POST, khai bao ma voucher nam o dau
   (path `{code}` / query string / body JSON), va **anh xa duong dan field** trong response
   JSON tra ve (vi du `status`, `valueAmt`, `issueDate`...) sang cac truong chuan cua app.
   Ho tro them **bang anh xa gia tri trang thai** (vi du Core API tra `"0"` -> app hieu la
   `UNUSED`) vi moi he thong dat ten trang thai khac nhau.
3. **Endpoint thu hoi (Redeem)**: tuong tu, cho phep soan body JSON template voi cac placeholder
   `{code} {username} {locationsGroup} {locationsDetail} {transNum}`.
4. **Test ngay khi cau hinh**: nhap 1 ma voucher that, bam **"Test kiem tra"** de goi thang
   sang Core API bang dung cau hinh dang go tren form (chua can bam Luu) va xem ket qua
   chuan hoa + response tho ngay lap tuc — phat hien loi mapping truoc khi kich hoat cho
   toan bo doi tac su dung. Co rieng nut **"Test thu hoi"** (co canh bao + checkbox xac nhan
   bat buoc) vi thao tac nay se **tieu that** voucher tren he thong Core, khong the hoan tac.
5. Co the tao nhieu ket noi (vi du Test/Production) nhung chi 1 ket noi duoc **"Kich hoat"**
   tai 1 thoi diem — do la ket noi ma toan bo man hinh quet voucher dang su dung
   (`src/services/coreVoucherService.js` tu doc ket noi dang active tu DB).

Neu **chua** cau hinh/kich hoat ket noi nao tren UI, app se **fallback** dung cau hinh tinh
trong `.env` (`CORE_API_*`) voi hop dong JSON co dinh mo ta o muc 4b ben duoi — giup app van
chay duoc trong luc admin dang thiet lap ket noi qua UI.

### 4b. Hop dong fallback qua .env (chi ap dung khi chua co ket noi nao tren UI)

File lien quan: `src/services/coreVoucherService.js` (ham `*LegacyEnv`).

**Kiem tra voucher** — `GET {CORE_API_BASE_URL}{CORE_API_CHECK_PATH}?voucherCode=ABC123456789`
```json
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

### 4c. Hang doi dong bo khi Core API loi ket noi luc thu hoi

Phan biet **2 loai that bai khac nhau** khi goi POST bao Core thu hoi (`src/services/voucherService.js`):

| Loai that bai | Xu ly |
|---|---|
| Core **phan hoi ro rang** la khong the tieu (vd voucher vua bi nguoi khac tieu, het han) | **Tu choi** thu hoi ngay, khong luu gi ca — day la loi nghiep vu that. |
| **Khong ket noi duoc** Core (mat mang, Core dang bao tri, timeout...) | **Van cho thu hoi thanh cong tai cho** (vi da xac nhan UNUSED it giay truoc), luu vao `VOUCHER_SYNC` voi `Sync='N'` — coi nhu dua vao "hang doi cho dong bo". |

Job **`src/services/syncRetryService.js`** chay dinh ky (cau hinh qua `.env`, khong can sua code):

```
SYNC_RETRY_ENABLED=true             # bat/tat job
SYNC_RETRY_INTERVAL_MINUTES=5       # chu ky chay
SYNC_RETRY_BATCH_SIZE=20            # so ban ghi toi da/lot
SYNC_RETRY_MAX_ATTEMPTS=20          # so lan thu lai toi da/1 ban ghi truoc khi tam bo qua
```

Moi lot chay: doc cac dong `VOUCHER_SYNC.Sync = 'N'`, goi lai request thu hoi cho tung dong.
Thanh cong (hoac Core tra ve voucher **da o trang thai USED** — rat co the chinh la do request
lan truoc cua chung ta da toi noi nhung bi mat ket noi truoc khi nhan duoc phan hoi) thi coi nhu
**da dong bo**, set `Sync='Y'` — ban ghi **bien mat khoi hang doi**. That bai thi giu `Sync='N'`
de thu lai lan sau, tru khi vuot qua `SYNC_RETRY_MAX_ATTEMPTS` thi tam bo qua (van giu `Sync='N'`
de con nguoi ra soat thu cong qua bao cao — khong bao gio am tham xoa/mat du lieu).

Moi lan thu (thanh cong hay that bai) deu duoc ghi vao `Voucher_Exelogs` — xem duoc lich su day
du bang cach truy van `pro_name = 'VoucherRedeemSync'`.

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
| GET | `/api/api-connections` | Danh sach ket noi Core API (can quyen admin, secret duoc mask) |
| GET/POST/PUT/DELETE | `/api/api-connections[/:id]` | CRUD ket noi Core API (can quyen admin) |
| POST | `/api/api-connections/:id/activate` | Kich hoat 1 ket noi lam ket noi chinh |
| POST | `/api/api-connections/test-check` | Test kiem tra voucher that voi cau hinh dang nhap tren form/da luu |
| POST | `/api/api-connections/test-redeem` | Test thu hoi voucher that (bat buoc `confirmRedeem: true`) |

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
- `api-connection.html`: **(admin)** khai bao/kich hoat ket noi Core Voucher API va test truc tiep
  bang voucher that ngay khi cau hinh — xem chi tiet o muc 4.

Luong quet tren UI:
1. Quet ma (may quet HID hoac camera — **khong the go tay**, xem muc 7) -> goi `/vouchers/check`.
2. Neu **chua tieu**: hien menh gia/han dung/ngay cap + nut "Xac nhan thu hoi".
3. Bam xac nhan -> goi `/vouchers/redeem` -> luu vao `VOUCHER_SYNC`, hien thong bao thanh cong
   (hoac "dang cho dong bo" neu Core tam thoi mat ket noi — xem muc 4c), bang giao dich gan day
   hien cot "Dong bo" (DA DONG BO / CHO DONG BO), tu dong focus lai o quet cho ma tiep theo.
4. Neu **da tieu**: hien canh bao do, chi con nut "Quet ma khac" — khong cho thu hoi.

## 7. Hieu nang

- Response (JSON API lan file tinh JS/CSS/HTML) duoc **nen gzip** qua middleware `compression`
  (`src/app.js`) — giam bang thong tai, quan trong voi cac diem thu hoi co duong truyen yeu.

## 8. Bao mat

- **CSP nghiem ngat, khong `unsafe-inline`/`unsafe-eval`** (`src/app.js`, qua `helmet`): toan bo
  CSS/JS nam trong file rieng (khong con the `<style>`/`<script>` inline hay thuoc tinh
  `style="..."` trong bat ky trang nao), script-src/style-src/font-src chi allowlist dung cac
  host thuc su can (Google Fonts, `unpkg.com` cho thu vien quet QR). Helmet cung tu bat kem cac
  header bao mat khac (`X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, HSTS...).
- **Chong XSS**: moi du lieu dong hien thi ra trang (ke ca response tu Core API — nguon du lieu
  ben ngoai, rui ro cao nhat) deu di qua `escapeHtml()` truoc khi ghep vao `innerHTML`, hoac dung
  `.textContent` (khong parse HTML) cho cac khoi hien thi JSON tho — xem `public/js/*.js`.
- **Chong SQL injection**: toan bo truy van MSSQL dung tham so hoa qua `.input()` cua `mssql`
  (khong bao gio noi chuoi gia tri nguoi dung truc tiep vao van ban SQL) — ap dung nhat quan cho
  moi service trong `src/services/`.
- **Chong go tay/do ma voucher**: giao dien quet chi nhan tin hieu tu may quet that (phat hien
  qua toc do go phim) hoac camera, chan paste/keo-tha — xem `public/js/scan.js`. Phia server co
  them `guessGuard` (`src/utils/guessGuard.js`) tam khoa tai khoan sau nhieu lan kiem tra ra ma
  khong ton tai lien tiep, vi gioi han o giao dien co the bi vuot qua neu goi thang API bang token
  hop le.
- Doi mat khau demo, dat `JWT_SECRET` va `ENCRYPTION_KEY` ngau nhien du dai truoc khi deploy.
  `ENCRYPTION_KEY` dung de ma hoa token/API key/password cua ket noi Core API luu trong bang
  `ApiConnections` — **khong duoc doi hoac lam mat key nay** sau khi da co du lieu that, neu
  khong se khong giai ma lai duoc cac secret da luu (phai nhap lai tu dau).
- Chi tai khoan admin (`Users.status = 1`) moi vao duoc man hinh "Ket noi API" va "Don vi thu hoi".
- Nen dat app sau HTTPS (may scan/camera tren dien thoai yeu cau HTTPS de truy cap camera, tru localhost).
- Xem xet gioi han `DailyLimitAmount` trong `RedemptionUnits` va canh bao khi don vi vuot han muc thu hoi/ngay.
