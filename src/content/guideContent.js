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
<div class="guide-figure">
  <img class="guide-screenshot" src="/images/guide-business/01-dang-nhap.png" alt="Màn hình đăng nhập: tên đăng nhập, mật khẩu, mã xác thực hình ảnh" />
  <p class="cap">Màn hình đăng nhập</p>
</div>
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
<div class="guide-figure">
  <img class="guide-screenshot" src="/images/guide-business/02-san-sang-quet.png" alt="Màn hình Quét voucher ở trạng thái sẵn sàng, chưa quét mã nào" />
  <p class="cap">Màn hình "Quét voucher" khi sẵn sàng quét</p>
</div>
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
    <div class="guide-figure">
      <img class="guide-screenshot" src="/images/guide-business/03-con-dung-duoc.png" alt="Kết quả kiểm tra: voucher chưa sử dụng, hiện mệnh giá/ngày cấp/hạn sử dụng và nút Xác nhận thu hồi" />
      <p class="cap">Voucher còn dùng được - sẵn sàng xác nhận thu hồi</p>
    </div>
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
    <div class="guide-figure">
      <img class="guide-screenshot" src="/images/guide-business/04-xac-nhan-thu-hoi.png" alt="Hộp thoại hỏi lại: Bạn có muốn thu hồi voucher này không, kèm nút Có thu hồi và Không" />
      <p class="cap">Hộp thoại hỏi lại trước khi thu hồi thật</p>
    </div>
  </li>
  <li>Ô nhập sẽ <strong>tự động quay lại</strong> để sẵn sàng quét mã tiếp theo.</li>
</ol>

<h2>3. Quét nhiều voucher - Thu hồi 1 lần</h2>
<p>Dùng khi 1 khách có <strong>nhiều voucher muốn thu hồi cùng lúc</strong> (thay vì phải xác
nhận "Có, thu hồi" từng cái một) - quét nhiều mã vào 1 danh sách tạm, xem lại/bớt bớt, rồi bấm
<strong>1 nút duy nhất</strong> để thu hồi toàn bộ.</p>
<ol>
  <li>Bấm <strong>"Quét nhiều"</strong> trong ô "Chế độ quét" ở đầu trang (mặc định đang là
    "Quét từng cái").
    <div class="guide-figure">
      <img class="guide-screenshot" src="/images/guide-business/07-quet-nhieu-mo-che-do.png" alt="Chuyển chế độ quét sang Quét nhiều, màn hình sẵn sàng quét nhiều voucher" />
      <p class="cap">Chuyển sang chế độ "Quét nhiều"</p>
    </div>
  </li>
  <li>Quét lần lượt từng voucher như bình thường - <strong>mỗi mã quét xong tự động thêm vào
    danh sách</strong> bên dưới (kèm mệnh giá + tổng tạm tính), <strong>chưa thu hồi ngay</strong>,
    sẵn sàng quét mã tiếp theo luôn. Mã không hợp lệ (đã dùng/hết hạn...) sẽ báo lỗi và
    <strong>không</strong> được thêm vào danh sách. Muốn bớt 1 voucher khỏi danh sách (khách đổi
    ý không lấy nữa) thì bấm nút <strong>✕</strong> cạnh mã đó; bấm "Xóa hết" để làm lại từ đầu.
    Danh sách tối đa 20 voucher.
    <div class="guide-figure">
      <img class="guide-screenshot" src="/images/guide-business/08-quet-nhieu-danh-sach.png" alt="Danh sách các voucher đã quét, chưa thu hồi, kèm tổng tạm tính và nút Thu hồi tất cả" />
      <p class="cap">Danh sách voucher đang chờ thu hồi</p>
    </div>
  </li>
  <li>Quét xong hết, bấm <strong>"Thu hồi tất cả"</strong> - hộp thoại hỏi lại hiện rõ
    <strong>tổng số voucher + tổng mệnh giá</strong>, bấm "Có, thu hồi" để xác nhận.
    <div class="guide-figure">
      <img class="guide-screenshot" src="/images/guide-business/09-quet-nhieu-xac-nhan.png" alt="Hộp thoại xác nhận thu hồi tất cả voucher trong danh sách, kèm tổng số voucher và tổng mệnh giá" />
      <p class="cap">Xác nhận thu hồi cả danh sách</p>
    </div>
  </li>
  <li>Xem kết quả: mỗi voucher có trạng thái riêng (<strong>"Đã thu hồi"</strong> màu xanh,
    <strong>"Đã thu hồi (chờ đồng bộ)"</strong> màu vàng, hoặc <strong>"Thất bại"</strong> màu đỏ
    kèm lý do cụ thể) - dòng <strong>"Tổng THỰC THU"</strong> ở cuối là số tiền THẬT SỰ đã thu hồi
    được (không tính các voucher thất bại).
    <div class="guide-figure">
      <img class="guide-screenshot" src="/images/guide-business/10-quet-nhieu-ket-qua.png" alt="Kết quả thu hồi hàng loạt: từng voucher kèm trạng thái riêng và tổng thực thu cuối cùng" />
      <p class="cap">Kết quả sau khi thu hồi cả danh sách</p>
    </div>
  </li>
