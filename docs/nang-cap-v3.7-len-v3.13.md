# Huong dan nang cap: v3.7 -> v3.13

Tai lieu nay danh cho ban dang chay **v3.7** tren server that va muon cap nhat len **v3.13**
(6 lan release ke tu do: v3.8 - v3.13). Tat ca thay doi trong khoang nay la **cong them**, khong
sua/xoa du lieu cu, khong doi cau truc bang chia se voi he thong Core (`Users`,
`Locations_Group`, `Locations_Detail`, `VOUCHER_SYNC`, `Voucher_Exelogs`) - an toan nang cap
truc tiep tren production, khong can DB rieng de test truoc (dau vay van nen **backup DB** truoc
khi lam, theo thong le chung cho moi lan nang cap).

**Khong can `npm install` phu them** (khong co goi thu vien moi) va **khong can sua `.env`**
(khong co bien moi truong moi) - chi can cap nhat code + chay migration.

---

## 1. Cac buoc nang cap (tom tat)

Chay tren server that, theo dung thu tu:

```bash
# 0. (khuyen nghi) Backup DB truoc khi lam gi ca
#    Cach backup tuy he thong DB dang dung (SQL Server Management Studio, sqlcmd BACKUP DATABASE...)

# 1. Vao thu muc app, lay code moi nhat
cd /duong-dan/toi/hcrc-voucher
git fetch origin
git checkout main
git pull origin main

# 2. Cai lai dependency (an toan du lan nay khong co goi moi - luon nen chay sau khi pull code)
npm install --omit=dev

# 3. Chay migration - AN TOAN chay lai nhieu lan, chi ap dung phan con thieu
npm run migrate

# 4. Khoi dong lai app
pm2 restart hcrc-voucher
#    (hoac neu dung systemd: sudo systemctl restart hcrc-voucher)
```

## 2. Kiem tra sau khi nang cap

- [ ] `npm run migrate` chay xong khong loi, thay dong `Migration complete.` cuoi cung.
- [ ] Goi `GET /health` (vd `curl https://<domain-cua-ban>/health`) - phai thay
      `"version":"3.13"`. Day la cach xac nhan chac chan ban dang chay dung ban da nang cap,
      khong phu thuoc pm2/systemd co hien thi dung hay khong.
- [ ] Dang nhap thu vao web - man hinh Quet voucher hoat dong binh thuong.
- [ ] Vao menu tren cung - thay 2 muc moi **"Huong dan nghiep vu"** va **"Huong dan he thong"**
      (xem muc 3 ben duoi).
- [ ] Neu co dung man hinh "Ket noi API" (Quan tri -> Ket noi API): cac ket noi da luu tu truoc
      **khong bi anh huong gi** (chi anh huong form "Tao ket noi moi", xem muc 3).

## 3. Nhung gi thuc su thay doi (tom tat theo tung ban, khong sa vao chi tiet ky thuat)

### v3.8 - Tai lieu API noi bo
Chi them 1 file tai lieu tham khao (`docs/api-voucher-check-redeem.md`), khong doi code chay.
Khong anh huong gi den van hanh.

### v3.9 va v3.10 - **1 tinh nang da xay roi go bo ngay** (luu y de khong nham lan)
v3.9 tung xay 1 tinh nang cho phep app nay **cap API key cho ben ngoai goi vao** - sau khi ra
soat lai, phat hien day la **hieu sai chieu** tai lieu tich hop cua doi tac (chieu dung la
NGUOC LAI: doi tac cap key, app nay dung key do de goi RA he thong cua ho - xem muc "Ket noi
API" ben duoi). v3.10 **go bo hoan toan** tinh nang sai chieu do (khong con man hinh "API doi
tac", khong con bang `PartnerApiKeys` trong DB) va thay bang huong dan cau hinh dung.

**Ban khong can lam gi them cho phan nay** - migration da tu don dep, khong con dau vet nao cua
tinh nang cu du DB cua ban da tung chay qua ban v3.9 hay chua.

### v3.11 - Module "Huong dan" ngay trong app
Them 2 trang huong dan xem duoc thang tren web (khong can mo file README trong repo):
- **"Huong dan nghiep vu"**: cach quet/thu hoi voucher, y nghia cac trang thai, 3 loai bao cao.
  Danh cho nhan vien - **tat ca tai khoan deu tu dong thay duoc** (quyen mac dinh la BAT).
- **"Huong dan he thong"**: cau hinh ket noi Core API, quan ly tai khoan/phan quyen, bao mat.
  Danh cho quan tri - **mac dinh CHI quan tri vien moi thay**, nhan vien can duoc cap rieng.

**Viec ban co the can lam**: neu muon 1 nhan vien cu the cung xem duoc ban "Huong dan he thong"
(vd nguoi ban dinh dao tao lam quan tri phu), vao **Quan tri -> Tai khoan**, tim dong tai khoan
do, tick chon o cot **"HD he thong"**. Khong lam gi thi moi thu van hoat dong binh thuong nhu
truoc (chi don gian la co them 2 trang moi it nguoi biet toi cho den khi ban gioi thieu).

### v3.12 - Man hinh "Ket noi API" tu dien san
Truoc day, moi lan bam "+ Tao ket noi moi" tren man hinh **Quan tri -> Ket noi API**, phai tu
tay dien tung o (method, path, bang anh xa field...). Gio cac o nay **da duoc dien san** dung
theo tai lieu ky thuat cua doi tac cung cap Core Voucher API - ban chi con dien 3 o: **Ten ket
noi**, **Base URL**, va **Gia tri API Key**.

**Chi anh huong luc tao ket noi MOI** - neu ban da co san 1 ket noi dang hoat dong tu truoc,
ket noi do **khong bi thay doi gi**, van chay binh thuong. Chi khi ban bam "+ Tao ket noi moi"
lan sau (vd doi doi tac, hoac them 1 ket noi du phong) moi thay su khac biet.

### v3.13 - Chinh tai lieu huong dan nang cap nay
Chi them file tai lieu nay (`docs/nang-cap-v3.7-len-v3.13.md`), khong doi code chay. Khong anh
huong gi den van hanh.

## 4. Neu co su co, muon quay lai ban cu

Migration cua repo nay chi **them** (them bang/them cot), khong co script "lui lai" tu dong.
Repo hien **chua gan tag rieng cho tung ban** (vd `v3.7`, `v3.12`) nen khong dung duoc
`git checkout v3.7` truc tiep - quay ve bang commit hash cu the:

```bash
git log --oneline --all | grep "v3.7"   # tim dong commit co ghi "(v3.7)" trong message de lay hash
git checkout <hash-tim-duoc>
pm2 restart hcrc-voucher
```

*(Khuyen nghi cho lan sau: gan tag Git cho moi ban da trien khai production, vd
`git tag v3.12 && git push origin v3.12`, de lan sau chi can `git checkout v3.7` truc tiep ma
khong phai tim hash thu cong.)*

Cac cot/bang duoc them vao (vd `CanViewBusinessGuide`/`CanViewSystemGuide` trong
`VoucherAppPermissions`) se **khong gay loi** cho code v3.7 cu hon (code cu don gian khong doc
toi cac cot do) - khong bat buoc phai xoa lai cac cot nay khi lui ve.
