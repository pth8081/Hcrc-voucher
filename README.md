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
- `WebAuthnCredentials` (006): luu **khoa cong khai** cua tung passkey (van tay/Face ID) da dang
  ky cho tung tai khoan — khong luu du lieu sinh trac hoc that (van tay/khuon mat khong bao gio
  roi khoi thiet bi cua nguoi dung) — xem muc 9.
- `AdminTwoFactor` (007): luu secret TOTP (**da ma hoa** AES-256-GCM) cua tung tai khoan quan tri
  — **bat buoc** doi voi `Users.status = 1`, khong ap dung cho nhan vien thu hoi thuong — xem muc 10.
- `UserAccountSchedule` (008): moc `ActiveFrom`/`ActiveUntil` (tuy chon) cho **tung tai khoan** —
  cho phep cap tai khoan co thoi han, tu dong kich hoat/het han dung theo 2 moc nay ma khong can
  job nen — xem muc 11.
- `RedemptionCompanies` (009) + cot `CompanyId` tren `RedemptionUnits` (010): them cap **"Cong
  ty"** phia tren tung diem tieu — 1 cong ty co the gan **nhieu diem tieu** (vd chuoi nhieu chi
  nhanh cua cung 1 doi tac). Thong tin lien he/thue/ngan hang chung cua ca cong ty nam o day,
  tach khoi tung diem — xem muc 12.

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

App co the **cai dat nhu 1 ung dung (PWA)** va ho tro **dang nhap bang van tay/Face ID** — xem
muc 9. Voi dang nhap van tay/Face ID, can khai bao them 3 bien trong `.env`:

```
WEBAUTHN_RP_NAME=HCRC Voucher Redemption
WEBAUTHN_RP_ID=localhost           # doi thanh domain that khi deploy, vd: voucher.hcrc.vn
WEBAUTHN_ORIGIN=http://localhost:3000   # doi thanh https://voucher.hcrc.vn khi deploy
```