</ol>
<p class="hint"><strong>Lưu ý quan trọng</strong>: 1 voucher trong danh sách bị lỗi (ví dụ vừa bị
quầy khác thu hồi trước, hoặc mất mạng đúng lúc xử lý mã đó) <strong>CHỈ làm mã đó thất bại</strong>,
KHÔNG ảnh hưởng các voucher khác trong cùng đợt - vì vậy "Tổng THỰC THU" hiển thị sau cùng mới là
số tiền chính xác cần thu của khách, không phải tổng lúc mới quét xong.</p>

<h2>4. Các tình huống thường gặp</h2>
<p><strong>"Voucher này đã được sử dụng"</strong>: mã voucher đã bị tiêu trước đó (có thể do
chính mình quét nhầm lại, hoặc quầy/thiết bị khác đã tiêu trước). Không thể thu hồi lại - báo
khách hàng kiểm tra lại voucher.</p>
<div class="guide-figure">
  <img class="guide-screenshot" src="/images/guide-business/05-da-su-dung.png" alt="Kết quả kiểm tra: voucher đã sử dụng (màu đỏ), chỉ còn nút Quét mã khác" />
  <p class="cap">Voucher đã sử dụng - không thể thu hồi lại</p>
</div>
<p><strong>"Tài khoản tạm khóa quét voucher do có quá nhiều lần kiểm tra không hợp lệ"</strong>:
hệ thống tự động khóa tạm (vài phút) nếu quét liên tục nhiều mã không hợp lệ/không tồn tại - đây
là cơ chế bảo vệ, tự hết sau ít phút, không cần làm gì.</p>
<p><strong>"Phiên đăng nhập không còn hiệu lực, vui lòng đăng nhập lại"</strong>: phiên làm việc
đã hết hạn (mặc định sau 8 tiếng không hoạt động) hoặc tài khoản vừa bị quản trị thay đổi trạng
thái - đăng nhập lại bình thường.</p>
<p><strong>"Tài khoản này vừa đăng nhập ở 1 nơi khác, phiên này không còn hiệu lực"</strong>:
<strong>mỗi tài khoản chỉ được đăng nhập ở DUY NHẤT 1 nơi tại 1 thời điểm</strong> - nếu đăng nhập
cùng 1 tài khoản ở máy/thiết bị khác, phiên đang mở trước đó sẽ tự động bị đăng xuất ngay (không
đợi hết 8 tiếng). Nếu thấy thông báo này ngoài ý muốn, có thể đồng nghiệp khác đã lỡ dùng chung
tài khoản của bạn - mỗi người nên dùng đúng tài khoản riêng của mình.</p>
<p><strong>"Tài khoản của bạn đang quét/thu hồi 1 mã khác..."</strong>:
1 tài khoản <strong>không thể quét/thu hồi 2 mã voucher khác nhau cùng lúc</strong> (vd đang đăng
nhập đồng thời ở 2 nơi, hoặc bấm quét liên tục quá nhanh) - đợi vài giây cho lượt quét trước hoàn
tất rồi quét lại mã mới.</p>
<p><strong>"Tài khoản của bạn đã thu hồi quá nhiều voucher trong thời gian ngắn, tạm khóa..."</strong>:
hệ thống giới hạn tốc độ thu hồi của mỗi tài khoản (chống gian lận/script tự động) - nếu thấy
thông báo này trong lúc thao tác bình thường (vd ngày cao điểm, quầy đông khách), báo quản trị
viên để xem xét nới lại giới hạn cho phù hợp thực tế.</p>
<p><strong>"Hệ thống voucher ... đang bị khóa"</strong>: quản trị viên đã tạm khóa hệ thống
voucher bạn vừa chọn (menu "Kết nối API") - không thể quét/thu hồi bằng hệ thống này cho đến khi
được mở khóa lại. Chọn hệ thống voucher khác (nếu có) hoặc báo quản trị viên.</p>

<h2>5. Các loại báo cáo</h2>
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
<div class="guide-figure">
  <img class="guide-screenshot" src="/images/guide-business/06-bao-cao-doi-soat.png" alt="Ví dụ màn hình Báo cáo đối soát: bộ lọc theo ngày/công ty/điểm/tài khoản và bảng tổng hợp theo địa điểm" />
  <p class="cap">Ví dụ: Báo cáo đối soát - chọn khoảng ngày rồi bấm "Xem báo cáo"</p>
</div>
<p class="hint">Cột "Đồng bộ" trong bảng giao dịch gần đây cho biết 1 giao dịch đã được hệ thống
trung tâm xác nhận (ĐÃ ĐỒNG BỘ) hay vẫn đang chờ gửi lại (CHỜ ĐỒNG BỘ) - xem lại mục 2 ở trên.</p>

