/**
 * Noi dung 2 ban huong dan hien thi trong app (module "Huong dan", xem
 * guide.controller.js/guide.routes.js). Day la van ban TINH do chinh doi ngu phat trien tu bien,
 * KHONG lay tu du lieu nguoi dung/DB nao - an toan render truc tiep bang innerHTML o frontend
 * (khac voi moi truong hop khac trong app, luon phai escapeHtml() du lieu tu API/DB truoc khi
 * chen vao trang).
 *
 * Quy uoc trinh bay: tu ban cap nhat them dau tieng Viet nay, noi dung viet co dau day du cho
 * de doc (khac voi phan lon giao dien con lai cua app van dung chu khong dau).
 */

const BUSINESS_GUIDE_HTML = `
<h2>1. Đăng nhập</h2>
<p>Vào địa chỉ web của hệ thống, nhập tên đăng nhập + mật khẩu + mã xác thực hình ảnh (captcha).
Nếu là tài khoản <strong>quản trị</strong>, sau khi đăng nhập đúng mật khẩu sẽ cần nhập thêm mã
6 số từ ứng dụng xác thực (Google Authenticator/Microsoft Authenticator...) - xem mục "Bảo mật"
ở trang Hướng dẫn hệ thống nếu bạn là quản trị.</p>
<p>Nếu thiết bị (máy tính/tablet) đã từng đăng ký <strong>vân tay hoặc Face ID</strong>, có thể
bấm nút đăng nhập bằng sinh trắc học trên màn hình đăng nhập thay vì gõ mật khẩu mỗi lần.</p>
<p class="hint">Lần đăng nhập ĐẦU TIÊN vào hệ thống (hoặc sau khi được quản trị đặt lại mật
khẩu), bạn sẽ được yêu cầu <strong>đổi mật khẩu mới</strong> trước khi dùng tiếp - đây là bước
bắt buộc, không thể bỏ qua.</p>

<h2>2. Quét và thu hồi voucher</h2>
<p>Đây là màn hình chính, mở ngay sau khi đăng nhập (menu "Quét voucher").</p>
<ol>
  <li><strong>Quét mã</strong>: đưa mã voucher vào máy quét mã vạch/QR đang cắm vào máy tính
    (ô nhập sẽ tự động nhận ký tự và bấm Enter), hoặc bấm nút <strong>"Quét bằng camera"</strong>
    trên điện thoại/tablet không có máy quét rời. Hệ thống <strong>không cho gõ tay</strong> mã
    voucher để tránh nhầm lẫn.</li>
  <li><strong>Xem kết quả kiểm tra</strong>:
    <ul>
      <li>Nếu <strong>còn dùng được</strong>: hiện mệnh giá, ngày cấp, hạn sử dụng + nút
        <strong>"Xác nhận thu hồi"</strong>.</li>
      <li>Nếu <strong>đã sử dụng</strong> (màu đỏ): chỉ còn nút "Quét mã khác", không thu hồi
        được nữa.</li>
    </ul>
  </li>
  <li><strong>Bấm "Xác nhận thu hồi"</strong> sẽ hiện thêm 1 hộp thoại hỏi lại "Bạn có muốn thu
    hồi voucher này không?" - bấm <strong>"Có, thu hồi"</strong> để hoàn tất, hoặc
    <strong>"Không"</strong> để quay lại màn quét mà KHÔNG thu hồi gì cả (hệ thống voucher đang
    chọn - nếu có - vẫn giữ nguyên). Sau khi xác nhận "Có, thu hồi", hệ thống sẽ báo 1 trong 2
    kết quả:
    <ul>
      <li><strong>"Đã đồng bộ"</strong> (màu xanh): giao dịch đã được ghi nhận thành công về hệ
        thống trung tâm ngay lập tức.</li>
      <li><strong>"Đang chờ đồng bộ"</strong> (màu vàng): voucher ĐÃ được thu hồi thành công tại
        quầy của bạn (khách hàng có thể ra về bình thường), nhưng hệ thống trung tâm tạm thời
        mất kết nối - sẽ TỰ ĐỘNG gửi lại trong vài phút tới, không cần làm gì thêm. Nếu thấy
        nhiều giao dịch liên tục ở trạng thái này, báo cho quản trị viên kiểm tra đường truyền
        mạng.</li>
    </ul>
  </li>
  <li>Ô nhập sẽ <strong>tự động quay lại</strong> để sẵn sàng quét mã tiếp theo.</li>
</ol>

<h2>3. Các tình huống thường gặp</h2>
<p><strong>"Voucher này đã được sử dụng"</strong>: mã voucher đã bị tiêu trước đó (có thể do
chính mình quét nhầm lại, hoặc quầy/thiết bị khác đã tiêu trước). Không thể thu hồi lại - báo
khách hàng kiểm tra lại voucher.</p>
<p><strong>"Tài khoản tạm khóa quét voucher do có quá nhiều lần kiểm tra không hợp lệ"</strong>:
hệ thống tự động khóa tạm (vài phút) nếu quét liên tục nhiều mã không hợp lệ/không tồn tại - đây
là cơ chế bảo vệ, tự hết sau ít phút, không cần làm gì.</p>
<p><strong>"Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại"</strong>: phiên làm việc
đã hết hạn (mặc định sau 8 tiếng không hoạt động) hoặc tài khoản vừa bị quản trị thay đổi trạng
thái - đăng nhập lại bình thường.</p>

<h2>4. Các loại báo cáo</h2>
<p>Tùy theo quyền được cấp, menu có thể hiện 1 hoặc cả 3 loại báo cáo sau - mỗi loại phục vụ
mục đích khác nhau:</p>
<table>
  <thead><tr><th>Báo cáo</th><th>Xem theo</th><th>Dùng khi nào</th></tr></thead>
  <tbody>
    <tr>
      <td><strong>Báo cáo đối soát</strong></td>
      <td>1 ngày cụ thể, nhóm theo địa điểm của tài khoản đăng nhập</td>
      <td>Đối soát hàng ngày - số liệu thu hồi trong ngày của chính điểm tiêu mình phụ trách</td>
    </tr>
    <tr>
      <td><strong>Báo cáo tổng hợp</strong></td>
      <td>1 khoảng ngày tùy chọn, cộng dồn 2 cấp Công ty -> Điểm tiêu</td>
      <td>Xem tổng quan nhiều điểm tiêu/nhiều công ty trong 1 khoảng thời gian (tháng, quý...)</td>
    </tr>
    <tr>
      <td><strong>Voucher đã sử dụng</strong></td>
      <td>Danh sách phẳng (không cộng dồn), lọc theo ngày tùy chọn</td>
      <td>Tra cứu chi tiết từng giao dịch, xuất ra file Excel để lưu trữ/gửi báo cáo</td>
    </tr>
  </tbody>
</table>
<p class="hint">Cột "Đồng bộ" trong bảng giao dịch gần đây cho biết 1 giao dịch đã được hệ thống
trung tâm xác nhận (ĐÃ ĐỒNG BỘ) hay vẫn đang chờ gửi lại (CHỜ ĐỒNG BỘ) - xem lại mục 2 ở trên.</p>

<h2>5. Bảo mật/tài khoản cá nhân</h2>
<p>Vào mục "Bảo mật" trên topbar để: đăng ký vân tay/Face ID cho thiết bị đang dùng, xem/đổi
thiết bị xác thực hai yếu tố (nếu là quản trị).</p>
`;