`WEBAUTHN_RP_ID` phai la domain (khong co scheme/cong), va `WEBAUTHN_ORIGIN` phai la URL day du
(co `https://`) dung khop voi domain nguoi dung truy cap — sai 1 trong 2 gia tri nay se lam
trinh duyet tu choi hop thoai van tay/Face ID.

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
| GET | `/api/redemption-units` | Danh sach diem tieu (kem ten cong ty) |
| POST | `/api/redemption-units` | Them diem tieu, bat buoc gan `companyId` (can quyen admin) |
| PUT | `/api/redemption-units/:id` | Cap nhat diem tieu (can quyen admin) |
| GET | `/api/companies` | Danh sach cong ty |
| POST | `/api/companies` | Them cong ty (can quyen admin) |
| PUT | `/api/companies/:id` | Cap nhat cong ty (can quyen admin) |
| POST | `/api/vouchers/check` | Quet/kiem tra voucher qua Core API (khong doi trang thai) |
| POST | `/api/vouchers/redeem` | Xac nhan thu hoi (goi Core API + luu VOUCHER_SYNC) |
| GET | `/api/reports/daily?date=YYYY-MM-DD` | Bao cao doi soat theo ngay (nhom theo dia diem tai khoan) |
| GET | `/api/reports/summary?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD` | Bao cao tong hop theo khoang ngay (nhom Cong ty -> Diem tieu) — muc 12 |
| GET | `/api/api-connections` | Danh sach ket noi Core API (can quyen admin, secret duoc mask) |
| GET/POST/PUT/DELETE | `/api/api-connections[/:id]` | CRUD ket noi Core API (can quyen admin) |
| POST | `/api/api-connections/:id/activate` | Kich hoat 1 ket noi lam ket noi chinh |
| POST | `/api/api-connections/test-check` | Test kiem tra voucher that voi cau hinh dang nhap tren form/da luu |
| POST | `/api/api-connections/test-redeem` | Test thu hoi voucher that (bat buoc `confirmRedeem: true`) |
| POST | `/api/auth/2fa/setup-init` | (token tam hoac phien admin) Sinh QR + ma thu cong de thiet lap 2FA |
| POST | `/api/auth/2fa/setup-verify` | (token tam hoac phien admin) Xac nhan ma TOTP, bat 2FA |
| POST | `/api/auth/2fa/login-verify` | (token tam) Nhap ma TOTP de hoan tat dang nhap (admin da bat 2FA) |
| GET | `/api/auth/2fa/status` | (can quyen admin) Trang thai 2FA cua chinh minh |
| GET | `/api/auth/2fa/admins` | (can quyen admin) Danh sach quan tri vien + trang thai 2FA |
| DELETE | `/api/auth/2fa/admins/:userId` | (can quyen admin) Go 2FA cua **admin khac** (khong tu go duoc cua chinh minh) |
| GET | `/api/users` | (can quyen admin) Danh sach tai khoan + lich hieu luc + trang thai hien tai |
| PUT | `/api/users/:userId/schedule` | (can quyen admin) Dat/sua `ActiveFrom`/`ActiveUntil` cua 1 tai khoan |
| POST | `/api/auth/webauthn/login-options` | (cong khai) Lay challenge de dang nhap bang van tay/Face ID |
| POST | `/api/auth/webauthn/login-verify` | (cong khai) Xac minh phan hoi tu thiet bi, tra ve JWT neu dung |
| POST | `/api/auth/webauthn/register-options` | Lay challenge de dang ky passkey moi cho tai khoan dang dang nhap |
| POST | `/api/auth/webauthn/register-verify` | Xac minh + luu passkey moi vao `WebAuthnCredentials` |
| GET | `/api/auth/webauthn/devices` | Danh sach passkey da dang ky cua tai khoan dang dang nhap |
| DELETE | `/api/auth/webauthn/devices/:id` | Xoa 1 passkey (vi du mat thiet bi) |

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
- `units.html`: **(admin)** quan ly cong ty + diem tieu voucher (them/xem) — xem muc 12.
- `report.html`: bao cao doi soat theo ngay, theo tung dia diem tai khoan dang nhap.
- `summary-report.html`: bao cao tong hop theo khoang ngay, nhom Cong ty -> Diem tieu, cong don
  2 cap + tong toan bo cong ty — tach biet voi `report.html` — xem muc 12.
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
- **Chong do/vet mat khau dang nhap**: `loginGuard` (`src/utils/loginGuard.js`) khoa tam **theo
  ten dang nhap** (khong theo IP, vi thiet bi tai quay thuong dung chung cho nhieu nhan vien);
  dang nhap dung trong luc dang bi khoa van bi tu choi (khong "mo khoa som" bang mat khau dung,
  tranh do sai lien tuc de tim cua so ho). Ap dung **nhat quan cho ca 3 duong dang nhap**: mat
  khau, van tay/Face ID, va nhap ma xac thuc hai yeu to (muc 10) — dung 1 bo dem chung theo tai
  khoan. **2 muc nguong khac nhau theo vai tro**:
  | Vai tro | Nguong | Cua so | Thoi gian khoa |
  |---|---|---|---|
  | Nhan vien thu hoi (`status=0`) | 5 lan sai | 10 phut | 15 phut |
  | Quan tri (`status=1`) | 50 lan sai | 15 phut | 2 phut |

  Admin dung nguong long hon han vi da co lop **xac thuc hai yeu to** (muc 10) chan phia sau —
  do dung mat khau/van tay khong con du de vao duoc, nen nguong 5 lan/khoa 15 phut cu de bi loi
  dung nguoc lai thanh **DoS chinh admin** (ai biet username admin chi can go sai 5 lan lien tuc
  la khoa duoc ho, lap lai vo han). Nhan vien khong co 2FA nen van giu nguyen muc nghiem ngat.
- **Xac thuc hai yeu to (2FA) bat buoc cho quan tri**: tai khoan `Users.status = 1` khong the vao
  duoc ung dung neu chua thiet lap 2FA (TOTP) — xem muc 10. Token cap ngay sau khi dang nhap
  dung mat khau/van tay nhung **chua** qua 2FA la token TAM (`purpose` khac `'session'`), bi
  `middleware/auth.js` tu choi thang neu dem goi bat ky API nghiep vu nao khac ngoai 2 buoc
  thiet lap/xac minh 2FA.
- Doi mat khau demo, dat `JWT_SECRET` va `ENCRYPTION_KEY` ngau nhien du dai truoc khi deploy.
  `ENCRYPTION_KEY` dung de ma hoa token/API key/password cua ket noi Core API (`ApiConnections`)
  va secret TOTP cua 2FA (`AdminTwoFactor`) — **khong duoc doi hoac lam mat key nay** sau khi da
  co du lieu that, neu khong se khong giai ma lai duoc cac secret da luu (phai nhap lai/thiet lap
  lai tu dau).