<h2>6. Nhận báo cáo qua email tự động</h2>
<p>Nếu tài khoản của bạn xem được ít nhất 1 trong 3 loại báo cáo ở mục 5, bạn có thể tự tạo 1
<strong>lịch gửi báo cáo qua email</strong> (menu "Lịch gửi email báo cáo") thay vì phải vào xem
rồi tự xuất Excel mỗi lần: chọn loại báo cáo, khoảng ngày (có cả lựa chọn tự chọn Từ ngày-Đến
ngày), hệ thống voucher muốn gửi (bắt buộc tick ít nhất 1), email người nhận, và tần suất gửi
(hàng ngày/tuần/tháng). Bạn chỉ thấy và quản lý được đúng lịch do chính mình tạo. Dữ liệu gửi đi
luôn đúng phạm vi bạn đang được phép xem tại thời điểm gửi, không rộng hơn những gì bạn tự xem
được trên màn hình báo cáo.</p>

<h2>7. Bảo mật/tài khoản cá nhân</h2>
<p>Vào mục "Bảo mật" trên topbar để: đăng ký vân tay/Face ID cho thiết bị đang dùng, xem/đổi
thiết bị xác thực hai yếu tố (nếu là quản trị).</p>

<h2>8. Cài ứng dụng ra màn hình chính (Android/iOS)</h2>
<p>Cài ra màn hình chính giúp mở ứng dụng nhanh như 1 app bình thường (bấm vào icon là vào thẳng
màn hình quét, không hiện thanh địa chỉ trình duyệt) - nên làm trên điện thoại dùng quét voucher
hàng ngày.</p>
<h3>Trên điện thoại Android (trình duyệt Chrome)</h3>
<ol>
  <li>Mở Chrome, vào đúng địa chỉ web của hệ thống, đăng nhập như bình thường.</li>
  <li>Chạm vào nút <strong>menu 3 chấm</strong> ở góc trên bên phải trình duyệt.</li>
  <li>Chọn <strong>"Cài đặt ứng dụng"</strong> (hoặc "Thêm vào Màn hình chính" - tùy phiên bản
    Chrome dùng chữ hơi khác nhau).</li>
  <li>Xác nhận - icon ứng dụng sẽ xuất hiện ngay trên màn hình chính như các app khác.</li>
</ol>
<h3>Trên iPhone/iPad (bắt buộc dùng trình duyệt Safari)</h3>
<p class="hint">Chỉ Safari làm được việc này trên iPhone/iPad - mở bằng Chrome/Cốc Cốc... trên
iOS sẽ KHÔNG thấy tùy chọn "Thêm vào MH chính" (giới hạn của Apple, không phải lỗi ứng dụng).</p>
<ol>
  <li>Mở <strong>Safari</strong>, vào đúng địa chỉ web của hệ thống, đăng nhập như bình thường.</li>
  <li>Chạm nút <strong>Chia sẻ</strong> (hình vuông có mũi tên đi lên) ở thanh công cụ.</li>
  <li>Cuộn xuống, chọn <strong>"Thêm vào MH chính"</strong> (Add to Home Screen).</li>
  <li>Có thể đổi tên hiển thị dưới icon nếu muốn, rồi chạm <strong>"Thêm"</strong> ở góc trên.</li>
  <li>Icon ứng dụng sẽ xuất hiện ngay trên màn hình chính.</li>
</ol>
<p class="hint">Từ sau khi cài, nên mở ứng dụng bằng <strong>icon vừa tạo</strong> trên màn hình
chính (thay vì mở lại qua trình duyệt) để có trải nghiệm toàn màn hình, không bị thanh địa chỉ
che mất nội dung.</p>
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
  <li><strong>Công tắc Bật/Tắt 1 kết nối</strong>: gạt sang <strong>Tắt</strong> sẽ tạm vô hiệu
    hóa hoàn toàn kết nối đó (dòng hiện mờ đi + nhãn "ĐÃ KHÓA") mà <strong>không xóa cấu hình đã
    lưu</strong> - kết nối bị tắt sẽ biến mất khỏi ô chọn "Hệ thống voucher" trên màn Quét voucher
    và không thể "Kích hoạt". Dùng khi cần tạm ngừng 1 hệ thống (đối tác tạm ngừng hợp tác, Core
    đang bảo trì dài hạn...) mà muốn giữ lại cấu hình để dùng lại sau, thay vì phải xóa rồi khai
    báo lại từ đầu. Gạt lại sang <strong>Bật</strong> để dùng lại bình thường ngay, không mất gì.</li>
</ul>
<p class="hint">Ví dụ điền form cụ thể cho 1 kiểu Core API xác thực bằng API Key riêng (header
<code>X-API-Key</code>) được trình bày chi tiết trong tài liệu kỹ thuật repo (README.md mục
4a) - liên hệ đội phát triển nếu cần tham khảo khi cấu hình với 1 đối tác mới.</p>

<h2>2a. Luồng xử lý 1 giao dịch quét – thu hồi</h2>
<p>Hiểu đúng luồng xử lý dưới đây giúp bạn (quản trị) giải thích được cho nhân viên vì sao có
trạng thái "Chờ đồng bộ", và biết cần kiểm tra ở đâu khi có sự cố:</p>

