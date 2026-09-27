/**
 * Noi dung 2 ban huong dan hien thi trong app (module "Huong dan", xem
 * guide.controller.js/guide.routes.js). Day la van ban TINH do chinh doi ngu phat trien tu bien,
 * KHONG lay tu du lieu nguoi dung/DB nao - an toan render truc tiep bang innerHTML o frontend
 * (khac voi moi truong hop khac trong app, luon phai escapeHtml() du lieu tu API/DB truoc khi
 * chen vao trang).
 *
 * Quy uoc trinh bay: giong voi toan bo giao dien con lai cua app (khong dau tieng Viet), de
 * nhat quan phong chu/kieu chu voi cac trang khac.
 */

const BUSINESS_GUIDE_HTML = `
<h2>1. Dang nhap</h2>
<p>Vao dia chi web cua he thong, nhap ten dang nhap + mat khau + ma xac thuc hinh anh (captcha).
Neu la tai khoan <strong>quan tri</strong>, sau khi dang nhap dung mat khau se can nhap them ma
6 so tu ung dung xac thuc (Google Authenticator/Microsoft Authenticator...) - xem muc "Bao mat"
o trang Huong dan he thong neu ban la quan tri.</p>
<p>Neu thiet bi (may tinh/tablet) da tung dang ky <strong>van tay hoac Face ID</strong>, co the
bam nut dang nhap bang sinh trac hoc tren man hinh dang nhap thay vi go mat khau moi lan.</p>
<p class="hint">Lan dang nhap DAU TIEN vao he thong (hoac sau khi duoc quan tri dat lai mat
khau), ban se duoc yeu cau <strong>doi mat khau moi</strong> truoc khi dung tiep - day la buoc
bat buoc, khong the bo qua.</p>

<h2>2. Quet va thu hoi voucher</h2>
<p>Day la man hinh chinh, mo ngay sau khi dang nhap (menu "Quet voucher").</p>
<ol>
  <li><strong>Quet ma</strong>: dua ma voucher vao may quet ma vach/QR dang cam vao may tinh
    (o nhap se tu dong nhan ky tu va bam Enter), hoac bam nut <strong>"Quet bang camera"</strong>
    tren dien thoai/tablet khong co may quet roi. He thong <strong>khong cho go tay</strong> ma
    voucher de tranh nham lan.</li>
  <li><strong>Xem ket qua kiem tra</strong>:
    <ul>
      <li>Neu <strong>con dung duoc</strong>: hien menh gia, ngay cap, han su dung + nut
        <strong>"Xac nhan thu hoi"</strong>.</li>
      <li>Neu <strong>da su dung</strong> (mau do): chi con nut "Quet ma khac", khong thu hoi
        duoc nua.</li>
    </ul>
  </li>
  <li><strong>Bam "Xac nhan thu hoi"</strong> de hoan tat. He thong se bao 1 trong 2 ket qua:
    <ul>
      <li><strong>"Da dong bo"</strong> (mau xanh): giao dich da duoc ghi nhan thanh cong ve he
        thong trung tam ngay lap tuc.</li>
      <li><strong>"Dang cho dong bo"</strong> (mau vang): voucher DA duoc thu hoi thanh cong tai
        quay cua ban (khach hang co the ra ve binh thuong), nhung he thong trung tam tam thoi
        mat ket noi - se TU DONG gui lai trong vai phut toi, khong can lam gi them. Neu thay
        nhieu giao dich lien tuc o trang thai nay, bao cho quan tri vien kiem tra duong truyen
        mang.</li>
    </ul>
  </li>
  <li>O nhap se <strong>tu dong quay lai</strong> de san sang quet ma tiep theo.</li>
</ol>

<h2>3. Cac tinh huong thuong gap</h2>
<p><strong>"Voucher nay da duoc su dung"</strong>: ma voucher da bi tieu truoc do (co the do
chinh minh quet nham lai, hoac quay/thiet bi khac da tieu truoc). Khong the thu hoi lai - bao
khach hang kiem tra lai voucher.</p>
<p><strong>"Tai khoan tam khoa quet voucher do co qua nhieu lan kiem tra khong hop le"</strong>:
he thong tu dong khoa tam (vai phut) neu quet lien tuc nhieu ma khong hop le/khong ton tai - day
la co che bao ve, tu het sau it phut, khong can lam gi.</p>
<p><strong>"Phien dang nhap khong con hieu luc, vui long dang nhap lai"</strong>: phien lam viec
da het han (mac dinh sau 8 tieng khong hoat dong) hoac tai khoan vua bi quan tri thay doi trang
thai - dang nhap lai binh thuong.</p>

<h2>4. Cac loai bao cao</h2>
<p>Tuy theo quyen duoc cap, menu co the hien 1 hoac ca 3 loai bao cao sau - moi loai phuc vu
muc dich khac nhau:</p>
<table>
  <thead><tr><th>Bao cao</th><th>Xem theo</th><th>Dung khi nao</th></tr></thead>
  <tbody>
    <tr>
      <td><strong>Bao cao doi soat</strong></td>
      <td>1 ngay cu the, nhom theo dia diem cua tai khoan dang nhap</td>
      <td>Doi soat hang ngay - so lieu thu hoi trong ngay cua chinh diem tieu minh phu trach</td>
    </tr>
    <tr>
      <td><strong>Bao cao tong hop</strong></td>
      <td>1 khoang ngay tuy chon, cong don 2 cap Cong ty -> Diem tieu</td>
      <td>Xem tong quan nhieu diem tieu/nhieu cong ty trong 1 khoang thoi gian (thang, quy...)</td>
    </tr>
    <tr>
      <td><strong>Voucher da su dung</strong></td>
      <td>Danh sach phang (khong cong don), loc theo ngay tuy chon</td>
      <td>Tra cuu chi tiet tung giao dich, xuat ra file Excel de luu tru/gui bao cao</td>
    </tr>
  </tbody>
</table>
<p class="hint">Cot "Dong bo" trong bang giao dich gan day cho biet 1 giao dich da duoc he thong
trung tam xac nhan (DA DONG BO) hay van dang cho gui lai (CHO DONG BO) - xem lai muc 2 o tren.</p>

<h2>5. Bao mat/tai khoan ca nhan</h2>
<p>Vao muc "Bao mat" tren topbar de: dang ky van tay/Face ID cho thiet bi dang dung, xem/doi
thiet bi xac thuc hai yeu to (neu la quan tri).</p>
`;