- Chi tai khoan admin (`Users.status = 1`) moi vao duoc man hinh "Ket noi API", "Don vi thu hoi",
  "Bao mat" (quan ly 2FA — muc 10) va "Tai khoan" (dat thoi han su dung — muc 11).
- Nen dat app sau HTTPS (may scan/camera tren dien thoai yeu cau HTTPS de truy cap camera, tru localhost).
- Xem xet gioi han `DailyLimitAmount` trong `RedemptionUnits` va canh bao khi don vi vuot han muc thu hoi/ngay.

## 9. PWA + Dang nhap bang van tay/Face ID (WebAuthn)

### 9a. Cai dat nhu ung dung (PWA)

App co the duoc **cai dat vao man hinh chinh** (Android/desktop Chrome hien nut "Cai dat", iOS
dung "Them vao man hinh chinh" trong Safari) va **mo lai gan nhu tuc thi** ngay ca khi mang cham,
nho:
- `public/manifest.webmanifest`: ten, icon (`public/icons/`), mau thuong hieu, che do `standalone`.
- `public/sw.js` (Service Worker, dang ky boi `public/js/pwa.js`): **chi cache "vo" ung dung**
  (cac file HTML/CSS/JS tinh) theo chien luoc cache-truoc-lam-moi-sau — **khong bao gio cache hay
  cho phep chay ngoai mang bat ky request nao toi `/api/`** (kiem tra/thu hoi voucher luon phai
  di mang that toi Core), tranh mo lai tinh trang tieu voucher trung (double-spend) khi mat mang.
  Doi `CACHE_NAME` (vd `v2` -> `v3`) trong `sw.js` moi khi doi danh sach file tinh can cache, de
  trinh duyet nguoi dung tu dong lay ban moi.

### 9b. Dang nhap bang van tay/Face ID

Dung chuan **WebAuthn/passkey** cua trinh duyet (`@simplewebauthn/server` phia server,
`@simplewebauthn/browser` tu luu tru trong `public/js/vendor/` — khong tai tu CDN ngoai o buoc
dang nhap de tranh phu thuoc mang ngoai tai diem trong yeu nhat). Day la co che **duy nhat dung
duoc trong 1 PWA** (khac voi app native co the goi thang API van tay/Face ID cua he dieu hanh) —
trinh duyet se tu mo hop thoai van tay/Face ID/PIN cua thiet bi, ung dung **khong bao gio thay
hay luu du lieu sinh trac hoc that**, chi luu **khoa cong khai** cua tung thiet bi trong
`WebAuthnCredentials`.

- **Thiet bi dung chung tai quay**: dang ky dung **passkey co the phat hien duoc**
  (`residentKey: 'required'`, chi cho `authenticatorAttachment: 'platform'`) va **khong gioi han
  truoc 1 tai khoan cu the** khi dang nhap. Nho vay, khi nhieu nhan vien cung dang ky van
  tay/Face ID tren cung 1 tablet/PC tai quay, trinh duyet/he dieu hanh se **tu hien bang chon tai
  khoan** (giong "Doi tai khoan khac" trong app VPDT) truoc khi xac minh sinh trac — khong can tu
  xay giao dien chon tai khoan rieng.
- **Dang ky passkey**: sau khi da dang nhap bang mat khau it nhat 1 lan, bam **"Cai van
  tay/Face ID"** o goc tren ung dung (`public/js/layout.js`), dat ten cho thiet bi (vd "Tablet
  quay 1") de sau nay de nhan biet/xoa khi mat thiet bi.
- **Dang nhap**: tren `login.html`, neu trinh duyet ho tro WebAuthn se hien them nut **"Dang nhap
  bang van tay / Face ID"** — bam vao, chon tai khoan cua minh trong bang chon cua he dieu hanh,
  xac minh van tay/Face ID/PIN la vao thang, khong can go mat khau.
- Dang nhap van tay/Face ID that bai (khong tim thay passkey hop le, chu ky sai...) cung tinh vao
  bo dem cua `loginGuard` (muc 8) nhu dang nhap mat khau sai, tranh bi loi dung de do doan.
- Quan ly thiet bi da dang ky (xoa khi mat thiet bi) qua `GET/DELETE /api/auth/webauthn/devices`.

## 10. Xac thuc hai yeu to bat buoc cho quan tri (2FA)

