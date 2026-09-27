# Tài liệu API — Kiểm tra & Thu hồi (cập nhật) Voucher

**Ứng dụng:** HCRC Voucher Redemption
**Phiên bản tài liệu:** ứng với app v3.9

Có **2 cách gọi** chức năng kiểm tra/thu hồi voucher, dùng chung 1 logic nghiệp vụ (khóa chống trùng, hàng đợi đồng bộ...):

| | Dành cho | Base URL | Xác thực |
|---|---|---|---|
| **Phần A** | Giao diện web nội bộ (`public/`) | `/api/vouchers` | JWT `Authorization: Bearer <token>` (đăng nhập qua `/api/auth/login`) |
| **Phần B** | Đối tác tích hợp trực tiếp (server-to-server) | `/api/v1/vouchers` | `X-API-Key: <key>` (admin cấp qua màn hình "API đối tác") |

---

# Phần A — Giao diện web nội bộ (JWT)

**Base URL:** `/api/vouchers`
**Xác thực:** bắt buộc header `Authorization: Bearer <token>` (JWT lấy từ `POST /api/auth/login`)
**Quyền yêu cầu:** tài khoản phải có quyền tính năng `canRedeemVoucher` (admin mặc định có; tài khoản nhân viên cần được cấp ở màn hình Tài khoản)

## 1. `POST /api/vouchers/check` — Kiểm tra thông tin voucher

Endpoint chỉ đọc, **không** làm thay đổi trạng thái voucher. Dùng ngay sau khi quét mã, trước khi cho phép người dùng bấm "Xác nhận thu hồi".

### Request

```json
{
  "voucherCode": "ABC123456789",
  "scanMethod": "HID_SCANNER"
}
```

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `voucherCode` | string | Có | Tự động `trim()`. **Tối đa 24 ký tự** (giới hạn cột DB) — mã quá dài bị từ chối ngay ở tầng validate, không chạm tới DB/Core API |
| `scanMethod` | string | Không | Mặc định `"MANUAL"` nếu bỏ trống. Ghi vào nhật ký quét (`VoucherScanLogs`) để phân biệt nguồn quét (máy quét mã vạch / camera / gõ tay) |

### Response

**200 — còn dùng được:**
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

**200 — đã sử dụng:**
```json
{
  "success": true,
  "data": {
    "canRedeem": false,
    "status": "USED",
    "message": "Voucher nay da duoc su dung. Vui long quet ma voucher khac."
  }
}
```

**200 — trạng thái khác (không hợp lệ/không tồn tại):**
```json
{
  "success": true,
  "data": {
    "canRedeem": false,
    "status": "INVALID",
    "message": "Voucher khong hop le hoac khong ton tai."
  }
}
```

**400 — lỗi input:**
```json
{ "success": false, "message": "Thieu voucherCode" }
```
```json
{ "success": false, "message": "Ma voucher qua dai (toi da 24 ky tu)" }
```

### Logic nội bộ đáng lưu ý

- **Tra cứu local trước:** đối chiếu `VOUCHER_SYNC` (CSDL nội bộ của app) theo mã voucher trước khi hỏi Core. Nếu app này đã từng ghi nhận thu hồi mã đó (kể cả bản ghi đang chờ đồng bộ, `Sync='N'`) → trả lời "đã sử dụng" **ngay lập tức, không gọi Core** (nhanh hơn, giảm tải Core — thường gặp khi nhân viên quét nhầm lại đúng mã vừa tiêu xong).
- Nếu **không** thấy ở local, **luôn luôn** phải hỏi Core API thật — không được kết luận "còn dùng được" chỉ vì chưa có ở local (có thể đã bị tiêu qua kênh khác ngoài app này).
- **Chống dò mã (guessGuard):** dò quá nhiều mã không tồn tại liên tiếp từ cùng 1 tài khoản sẽ bị khóa tạm.

---

## 2. `POST /api/vouchers/redeem` — Xác nhận thu hồi (cập nhật trạng thái voucher) (Phần A)

Gọi sau khi người dùng bấm "Xác nhận thu hồi" trên giao diện. Đây là bước **duy nhất** làm thay đổi trạng thái voucher thật sự (gọi Core API đánh dấu đã tiêu + ghi `VOUCHER_SYNC`).

### Request

Giống hệt `/check` — chỉ cần `voucherCode` (bắt buộc, ≤24 ký tự) và `scanMethod` (tùy chọn).

```json
{ "voucherCode": "ABC123456789", "scanMethod": "HID_SCANNER" }
```

### Response