<div class="guide-figure">
  <svg viewBox="0 0 1040 900" font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="gArrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#374151"/>
      </marker>
    </defs>
    <g font-size="11.5" font-weight="700" fill="#1f2937">
      <rect x="45" y="12" width="110" height="34" rx="6" fill="#fff4e8" stroke="#c07a33"/>
      <text x="100" y="33" text-anchor="middle">Nhân viên thu hồi</text>
      <rect x="262" y="12" width="116" height="34" rx="6" fill="#eef2f6" stroke="#9aa3af"/>
      <text x="320" y="33" text-anchor="middle">Giao diện quét</text>
      <rect x="482" y="12" width="116" height="34" rx="6" fill="#eef2f6" stroke="#9aa3af"/>
      <text x="540" y="33" text-anchor="middle">Voucher API</text>
      <rect x="692" y="12" width="116" height="34" rx="6" fill="#eef2f6" stroke="#9aa3af"/>
      <text x="750" y="33" text-anchor="middle">VOUCHER_SYNC</text>
      <rect x="892" y="12" width="116" height="34" rx="6" fill="#fff4e8" stroke="#c07a33"/>
      <text x="950" y="33" text-anchor="middle">Core Voucher API</text>
    </g>
    <g stroke="#c3c9d1" stroke-width="1.2" stroke-dasharray="3 3">
      <line x1="100" y1="46" x2="100" y2="876"/>
      <line x1="320" y1="46" x2="320" y2="876"/>
      <line x1="540" y1="46" x2="540" y2="876"/>
      <line x1="750" y1="46" x2="750" y2="876"/>
      <line x1="950" y1="46" x2="950" y2="876"/>
    </g>
    <rect x="60" y="345" width="930" height="500" fill="none" stroke="#8a4a16" stroke-width="1.3"/>
    <path d="M60,345 L150,345 L150,361 L138,373 L60,373 Z" fill="#fff4e8" stroke="#8a4a16" stroke-width="1.2"/>
    <text x="70" y="364" font-size="11" font-weight="700" fill="#8a4a16">ALT</text>
    <text x="158" y="364" font-size="11" fill="#5b4632">[ Voucher CHƯA tiêu ]</text>
    <rect x="490" y="470" width="480" height="260" fill="none" stroke="#9aa3af" stroke-width="1.1"/>
    <path d="M490,470 L580,470 L580,486 L568,498 L490,498 Z" fill="#eef2f6" stroke="#9aa3af" stroke-width="1"/>
    <text x="500" y="489" font-size="10.5" font-weight="700" fill="#374151">ALT</text>
    <text x="588" y="489" font-size="10.5" fill="#4b5563">[ Core phản hồi THÀNH CÔNG ]</text>
    <line x1="490" y1="585" x2="970" y2="585" stroke="#9aa3af" stroke-width="1" stroke-dasharray="6 3"/>
    <text x="500" y="600" font-size="10.5" fill="#4b5563">else [ Core MẤT KẾT NỐI (timeout, bảo trì&hellip;) ]</text>
    <g font-size="11" fill="#1f2937">
      <line x1="100" y1="90" x2="320" y2="90" stroke="#374151" stroke-width="1.4" marker-end="url(#gArrow2)"/>
      <text x="210" y="83" text-anchor="middle">1. Quét mã voucher</text>
      <line x1="320" y1="120" x2="540" y2="120" stroke="#374151" stroke-width="1.4" marker-end="url(#gArrow2)"/>
      <text x="430" y="113" text-anchor="middle">2. POST /api/vouchers/check</text>
      <line x1="540" y1="150" x2="950" y2="150" stroke="#374151" stroke-width="1.4" marker-end="url(#gArrow2)"/>
      <text x="745" y="143" text-anchor="middle">3. Kiểm tra trạng thái voucher</text>
      <line x1="950" y1="180" x2="540" y2="180" stroke="#374151" stroke-width="1.4" stroke-dasharray="6 3" marker-end="url(#gArrow2)"/>
      <text x="745" y="173" text-anchor="middle">4. UNUSED / USED / EXPIRED / CANCELLED</text>
      <line x1="540" y1="210" x2="320" y2="210" stroke="#374151" stroke-width="1.4" stroke-dasharray="6 3" marker-end="url(#gArrow2)"/>
      <text x="430" y="203" text-anchor="middle">5. Kết quả kiểm tra</text>
      <line x1="100" y1="400" x2="320" y2="400" stroke="#374151" stroke-width="1.4" marker-end="url(#gArrow2)"/>
      <text x="210" y="393" text-anchor="middle">6. Bấm "Xác nhận thu hồi"</text>
      <line x1="320" y1="430" x2="540" y2="430" stroke="#374151" stroke-width="1.4" marker-end="url(#gArrow2)"/>
      <text x="430" y="423" text-anchor="middle">7. POST /api/vouchers/redeem</text>
      <line x1="540" y1="446" x2="950" y2="446" stroke="#374151" stroke-width="1.4" marker-end="url(#gArrow2)"/>
      <text x="745" y="439" text-anchor="middle">8. Báo thu hồi (redeem)</text>
      <line x1="950" y1="520" x2="540" y2="520" stroke="#374151" stroke-width="1.4" stroke-dasharray="6 3" marker-end="url(#gArrow2)"/>
      <text x="745" y="513" text-anchor="middle">9. success = true</text>
      <line x1="540" y1="550" x2="750" y2="550" stroke="#374151" stroke-width="1.4" marker-end="url(#gArrow2)"/>
      <text x="645" y="543" text-anchor="middle">10. Ghi VOUCHER_SYNC, Sync = Y</text>
      <line x1="540" y1="625" x2="750" y2="625" stroke="#374151" stroke-width="1.4" marker-end="url(#gArrow2)"/>
      <text x="645" y="618" text-anchor="middle">11. Ghi VOUCHER_SYNC, Sync = N (vào hàng đợi)</text>
    </g>
    <rect x="560" y="645" width="400" height="48" rx="4" fill="#fff8e6" stroke="#e7cf8c" stroke-width="1"/>
    <text x="760" y="663" text-anchor="middle" font-size="10" fill="#6b5410">Job nền (syncRetryService) sẽ tự động gọi lại Core</text>
    <text x="760" y="678" text-anchor="middle" font-size="10" fill="#6b5410">định kỳ cho tới khi thành công.</text>
    <g font-size="11" fill="#1f2937">
      <line x1="540" y1="770" x2="320" y2="770" stroke="#374151" stroke-width="1.4" stroke-dasharray="6 3" marker-end="url(#gArrow2)"/>
      <text x="430" y="763" text-anchor="middle">12. Báo thu hồi thành công cho nhân viên</text>
    </g>
    <line x1="60" y1="800" x2="990" y2="800" stroke="#8a4a16" stroke-width="1" stroke-dasharray="6 3"/>
    <text x="70" y="815" font-size="11" fill="#5b4632">else [ Voucher ĐÃ tiêu ]</text>
    <g font-size="11" fill="#1f2937">
      <line x1="540" y1="828" x2="320" y2="828" stroke="#374151" stroke-width="1.4" stroke-dasharray="6 3" marker-end="url(#gArrow2)"/>
      <text x="430" y="816" text-anchor="middle">13. Từ chối, hiện cảnh báo đỏ,</text>
      <text x="430" y="846" text-anchor="middle" font-size="10">bắt buộc quét mã khác</text>
    </g>
  </svg>
  <div class="cap">Trình tự xử lý 1 lượt quét – thu hồi, bao gồm nhánh Core mất kết nối tạm thời</div>