Tai khoan quan tri (`Users.status = 1`) nam giu quyen cau hinh ket noi Core API va thong tin doi
tac, nen **bat buoc** phai bat xac thuc hai yeu to (TOTP — Google Authenticator, Microsoft
Authenticator, Authy...) truoc khi vao duoc ung dung. Nhan vien thu hoi thuong (`status = 0`)
**khong** bi anh huong, dang nhap binh thuong nhu truoc.

### 10a. Luong dang nhap cua tai khoan quan tri

1. Dang nhap bang mat khau (hoac van tay/Face ID) nhu binh thuong.
2. Sau khi xac minh danh tinh dung, server **chua** cap phien day du ma tra ve 1 token TAM
   (het han sau 10 phut, `purpose` la `2fa_setup` hoac `2fa_verify` tuy tinh trang):
   - **Lan dau chua tung thiet lap 2FA** → chuyen sang `2fa-setup.html`: hien ma QR + ma nhap
     thu cong, quet bang ung dung xac thuc, nhap ma 6 so hien ra de xac nhan. Xac nhan dung se
     duoc cap phien day du ngay (khong can dang nhap lai lan nua).
   - **Da bat 2FA tu truoc** → chuyen sang `2fa-verify.html`: chi can nhap ma 6 so dang hien
     tren ung dung xac thuc la vao duoc, khong phai quet lai QR.
3. Token TAM **khong dung duoc** cho bat ky API nghiep vu nao khac (xem `middleware/auth.js`) —
   du bi lo cung khong the goi quet/thu hoi voucher, chi goi duoc dung 2 nhom API thiet lap/xac
   minh 2FA.

### 10b. Quan tri vien khac go duoc 2FA cho nhau (khoi phuc khi mat thiet bi)

Man hinh **"Bao mat"** (`/security.html`, chi tai khoan admin) liet ke toan bo quan tri vien kem
trang thai 2FA, va cho phep:

- **Doi thiet bi xac thuc**: tu minh (dang co phien dang nhap hop le) bam "Doi thiet bi xac thuc"
  de thiet lap lai TOTP tren thiet bi moi — khong can ai giup.
- **Go 2FA cua mot admin khac** (khi ho bi mat dien thoai/mat thiet bi xac thuc, khong con cach
  nao tu dang nhap duoc): **bat ky admin nao khac** bam "Go 2FA" tren dong cua nguoi do — lan
  dang nhap ke tiep cua ho se quay lai buoc **bat buoc thiet lap tu dau** (10a).
  **Khong ai tu go duoc 2FA cua chinh minh** — nut nay bi an tren dong cua chinh ban, va API
  `DELETE /api/auth/2fa/admins/:userId` cung tu choi (400) neu `userId` trung voi tai khoan dang
  goi — chan truong hop 1 phien bi chiem quyen tu vo hieu hoa lop bao ve nay.

File lien quan: `src/services/twoFactorService.js` (sinh/xac minh TOTP bang `otplib`, QR bang
`qrcode`), `src/middleware/require2FAPending.js` (chi chap nhan token TAM cho 2 buoc thiet
lap/xac minh), `sql/007_create_admin_two_factor.sql`.

## 11. Thoi han su dung tai khoan (tu dong kich hoat / tu dong khoa)

Ap dung cho **moi tai khoan** (ca nhan vien lan quan tri) — dung khi cap tai khoan cho doi tac
theo hop dong co thoi han. Man hinh **"Tai khoan"** (`/users.html`, chi admin) liet ke toan bo
tai khoan kem 2 truong co the dat: **"Kich hoat tu"** va **"Het han"**.

- **De trong ca 2** (mac dinh khi chua tung dat): tai khoan hoat dong binh thuong, khong gioi han.
- **Chi dat "Kich hoat tu"** (o tuong lai): tai khoan **chua the dang nhap** cho toi dung moc do —
  huu ich khi tao san tai khoan cho nhan su sap vao lam.
- **Chi dat "Het han"**: tai khoan tu dong **ngung dang nhap duoc** ngay sau moc do — dung cho hop
  dong thoi vu/thu viec.
- **Dat ca 2**: tai khoan chi dung nhap duoc trong dung khoang thoi gian giua 2 moc.