**200 — thu hồi thành công, đồng bộ Core ngay:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "status": "REDEEMED",
    "pendingSync": false,
    "transNum": "260927153000A1B2C3",
    "valueAmt": 200000,
    "redeemedAt": "2026-09-27T15:30:00Z"
  }
}
```

**200 — thành công tại chỗ, đang chờ đồng bộ (Core mất kết nối lúc gọi):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "status": "REDEEMED_PENDING_SYNC",
    "pendingSync": true,
    "transNum": "260927153000A1B2C3",
    "valueAmt": 200000,
    "redeemedAt": "2026-09-27T15:30:01Z"
  }
}
```
→ Ghi vào `VOUCHER_SYNC` với `Sync='N'`. Job nền `syncRetryService` sẽ tự động gửi lại theo lịch (cấu hình qua biến môi trường `SYNC_RETRY_ENABLED` / `SYNC_RETRY_INTERVAL_MINUTES` / `SYNC_RETRY_BATCH_SIZE` / `SYNC_RETRY_MAX_ATTEMPTS`).

**200 — Core từ chối nghiệp vụ thật (voucher vừa đổi trạng thái ngay lúc xác nhận):**
```json
{
  "success": false,
  "data": {
    "success": false,
    "status": "USED",
    "message": "Voucher da doi trang thai, vui long quet lai truoc khi thu hoi."
  }
}
```

**200 — bị chặn trùng do 2 request cùng mã gần như đồng thời:**
```json
{
  "success": false,
  "data": {
    "success": false,
    "status": "USED",
    "message": "Voucher nay vua duoc thu hoi (co the tu thiet bi/quay khac). Vui long quet ma khac."
  }
}
```

**400 — lỗi input:** giống hệt `/check` (thiếu mã hoặc mã quá 24 ký tự).

**500 — lỗi hệ thống nghiêm trọng (hiếm gặp):** Core đã xác nhận thu hồi thành công nhưng bước ghi CSDL nội bộ thất bại (mất kết nối DB giữa chừng, tràn số...).
```json
{
  "success": false,
  "message": "Core da xac nhan thu hoi THANH CONG nhung he thong ghi nhan cuc bo bi loi. KHONG quet lai ma nay - vui long bao quan tri vien NGAY de doi soat thu cong."
}
```
Trường hợp này được ghi log mức CRITICAL để quản trị viên đối soát thủ công — **không được quét lại mã đó qua app** vì Core đã tiêu voucher rồi.

### Logic nội bộ đáng lưu ý

- **Kiểm tra lại ngay trước khi thu hồi:** gọi lại `checkVoucher()` sang Core một lần nữa ngay trước khi thực sự đánh dấu tiêu, để chống trường hợp đối tác bấm xác nhận sau khi voucher đã bị người khác tiêu qua kênh khác.
- **Chống 2 người quét trùng mã gần như cùng lúc:** dùng khóa `sp_getapplock` của SQL Server theo đúng mã voucher, bao trùm **cả** lệnh gọi Core API **lẫn** bước ghi `VOUCHER_SYNC`, trong cùng 1 transaction. Request "thua" trong cuộc đua sẽ tự nhận diện đã có bản ghi trùng và trả lời ngay mà **không gọi Core lần 2**.
- **Phân biệt 2 loại thất bại khi gọi Core:**
  | Loại thất bại | Xử lý |
  |---|---|
  | Core phản hồi rõ ràng là không cho tiêu (đã bị tiêu, hết hạn...) | Từ chối thu hồi ngay, không lưu gì — lỗi nghiệp vụ thật |
  | Không kết nối được Core (mất mạng, Core bảo trì, timeout) | Vẫn cho thu hồi thành công tại chỗ, đưa vào hàng đợi đồng bộ (`Sync='N'`) — lỗi hạ tầng, không làm gián đoạn giao dịch với khách hàng |
- Mỗi lần thử (thành công hay thất bại) đều được ghi vào `Voucher_Exelogs` (lịch sử đồng bộ, tra bằng `pro_name='VoucherRedeemSync'`) và `VoucherScanLogs` (nhật ký quét, xem qua `GET /api/admin/scan-log`).

---

# Phần B — API cho đối tác tích hợp trực tiếp (X-API-Key)

**Base URL:** `/api/v1/vouchers`
**Xác thực:** bắt buộc header `X-API-Key: <api-key-được-HCRC-cấp>`

API key được **admin cấp qua màn hình "API đối tác"** (`/partner-api-keys.html`, menu Quản trị), gắn với **một tài khoản nhân viên có sẵn** trong hệ thống. Khi gọi bằng key, hệ thống xử lý **y hệt tài khoản đó tự đăng nhập gọi API** — dùng đúng `Locations_Group`/`Locations_Detail`/tên tài khoản của tài khoản đó để ghi nhận giao dịch, đối soát và báo cáo. Nếu cần phân biệt nhiều điểm tiêu qua API, tạo một tài khoản riêng cho từng điểm tiêu rồi cấp key cho từng tài khoản đó.