const SYSTEM_GUIDE_HTML = `
<h2>1. Quan ly tai khoan (menu Quan tri -&gt; Tai khoan)</h2>
<p>Man hinh nay quan ly toan bo nguoi dung cua he thong:</p>
<ul>
  <li><strong>Tao tai khoan moi</strong>: nhap ten dang nhap, ho ten, mat khau tam, gan
    <strong>diem tieu</strong> (Locations_Detail) - moi tai khoan thuong gan voi 1 diem tieu cu
    dinh, dung de xac dinh pham vi bao cao/doi soat cua tai khoan do.</li>
  <li><strong>6 quyen tinh nang</strong> (bat/tat rieng cho tung tai khoan nhan vien - tai khoan
    quan tri luon co du tat ca, o cot bi khoa):
    <table>
      <thead><tr><th>Quyen</th><th>Mac dinh</th><th>Anh huong</th></tr></thead>
      <tbody>
        <tr><td>Thu hoi voucher</td><td>Bat</td><td>Duoc quet/thu hoi + thay menu "Quet voucher"</td></tr>
        <tr><td>Doi soat</td><td>Bat</td><td>Xem duoc "Bao cao doi soat"</td></tr>
        <tr><td>Tong hop</td><td>Tat</td><td>Xem duoc "Bao cao tong hop"</td></tr>
        <tr><td>Voucher da dung</td><td>Tat</td><td>Xem + xuat Excel danh sach voucher da su dung</td></tr>
        <tr><td>Huong dan nghiep vu</td><td>Bat</td><td>Xem duoc trang huong dan nay (ban danh cho nhan vien)</td></tr>
        <tr><td>Huong dan he thong</td><td>Tat</td><td>Xem duoc trang huong dan nay (ban ban dang doc)</td></tr>
      </tbody>
    </table>
  </li>
  <li><strong>Lich hieu luc tai khoan</strong> (Kich hoat tu / Het han): dat ngay-gio tai khoan
    bat dau/ngung duoc dang nhap - dung cho nhan vien thoi vu, thuc tap, hop dong co thoi han.
    De trong = khong gioi han.</li>
  <li><strong>Xoa/Khoi phuc (xoa mem)</strong>: nut "Xoa" chi AN tai khoan khoi danh sach mac
    dinh va chan dang nhap - KHONG mat du lieu, bam "Khoi phuc" bat ky luc nao de dung lai.</li>
  <li><strong>Nhom quyen xem bao cao</strong>: neu tai khoan can xem bao cao cua NHIEU cong ty
    (khong chi cong ty cua chinh minh), gan vao 1 "Nhom quyen xem bao cao" da tao san (xem muc
    5 ben duoi).</li>
</ul>

<h2>2. Ket noi toi Core Voucher API (menu Quan tri -&gt; Ket noi API)</h2>
<p>Day la noi khai bao he thong nay se goi ra dau de kiem tra/thu hoi voucher that - <strong>bat
buoc phai co it nhat 1 ket noi dang "Kich hoat"</strong> thi man hinh "Quet voucher" moi hoat
dong dung.</p>
<ul>
  <li>Khai bao <strong>Base URL</strong> + kieu xac thuc (Bearer Token / API Key rieng theo
    header / Basic Auth) - secret duoc ma hoa truoc khi luu, khong bao gio hien lai ban ro sau
    khi da luu.</li>
  <li>Khai bao rieng 2 endpoint <strong>Check</strong> (kiem tra, khong doi trang thai) va
    <strong>Redeem</strong> (thu hoi that) - method, vi tri ma voucher (path/query/body), va
    <strong>anh xa cac field</strong> trong phan hoi JSON tra ve sang cac truong chuan cua app
    (status, menh gia, ngay cap...).</li>
  <li><strong>Luon bam "Test kiem tra"</strong> voi 1 ma voucher that ngay tren form (chua can
    Luu) de xac nhan cau hinh dung truoc khi "Luu &amp; Kich hoat" cho toan bo he thong su dung.
    Rieng "Test thu hoi" se <strong>tieu that</strong> voucher - chi dung voi ma khong quan
    trong.</li>
  <li>Chi 1 ket noi duoc kich hoat tai 1 thoi diem - la ket noi toan bo man hinh quet voucher
    dang dung.</li>
</ul>
<p class="hint">Vi du dien form cu the cho 1 kieu Core API xac thuc bang API Key rieng (header
<code>X-API-Key</code>) duoc trinh bay chi tiet trong tai lieu ky thuat repo (README.md muc
4a) - lien he doi phat trien neu can tham khao khi cau hinh voi 1 doi tac moi.</p>

<h2>3. Bao mat quan tri</h2>
<ul>
  <li><strong>Xac thuc hai yeu to (2FA) bat buoc</strong> voi moi tai khoan quan tri: lan dang
    nhap dau tien se yeu cau quet ma QR bang ung dung Authenticator va nhap ma xac minh. Cac lan
    dang nhap sau chi can nhap ma 6 so tu ung dung do.</li>
  <li><strong>Mat thiet bi xac thuc</strong>: mot quan tri KHAC vao menu "Bao mat" -&gt; bang
    "Quan tri vien &amp; trang thai 2FA" -&gt; go 2FA cua nguoi bi mat thiet bi (khong the tu go
    2FA cua chinh minh, tranh 1 phien bi chiem quyen tu vo hieu hoa lop bao ve nay). Nguoi do
    dang nhap lai se duoc yeu cau thiet lap 2FA tu dau.</li>
  <li><strong>Dat lai mat khau ho nhan vien</strong>: man hinh "Tai khoan", nhap mat khau moi
    vao o "Mat khau moi" - tai khoan do se bi bat buoc doi lai mat khau (cua ho tu dat) ngay lan
    dang nhap tiep theo, VA moi phien dang nhap cu cua ho se tu dong mat hieu luc.</li>
</ul>

<h2>4. Cong ty va Diem tieu (menu Quan tri -&gt; Don vi thu hoi)</h2>
<p>1 <strong>Cong ty</strong> co the co nhieu <strong>Diem tieu</strong> (vd 1 chuoi nhieu chi
nhanh). Thong tin lien he/thue/ngan hang khai bao o cap Cong ty, dung chung cho toan bo diem
tieu cua cong ty do. Diem tieu la don vi thuc su gan voi tung tai khoan nhan vien (xem muc 1).</p>

<h2>5. Nhom quyen xem bao cao theo cong ty</h2>
<p>Mac dinh 1 tai khoan chi xem duoc bao cao cua dung cong ty minh phu trach. Neu can 1 tai
khoan xem duoc bao cao CHEO nhieu cong ty (vd ke toan tong hop), tao 1 "Nhom quyen" (menu Quan
tri) chon danh sach cong ty duoc phep xem, roi gan tai khoan do vao nhom (o man hinh Tai khoan,
cot "Nhom quyen xem bao cao").</p>

<h2>6. Nhat ky he thong (menu Quan tri -&gt; Nhat ky he thong)</h2>
<p>2 tab tren cung 1 trang:</p>
<ul>
  <li><strong>Nhat ky quan tri</strong>: ghi lai AI da tao tai khoan/doi quyen/doi lich hieu
    luc/go 2FA nguoi khac..., luc nao.</li>
  <li><strong>Hoat dong quet/thu hoi</strong>: nhat ky TOAN BO lan quet/kiem tra cua nhan vien
    (ca thanh cong lan that bai), loc theo ngay.</li>
</ul>

<h2>7. Tai lieu ky thuat day du</h2>
<p>Ban huong dan nay tap trung vao thao tac tren giao dien admin. Cac chu de sau danh cho doi
ky thuat/IT trien khai he thong (khong thuc hien duoc qua trinh duyet): cai dat server, bien
moi truong (.env), chay migration CSDL, cau hinh nhieu worker, reverse proxy/HTTPS - xem file
<code>README.md</code> trong repo ma nguon cua he thong.</p>
`;

module.exports = { BUSINESS_GUIDE_HTML, SYSTEM_GUIDE_HTML };
