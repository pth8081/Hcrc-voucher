# Tài liệu API — Kiểm tra & Thu hồi (cập nhật) Voucher

**Ứng dụng:** HCRC Voucher Redemption
**Phiên bản tài liệu:** ứng với app v3.7
**Base URL:** `/api/vouchers`
**Xác thực:** bắt buộc header `Authorization: Bearer <token>` (JWT lấy từ `POST /api/auth/login`)
**Quyền yêu cầu:** tài khoản phải có quyền tính năng `canRedeemVoucher` (admin mặc định có; tài khoản nhân viên cần được cấp ở màn hình Tài khoản)

---

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

## 2. `POST /api/vouchers/redeem` — Xác nhận thu hồi (cập nhật trạng thái voucher)

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

## Tham khảo thêm

Tài liệu này là bản trích từ `README.md` của repo (mục 4b–4d và mục 5), đã đối chiếu lại với code hiện hành (`src/controllers/voucher.controller.js`, `src/services/voucherService.js`, `src/routes/voucher.routes.js`) tại thời điểm tạo. Khi code các file này thay đổi, cần cập nhật lại tài liệu tương ứng.