const SYSTEM_GUIDE_HTML = `
<h2>1. Quản lý tài khoản (menu Quản trị -&gt; Tài khoản)</h2>
<p>Màn hình này quản lý toàn bộ người dùng của hệ thống:</p>
<ul>
  <li><strong>Tạo tài khoản mới</strong>: nhập tên đăng nhập, họ tên, mật khẩu tạm, gán
    <strong>điểm tiêu</strong> (Locations_Detail) - mỗi tài khoản thường gắn với 1 điểm tiêu cố
    định, dùng để xác định phạm vi báo cáo/đối soát của tài khoản đó.</li>
  <li><strong>6 quyền tính năng</strong> (bật/tắt riêng cho từng tài khoản nhân viên - tài khoản
    quản trị luôn có đủ tất cả, ở cột bị khóa):
    <table>
      <thead><tr><th>Quyền</th><th>Mặc định</th><th>Ảnh hưởng</th></tr></thead>
      <tbody>
        <tr><td>Thu hồi voucher</td><td>Bật</td><td>Được quét/thu hồi + thấy menu "Quét voucher"</td></tr>
        <tr><td>Đối soát</td><td>Bật</td><td>Xem được "Báo cáo đối soát"</td></tr>
        <tr><td>Tổng hợp</td><td>Tắt</td><td>Xem được "Báo cáo tổng hợp"</td></tr>
        <tr><td>Voucher đã dùng</td><td>Tắt</td><td>Xem + xuất Excel danh sách voucher đã sử dụng</td></tr>
        <tr><td>Hướng dẫn nghiệp vụ</td><td>Bật</td><td>Xem được trang hướng dẫn này (bản dành cho nhân viên)</td></tr>
        <tr><td>Hướng dẫn hệ thống</td><td>Tắt</td><td>Xem được trang hướng dẫn này (bản bạn đang đọc)</td></tr>
      </tbody>
    </table>
  </li>
  <li><strong>Lịch hiệu lực tài khoản</strong> (Kích hoạt từ / Hết hạn): đặt ngày-giờ tài khoản
    bắt đầu/ngừng được đăng nhập - dùng cho nhân viên thời vụ, thực tập, hợp đồng có thời hạn.
    Để trống = không giới hạn.</li>
  <li><strong>Xóa/Khôi phục (xóa mềm)</strong>: nút "Xóa" chỉ ẨN tài khoản khỏi danh sách mặc
    định và chặn đăng nhập - KHÔNG mất dữ liệu, bấm "Khôi phục" bất kỳ lúc nào để dùng lại.</li>
  <li><strong>Nhóm quyền xem báo cáo</strong>: nếu tài khoản cần xem báo cáo của NHIỀU công ty
    (không chỉ công ty của chính mình), gán vào 1 "Nhóm quyền xem báo cáo" đã tạo sẵn (xem mục
    5 bên dưới).</li>
  <li><strong>Hệ thống voucher được dùng</strong>: nếu doanh nghiệp tích hợp nhiều hệ thống
    voucher cùng lúc (vd BRGmart + Fuji - xem mục 2 bên dưới), tick chọn 1 hoặc nhiều hệ thống
    để GIỚI HẠN tài khoản chỉ được dùng/xem đúng các hệ thống đó; không tick gì = không giới
    hạn, dùng/xem được toàn bộ hệ thống hiện có.</li>
</ul>

<h2>2. Kết nối tới Core Voucher API (menu Quản trị -&gt; Kết nối API)</h2>
<p>Đây là nơi khai báo hệ thống này sẽ gọi ra đâu để kiểm tra/thu hồi voucher thật - <strong>bắt
buộc phải có ít nhất 1 kết nối đang "Kích hoạt"</strong> thì màn hình "Quét voucher" mới hoạt
động đúng.</p>
<ul>
  <li>Khai báo <strong>Base URL</strong> + kiểu xác thực (Bearer Token / API Key riêng theo
    header / Basic Auth) - secret được mã hóa trước khi lưu, không bao giờ hiện lại bản rõ sau
    khi đã lưu.</li>
  <li>Khai báo riêng 2 endpoint <strong>Check</strong> (kiểm tra, không đổi trạng thái) và
    <strong>Redeem</strong> (thu hồi thật) - method, vị trí mã voucher (path/query/body), và
    <strong>ánh xạ các field</strong> trong phản hồi JSON trả về sang các trường chuẩn của app
    (status, mệnh giá, ngày cấp...).</li>
  <li><strong>Luôn bấm "Test kiểm tra"</strong> với 1 mã voucher thật ngay trên form (chưa cần
    Lưu) để xác nhận cấu hình đúng trước khi "Lưu &amp; Kích hoạt" cho toàn bộ hệ thống sử dụng.
    Riêng "Test thu hồi" sẽ <strong>tiêu thật</strong> voucher - chỉ dùng với mã không quan
    trọng.</li>
  <li>Có thể tạo <strong>nhiều kết nối cùng lúc</strong> (vd tích hợp thêm 1 hệ thống voucher thứ
    2 như Fuji bên cạnh hệ thống hiện tại) - chỉ 1 kết nối được đánh dấu "Kích hoạt" làm mặc
    định, nhưng nhân viên vẫn chọn được hệ thống khác ngay trên màn Quét voucher nếu tài khoản họ
    được phép dùng từ 2 hệ thống trở lên (xem mục "Hệ thống voucher được dùng" ở mục 1).</li>
</ul>
<p class="hint">Ví dụ điền form cụ thể cho 1 kiểu Core API xác thực bằng API Key riêng (header
<code>X-API-Key</code>) được trình bày chi tiết trong tài liệu kỹ thuật repo (README.md mục
4a) - liên hệ đội phát triển nếu cần tham khảo khi cấu hình với 1 đối tác mới.</p>

<h2>3. Bảo mật quản trị</h2>
<ul>
  <li><strong>Xác thực hai yếu tố (2FA) bắt buộc</strong> với mọi tài khoản quản trị: lần đăng
    nhập đầu tiên sẽ yêu cầu quét mã QR bằng ứng dụng Authenticator và nhập mã xác minh. Các lần
    đăng nhập sau chỉ cần nhập mã 6 số từ ứng dụng đó.</li>
  <li><strong>Mất thiết bị xác thực</strong>: một quản trị KHÁC vào menu "Bảo mật" -&gt; bảng
    "Quản trị viên &amp; trạng thái 2FA" -&gt; gỡ 2FA của người bị mất thiết bị (không thể tự gỡ
    2FA của chính mình, tránh 1 phiên bị chiếm quyền tự vô hiệu hóa lớp bảo vệ này). Người đó
    đăng nhập lại sẽ được yêu cầu thiết lập 2FA từ đầu.</li>
  <li><strong>Đặt lại mật khẩu hộ nhân viên</strong>: màn hình "Tài khoản", nhập mật khẩu mới
    vào ô "Mật khẩu mới" - tài khoản đó sẽ bị bắt buộc đổi lại mật khẩu (của họ tự đặt) ngay lần
    đăng nhập tiếp theo, VÀ mọi phiên đăng nhập cũ của họ sẽ tự động mất hiệu lực.</li>
</ul>

<h2>4. Công ty và Điểm tiêu (menu Quản trị -&gt; Đơn vị thu hồi)</h2>
<p>1 <strong>Công ty</strong> có thể có nhiều <strong>Điểm tiêu</strong> (vd 1 chuỗi nhiều chi
nhánh). Thông tin liên hệ/thuế/ngân hàng khai báo ở cấp Công ty, dùng chung cho toàn bộ điểm
tiêu của công ty đó. Điểm tiêu là đơn vị thực sự gắn với từng tài khoản nhân viên (xem mục 1).</p>

<h2>5. Nhóm quyền xem báo cáo theo công ty</h2>
<p>Mặc định 1 tài khoản chỉ xem được báo cáo của đúng công ty mình phụ trách. Nếu cần 1 tài
khoản xem được báo cáo CHÉO nhiều công ty (vd kế toán tổng hợp), tạo 1 "Nhóm quyền" (menu Quản
trị) chọn danh sách công ty được phép xem, rồi gán tài khoản đó vào nhóm (ở màn hình Tài khoản,
cột "Nhóm quyền xem báo cáo").</p>

<h2>6. Nhật ký hệ thống (menu Quản trị -&gt; Nhật ký hệ thống)</h2>
<p>2 tab trên cùng 1 trang:</p>
<ul>
  <li><strong>Nhật ký quản trị</strong>: ghi lại AI đã tạo tài khoản/đổi quyền/đổi lịch hiệu
    lực/gỡ 2FA người khác..., lúc nào.</li>
  <li><strong>Hoạt động quét/thu hồi</strong>: nhật ký TOÀN BỘ lần quét/kiểm tra của nhân viên
    (cả thành công lẫn thất bại), lọc theo ngày.</li>
</ul>

<h2>7. Tài liệu kỹ thuật đầy đủ</h2>
<p>Bản hướng dẫn này tập trung vào thao tác trên giao diện admin. Các chủ đề sau dành cho đội
kỹ thuật/IT triển khai hệ thống (không thực hiện được qua trình duyệt): cài đặt server, biến
môi trường (.env), chạy migration CSDL, cấu hình nhiều worker, reverse proxy/HTTPS - xem file
<code>README.md</code> trong repo mã nguồn của hệ thống.</p>
`;

module.exports = { BUSINESS_GUIDE_HTML, SYSTEM_GUIDE_HTML };