Ky thuat: **khong luu co "khoa/mo" rieng va khong dung job nen** — moi lan dang nhap deu tinh
**song** thoi diem hien tai so voi `ActiveFrom`/`ActiveUntil` luu trong bang phu
`UserAccountSchedule` (`src/services/userScheduleService.js`), nen luon chinh xac den tung giay,
tu dong "khoa"/"mo" ma khong ai phai lam gi them khi den han. Kiem tra nay chay **sau khi** da
xac minh mat khau/van tay dung (khong lo tinh trang tai khoan cho nguoi chua biet mat khau) va
**khong** tinh vao bo dem `loginGuard` (muc 8) — day khong phai loi go sai, khong nen bi khoa
oan vao chinh sach chong brute-force.

```
Truoc "Kich hoat tu"     -> 403 "Tai khoan chua den thoi gian duoc kich hoat (co hieu luc tu ...)"
Sau "Het han"            -> 403 "Tai khoan da het han su dung tu ... Vui long lien he quan tri de gia han."
Trong khoang hop le      -> dang nhap binh thuong (tiep tuc qua 2FA neu la admin - muc 10)
```

**Luu y khi da dang nhap roi**: phien JWT hien tai (`JWT_EXPIRES_IN`, mac dinh 8 gio) van con
hieu luc cho toi khi tu het han tu nhien du tai khoan vua bi dat het han/chua kich hoat — kiem
tra chi chan duoc **lan dang nhap moi**, khong thu hoi phien dang dung do he thong khong luu
session phia server (stateless JWT). Neu can khoa tuc thi ca phien dang mo, giam `JWT_EXPIRES_IN`
xuong ngan hon.

## 12. Cong ty, diem tieu & bao cao tong hop

Ung dung cap tai khoan cho **nhieu doi tac** su dung, moi doi tac co the co **nhieu diem tieu**
(vd chuoi cua hang nhieu chi nhanh) — can bao cao duoc theo tung cong ty, theo tung diem, va
tong hop toan bo. Day la ly do co them cap **"Cong ty"** phia tren `RedemptionUnits` (von truoc
gio la 1-1 voi 1 dia diem), va 1 **bao cao tong hop** rieng, **tach biet** voi "Bao cao doi soat"
(muc 5/6 — bao cao do chi xem theo tung ngay, nhom theo dia diem cua tai khoan dang nhap).

### 12a. Cong ty & diem tieu

Man hinh **"Don vi thu hoi"** (`/units.html`, chi admin) nay gom 2 cap:

1. **Cong ty** (`RedemptionCompanies`) — khai bao truoc: ma, ten, nguoi lien he, MST, tai khoan
   ngan hang... (thong tin chung cho ca doi tac).
2. **Diem tieu** (`RedemptionUnits`, van giu 1-1 voi 1 `Locations_Detail` nhu truoc) — bat buoc
   chon **Cong ty** khi tao moi qua cot `CompanyId`. **1 cong ty co the gan nhieu diem tieu** —
   tao nhieu diem, cung chon 1 cong ty o dropdown.

Diem tieu **da khai bao truoc khi co khai niem Cong ty** van giu nguyen `CompanyId = NULL`
(khong bi xoa/hong du lieu) — cac giao dich cua nhung diem nay se xuat hien duoi nhom
**"Chua gan cong ty"** trong bao cao tong hop cho toi khi duoc gan cong ty.

### 12b. Bao cao tong hop (`/summary-report.html`)

Chon 1 **khoang ngay** (tu - den, khong gioi han trong 1 ngay nhu bao cao doi soat), xem bang
phan cap 2 cap cong don:

```
Cong ty A                                                    12 voucher   3.400.000 d   <- cong don cap cong ty
  Diem tieu 1                                                 7 voucher   2.000.000 d   <- cong don cap diem
    12/09  Nguyen Van A   TRANS-xxx   VC-0001              -   200.000 d               <- chi tiet tung giao dich
    ...
  Diem tieu 2                                                 5 voucher   1.400.000 d
    ...
Cong ty B                                                     4 voucher   1.000.000 d
  ...
TONG TOAN BO CONG TY                                         16 voucher   4.400.000 d   <- tong tat ca cong ty
```

Nguon du lieu van la `VOUCHER_SYNC` (dung bang voi bao cao doi soat, khong tao ban ghi song
song) — noi voi `Locations_Detail` (theo ma) roi noi tiep sang `RedemptionUnits`/
`RedemptionCompanies` de biet giao dich do thuoc diem/cong ty nao
(`src/services/summaryReportService.js`). Cot "Nguoi tieu" doc truc tiep tu `User_Name` da luu
san trong `VOUCHER_SYNC` luc thu hoi — khong can truy van them.