Key **không thể gán cho tài khoản quản trị** (chỉ áp dụng cho tài khoản nhân viên) — để không tạo đường vòng qua chính sách bắt buộc 2FA của tài khoản quản trị. Mỗi key được cấp quyền riêng cho `/check`, `/redeem`, hoặc cả hai (thiết lập lúc tạo key).

## 1. `POST /api/v1/vouchers/check` — Kiểm tra thông tin voucher

Cùng logic với Phần A mục 1 (không thay đổi trạng thái voucher). Request/response JSON giống hệt — chỉ khác cách xác thực.

**Request:**
```json
{ "voucherCode": "ABC123456789", "scanMethod": "PARTNER_API" }
```
`scanMethod` tùy chọn — nếu bỏ trống, hệ thống tự ghi `"PARTNER_API"` vào nhật ký quét (`VoucherScanLogs`) để phân biệt với các nguồn quét khác (máy quét/camera/web thủ công).

**Response:** giống hệt Phần A mục 1 (200 với `canRedeem`/`status`/`voucherSerial`/...).

## 2. `POST /api/v1/vouchers/redeem` — Xác nhận thu hồi

Cùng logic nghiệp vụ với Phần A mục 2 (cùng khóa chống trùng `sp_getapplock`, cùng hàng đợi đồng bộ khi Core mất kết nối, cùng cơ chế idempotent khi voucher đã được thu hồi trước đó). Khác biệt so với Phần A **chỉ** ở 1 điểm:

**404 — không tìm thấy mã** (envelope khác quy ước `{success,message}` chung của app, chỉ áp dụng riêng cho trường hợp này):
```json
{ "error": "Khong tim thay ma" }
```
Mọi lý do từ chối khác (đã sử dụng, hết hạn, huỷ...) vẫn trả về HTTP 200 với `success:false` như Phần A, **không** phải 404.

## 3. Các mã lỗi riêng của xác thực API key

| HTTP | Khi nào | Response |
|---|---|---|
| 401 | Thiếu header `X-API-Key` | `{"success":false,"message":"Thieu header X-API-Key"}` |
| 401 | Key sai hoặc đã bị thu hồi | `{"success":false,"message":"API key khong hop le hoac da bi thu hoi"}` |
| 403 | Key không được cấp quyền gọi endpoint này (thiếu scope check/redeem) | `{"success":false,"message":"API key nay khong duoc cap quyen goi /check"}` (hoặc `/redeem`) |
| 403 | Tài khoản gắn với key đã bị khóa/xóa/hết hạn lịch hiệu lực | `{"success":false,"message":"Tai khoan gan voi API key nay khong con hoat dong"}` |
| 429 | Vượt quá 120 lần gọi/phút cho 1 key (kèm header `Retry-After`, giây) | `{"success":false,"message":"Vuot qua gioi han so lan goi API..."}` |

Tài khoản gắn với key bị khóa/xóa qua màn hình "Tài khoản" sẽ khiến API key **ngay lập tức không dùng được nữa** (đối chiếu trạng thái mới nhất mỗi request, cùng cơ chế với phiên đăng nhập JWT) — không cần thu hồi riêng key, dù thu hồi key vẫn là cách rõ ràng hơn khi đối tác không còn cần tích hợp.

## 4. Quản lý API key (admin)

Màn hình "API đối tác" (menu Quản trị → API đối tác) cho phép:
- **Tạo key mới**: chọn tài khoản nhân viên, đặt tên/nhãn, chọn quyền (check/redeem). Key thật **chỉ hiển thị 1 lần duy nhất** lúc tạo (server chỉ lưu SHA-256 hash, không lưu bản rõ) — phải sao chép ngay và gửi cho đối tác.
- **Thu hồi key**: vô hiệu hóa ngay lập tức, không xóa (giữ vết cho đối soát/nhật ký quản trị).

API quản trị tương ứng (yêu cầu JWT + quyền admin, không dùng cho đối tác):

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/partner-api-keys` | Danh sách toàn bộ key (còn hiệu lực lẫn đã thu hồi) |
| POST | `/api/partner-api-keys` | Tạo key mới — body `{userId, label, canCheck, canRedeem}` |
| DELETE | `/api/partner-api-keys/:id` | Thu hồi 1 key |

---

## Tham khảo thêm

Tài liệu này là bản trích từ `README.md` của repo, đã đối chiếu lại với code hiện hành tại thời điểm tạo:
- Phần A: `src/controllers/voucher.controller.js`, `src/services/voucherService.js`, `src/routes/voucher.routes.js` (mục 4b–4d và mục 5 của README).
- Phần B: `src/controllers/partnerVoucher.controller.js`, `src/middleware/apiKeyAuth.js`, `src/services/partnerApiKeyService.js`, `src/routes/partnerVoucher.routes.js`, `src/controllers/partnerApiKey.controller.js`, `src/routes/partnerApiKey.routes.js`.

Khi code các file này thay đổi, cần cập nhật lại tài liệu tương ứng.