</div>

<ol>
  <li><strong>Quét mã (kiểm tra)</strong>: app gọi ngay sang Core Voucher API (qua kết nối đang
    "Kích hoạt" ở mục 2 phía trên) để hỏi trạng thái voucher - còn dùng được / đã sử dụng / hết
    hạn / đã hủy. Bước này <strong>chưa đổi trạng thái</strong> gì ở Core, quét lại nhiều lần
    không ảnh hưởng.</li>
  <li><strong>Nhân viên bấm "Xác nhận thu hồi"</strong> (sau khi xác nhận lại ở hộp thoại hỏi
    lại): app mới gọi tiếp sang Core API để báo thu hồi thật - đây là bước thật sự đổi trạng thái
    voucher thành "đã dùng" phía Core.</li>
  <li>Core phản hồi theo 1 trong 2 trường hợp:
    <ul>
      <li><strong>Thành công</strong>: app ghi 1 dòng vào bảng <code>VOUCHER_SYNC</code> với cờ
        <strong>"Đã đồng bộ"</strong> - đây chính là nguồn dữ liệu hiển thị ở cả 3 loại báo cáo
        (xem mục "Các loại báo cáo" ở Hướng dẫn nghiệp vụ).</li>
      <li><strong>Core mất kết nối tạm thời</strong> (timeout, đang bảo trì...): app
        <strong>vẫn cho nhân viên thu hồi thành công ngay tại quầy</strong> (không bắt khách hàng
        chờ), ghi vào <code>VOUCHER_SYNC</code> với cờ <strong>"Chờ đồng bộ"</strong> như 1 hàng
        đợi. Một tiến trình chạy nền sẽ tự động gọi lại Core định kỳ cho tới khi thành công -
        quản trị viên <strong>không cần thao tác gì thêm</strong>.</li>
    </ul>
  </li>
  <li>Mọi lượt quét/thu hồi (kể cả thất bại) được ghi vào "Hoạt động quét/thu hồi" (mục 6 bên
    dưới) để tra soát, chống gian lận; riêng mỗi lần tiến trình nền chạy lại (thành công hay thất
    bại) được ghi vào 1 nhật ký đồng bộ hệ thống riêng.</li>
</ol>
<p class="hint">Nguyên tắc quan trọng nhất: app <strong>không bao giờ tự quyết định</strong> 1
voucher đã dùng hay chưa - Core Voucher API luôn là nguồn dữ liệu duy nhất đúng, app chỉ ghi lại
để phục vụ đối soát/báo cáo. Nếu thấy nhiều giao dịch kẹt ở "Chờ đồng bộ" liên tục không tự
chuyển sang "Đã đồng bộ", kiểm tra lại kết nối ở mục 2 phía trên - khả năng cao Core đang mất kết
nối kéo dài hoặc cấu hình endpoint đã bị sai.</p>

<h2>2b. Tích hợp đa hệ thống voucher (vd HCRC &amp; Fuji)</h2>
<p>Ngoài hệ thống voucher mặc định, ứng dụng có thể tích hợp <strong>đồng thời nhiều hệ thống
voucher</strong> của nhiều đối tác khác nhau cùng lúc (vd hệ thống hiện tại + "Fuji") - đây là
2 luồng xử lý <strong>tách biệt hoàn toàn</strong> ở phía Core, nhưng hội tụ về <strong>chung 1
lớp ứng dụng và 1 bộ dữ liệu</strong> để báo cáo/đối soát thống nhất:</p>

<div class="guide-figure">
  <svg viewBox="0 0 1040 740" font-family="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="gArrow3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#4b5563"/>
      </marker>
    </defs>
    <rect x="320" y="16" width="400" height="60" rx="8" fill="#fff" stroke="#9a9184" stroke-width="1.4"/>
    <text x="520" y="40" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2937">Màn hình Quét voucher</text>
    <text x="520" y="56" text-anchor="middle" font-size="10" fill="#6b7280">Nhân viên chọn hệ thống trước khi quét (nếu ≥ 2 kết nối sẵn sàng)</text>
    <path d="M460,76 C 400,110 300,120 250,138" fill="none" stroke="#4b5563" stroke-width="1.6" marker-end="url(#gArrow3)"/>
    <path d="M580,76 C 640,110 740,120 790,138" fill="none" stroke="#4b5563" stroke-width="1.6" marker-end="url(#gArrow3)"/>
    <text x="330" y="100" text-anchor="middle" font-size="9.5" fill="#6b7280">connectionId = HCRC</text>
    <text x="710" y="100" text-anchor="middle" font-size="9.5" fill="#6b7280">connectionId = Fuji</text>
    <rect x="100" y="140" width="300" height="60" rx="6" fill="#fff4e8" stroke="#c07a33" stroke-width="1.4"/>
    <text x="250" y="164" text-anchor="middle" font-size="11.5" font-weight="700" fill="#8a4a16">Kết nối API: HCRC</text>
    <text x="250" y="180" text-anchor="middle" font-size="9.5" fill="#a9733f">ApiConnections Id=1 — mặc định "active"</text>
    <text x="250" y="192" text-anchor="middle" font-size="9.5" fill="#a9733f">Base URL + API Key + mapping riêng</text>
    <rect x="640" y="140" width="300" height="60" rx="6" fill="#eaf1ff" stroke="#2563eb" stroke-width="1.4"/>
    <text x="790" y="164" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1d4ed8">Kết nối API: Fuji</text>
    <text x="790" y="180" text-anchor="middle" font-size="9.5" fill="#3b5ec9">ApiConnections Id=2 — tích hợp thêm sau</text>
    <text x="790" y="192" text-anchor="middle" font-size="9.5" fill="#3b5ec9">Base URL + API Key + mapping riêng</text>
    <path d="M250,200 L250,250" fill="none" stroke="#8a4a16" stroke-width="1.6" marker-end="url(#gArrow3)"/>
    <path d="M790,200 L790,250" fill="none" stroke="#1d4ed8" stroke-width="1.6" marker-end="url(#gArrow3)"/>
    <rect x="100" y="252" width="300" height="60" rx="6" fill="#fff" stroke="#c07a33" stroke-width="1.6"/>
    <text x="250" y="276" text-anchor="middle" font-size="12" font-weight="700" fill="#8a4a16">Core Voucher API</text>
    <text x="250" y="292" text-anchor="middle" font-size="10.5" fill="#6b7280">của HCRC</text>
    <rect x="640" y="252" width="300" height="60" rx="6" fill="#fff" stroke="#2563eb" stroke-width="1.6"/>
    <text x="790" y="276" text-anchor="middle" font-size="12" font-weight="700" fill="#1d4ed8">Core Voucher API</text>
    <text x="790" y="292" text-anchor="middle" font-size="10.5" fill="#6b7280">của Fuji</text>
    <path d="M250,312 C 250,370 420,392 480,400" fill="none" stroke="#8a4a16" stroke-width="1.5" marker-end="url(#gArrow3)"/>
    <path d="M790,312 C 790,370 620,392 560,400" fill="none" stroke="#1d4ed8" stroke-width="1.5" marker-end="url(#gArrow3)"/>
    <rect x="190" y="402" width="660" height="66" rx="8" fill="#fff" stroke="#9a9184" stroke-width="1.5"/>
    <text x="520" y="426" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2937">VOUCHER_SYNC (bảng dùng chung, không tách riêng theo hệ thống)</text>
    <text x="520" y="443" text-anchor="middle" font-size="10" fill="#6b7280">Mỗi dòng luôn ghi rõ <tspan font-weight="700" fill="#1f2937">ConnectionName</tspan> = "HCRC" hoặc "Fuji" để truy vết/báo cáo</text>
    <text x="520" y="459" text-anchor="middle" font-size="10" fill="#6b7280">theo từng hệ thống (ô lọc "Hệ thống" ở 3 màn báo cáo)</text>
    <path d="M520,468 L520,494" fill="none" stroke="#4b5563" stroke-width="1.5" marker-end="url(#gArrow3)"/>
    <rect x="140" y="496" width="760" height="70" rx="6" fill="#fff8e6" stroke="#e7cf8c" stroke-width="1"/>
    <text x="520" y="518" text-anchor="middle" font-size="10.5" font-weight="700" fill="#6b5410">VoucherRedemptionConnections (khóa theo TRANS_NUM)</text>
    <text x="520" y="535" text-anchor="middle" font-size="10" fill="#6b5410">Ghi lại ĐÚNG hệ thống đã xử lý giao dịch "chờ đồng bộ" (mục 2a) — để tiến trình nền</text>
    <text x="520" y="550" text-anchor="middle" font-size="10" fill="#6b5410">gọi lại ĐÚNG hệ thống gốc, không gửi nhầm Fuji sang HCRC hay ngược lại</text>
    <rect x="100" y="590" width="300" height="100" rx="6" fill="#faf9f7" stroke="#d8d2c6" stroke-width="1.2"/>
    <text x="250" y="612" text-anchor="middle" font-size="10.5" font-weight="700" fill="#8a4a16">Phân quyền theo hệ thống</text>
    <text x="250" y="630" text-anchor="middle" font-size="9.5" fill="#4b5563">1 tài khoản có thể bị giới hạn</text>
    <text x="250" y="644" text-anchor="middle" font-size="9.5" fill="#4b5563">chỉ quét/thu hồi/xem báo cáo</text>
    <text x="250" y="658" text-anchor="middle" font-size="9.5" fill="#4b5563">đúng 1 hệ thống (vd chỉ HCRC)</text>
    <text x="250" y="674" text-anchor="middle" font-size="9.5" fill="#4b5563">— bảng UserVoucherSystems</text>
    <rect x="640" y="590" width="300" height="100" rx="6" fill="#f5f8ff" stroke="#c7d6f5" stroke-width="1.2"/>
    <text x="790" y="612" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1d4ed8">Tài khoản đối soát riêng</text>
    <text x="790" y="630" text-anchor="middle" font-size="9.5" fill="#4b5563">Vd 1 tài khoản đối soát</text>
    <text x="790" y="644" text-anchor="middle" font-size="9.5" fill="#4b5563">của đối tác Fuji chỉ thấy</text>
    <text x="790" y="658" text-anchor="middle" font-size="9.5" fill="#4b5563">đúng giao dịch/báo cáo</text>
    <text x="790" y="674" text-anchor="middle" font-size="9.5" fill="#4b5563">của hệ thống Fuji</text>
  </svg>
  <div class="cap">2 luồng Core tách biệt (HCRC/Fuji) hội tụ về chung 1 lớp dữ liệu ứng dụng, có gắn nhãn hệ thống để truy vết và phân quyền riêng</div>
</div>

<ul>
  <li>Mỗi hệ thống là <strong>1 kết nối riêng</strong> khai báo ở menu "Kết nối API" (mục 2 phía
    trên) - có Base URL, kiểu xác thực và ánh xạ field riêng; 2 kết nối có thể <strong>trùng Base
    URL</strong> (vd cùng 1 cổng API gateway) vì ứng dụng phân biệt bằng <strong>Id nội
    bộ</strong>, không phải Base URL.</li>
  <li>Khi có từ 2 kết nối "sẵn sàng" trở lên, màn hình "Quét voucher" sẽ hiện thêm ô chọn
    <strong>"Hệ thống voucher"</strong> để nhân viên chọn trước khi quét - mã kết nối được gửi
    kèm mỗi lần kiểm tra/thu hồi để dùng <strong>đúng hệ thống đó</strong> thay vì luôn lấy kết
    nối "Kích hoạt" mặc định.</li>
  <li>Dữ liệu <strong>không tách DB riêng</strong> cho từng hệ thống - vẫn ghi chung vào
    <code>VOUCHER_SYNC</code> (tránh phân mảnh báo cáo/đối soát), nhưng luôn gắn tên hệ thống để
    lọc/truy vết riêng (ô lọc "Hệ thống" có ở cả 3 màn báo cáo).</li>
  <li><strong>Điểm bắt buộc phải đúng</strong> khi 1 giao dịch rơi vào trạng thái "Chờ đồng bộ"
    (mục 2a phía trên): hệ thống ghi nhớ đúng hệ thống gốc đã xử lý giao dịch đó, để tiến trình
    nền gọi lại <strong>đúng hệ thống</strong> - tránh gửi nhầm 1 giao dịch của hệ thống A sang
    hệ thống B lúc đồng bộ lại.</li>
  <li>Có thể <strong>giới hạn 1 tài khoản chỉ dùng/xem đúng 1 (hoặc vài) hệ thống cụ thể</strong>
    ở màn hình "Tài khoản", cột "Hệ thống voucher được dùng" (mục 1 phía trên) - ví dụ cấp 1 tài
    khoản đối soát riêng cho đối tác Fuji sẽ chỉ thấy được giao dịch/báo cáo của Fuji, không lẫn
    với dữ liệu của hệ thống còn lại.</li>
</ul>
<p class="hint">Hệ thống đã có sẵn 1 kết nối "Fuji" ở dạng <strong>bản nháp</strong> (chưa điền
API Key) - chỉ cần vào "Kết nối API", sửa dòng "Fuji", điền đúng API Key do đối tác cung cấp rồi
lưu lại là dùng song song được ngay 2 hệ thống, không cần tạo kết nối mới.</p>

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

<h2>7. Gửi báo cáo qua email (SMTP + lịch gửi tự động)</h2>
<p>Cho phép gửi file Excel của 3 loại báo cáo (mục 5 ở Hướng dẫn nghiệp vụ) qua email theo lịch
định kỳ ngày/tuần/tháng, thay vì phải vào xem rồi tự xuất Excel mỗi lần.</p>

<h3>7a. Thiết lập email (menu Quản trị -&gt; Thiết lập email) - chỉ quản trị đầy đủ</h3>
<p>Khai báo <strong>1 máy chủ gửi email (SMTP) dùng chung</strong> cho toàn hệ thống: Host/Port/
Secure (SSL-TLS)/bỏ qua kiểm tra chứng chỉ TLS (dành cho máy chủ SMTP nội bộ dùng chứng chỉ tự
ký)/Username/Password/Email gửi (From)/Tên hiển thị. Bấm <strong>"Gửi thử"</strong> tới 1 địa chỉ
bất kỳ để xác nhận cấu hình đúng trước khi dựa vào dùng thật. Đây là hạ tầng dùng chung (địa chỉ
máy chủ nội bộ, mật khẩu tài khoản gửi mail thật) nên <strong>chỉ quản trị đầy đủ mới xem/sửa
được</strong> - "Quản trị đối tác" (vd Fuji, xem mục 2b) không thấy màn hình này.</p>
<p class="hint">Để trống ô Password khi sửa = giữ nguyên mật khẩu đã lưu (không bắt phải gõ lại
mỗi lần chỉnh sửa các trường khác).</p>

<h3>7b. Lịch gửi email báo cáo (menu "Lịch gửi email báo cáo") - dùng chung mọi tài khoản</h3>
<p>Mở cho <strong>bất kỳ tài khoản nào xem được ít nhất 1 trong 3 loại báo cáo</strong> (không
riêng quản trị) - mỗi người tự tạo lịch gửi cho chính mình hoặc cho đồng nghiệp/đối tác (ô "Email
người nhận"), không cần chia sẻ tài khoản chỉ để lấy báo cáo định kỳ.</p>
<ul>
  <li><strong>Báo cáo</strong>: chỉ hiện đúng loại tài khoản đang đăng nhập có quyền xem (giống
    hệt điều kiện của 3 màn hình báo cáo).</li>
  <li><strong>Khoảng ngày lấy dữ liệu</strong>: Hôm qua/Hôm nay/7 ngày/30 ngày/Tháng này/Tháng
    trước/Năm này/Năm trước, hoặc <strong>"Tự chọn khoảng ngày"</strong> để nhập thẳng 1 khoảng
    Từ ngày-Đến ngày cố định.</li>
  <li><strong>Công ty/Điểm thu hồi</strong>: lọc thêm tùy chọn, giống hệt bộ lọc trên màn hình báo
    cáo thường.</li>
  <li><strong>Hệ thống voucher</strong>: <strong>bắt buộc tick chọn rõ ràng ít nhất 1 hệ thống</strong>
    trong số hệ thống tài khoản đang được phép xem (không còn kiểu để trống = ngầm hiểu "gửi tất
    cả" như bản đầu tiên) - tránh gửi nhầm dữ liệu rộng hơn ý muốn khi tài khoản được cấp thêm
    quyền xem hệ thống mới sau này.</li>
  <li><strong>Tần suất</strong>: Hàng ngày, hoặc Hàng tuần (chọn thêm thứ), hoặc Hàng tháng (chọn
    thêm ngày trong tháng) + giờ gửi cụ thể.</li>
</ul>
<p>Danh sách lịch: <strong>Sửa / Gửi ngay / Tắt-Bật / Xóa</strong>. Quản trị đầy đủ thấy
<strong>toàn bộ</strong> lịch của mọi tài khoản; tài khoản khác (kể cả "Quản trị đối tác")
<strong>chỉ thấy lịch do chính mình tạo</strong>.</p>
<p class="hint"><strong>Phạm vi dữ liệu gửi đi luôn được tính lại TƯƠI ngay tại thời điểm gửi</strong>
theo đúng quyền hiện tại của người tạo lịch - không cố định từ lúc tạo. Nếu quyền xem của người
đó bị thu hẹp/thu hồi sau này (ví dụ đối tác Fuji bị rút bớt quyền xem 1 hệ thống), lịch đã tạo từ
trước sẽ <strong>tự động gửi dữ liệu hẹp lại theo đúng quyền mới</strong> mà không cần vào sửa lại
từng lịch. Hiện tại chỉ hỗ trợ file đính kèm Excel, chưa hỗ trợ PDF.</p>

<h2>8. Tài liệu kỹ thuật đầy đủ</h2>
<p>Bản hướng dẫn này tập trung vào thao tác trên giao diện admin. Các chủ đề sau dành cho đội
kỹ thuật/IT triển khai hệ thống (không thực hiện được qua trình duyệt): cài đặt server, biến
môi trường (.env), chạy migration CSDL, cấu hình nhiều worker, reverse proxy/HTTPS - xem file
<code>README.md</code> trong repo mã nguồn của hệ thống.</p>
`;

module.exports = { BUSINESS_GUIDE_HTML, SYSTEM_GUIDE_HTML };
