// Cau hinh PM2 cho HCRC Voucher Redemption App - xem README muc 3e de biet day du quy trinh
// cai dat (user he dieu hanh `hcrcapp`, bien moi truong trong `.env`, migration DB...).
//
// Dung file nay (`pm2 start ecosystem.config.js`) thay vi go tay `pm2 start src/server.js
// --name ... --cwd ...` moi lan - tranh dung sai `--cwd` (khien cot "Version" trong `pm2 list`
// hien "N/A" vinh vien, xem ghi chu README muc 3e) va dam bao MOI lan khoi dong (ke ca sau khi
// may chu reboot, qua `pm2 resurrect` duoc `pm2 startup` dang ky) deu dung chinh xac cung 1 cau
// hinh, khong phu thuoc nguoi go lenh co nho dung tham so hay khong.
module.exports = {
  apps: [
    {
      name: 'hcrc-voucher',
      script: 'src/server.js',
      // __dirname luon la thu muc chua chinh file nay (goc du an) - dung bat ke app duoc clone/
      // giai nen o duong dan nao tren server, khong can sua tay moi lan deploy o may moi.
      cwd: __dirname,

      // QUAN TRONG: KHONG dung che do cluster cua PM2 (instances > 1 hoac exec_mode: 'cluster')
      // - app nay da tu quan ly nhieu worker BEN TRONG src/server.js qua bien CLUSTER_WORKERS
      // trong .env (de dung chung duoc voi ca systemd, khong rieng PM2). Bat ca 2 cung luc se
      // nhan so tien trinh len (vd CLUSTER_WORKERS=4 + PM2 instances=4 = 16 tien trinh thuc te) -
      // xem canh bao day du o README muc 3e. Luon giu dung 1 tien trinh PM2 (fork mode).
      instances: 1,
      exec_mode: 'fork',

      // Tu dong khoi dong lai khi app crash/thoat bat ngo (vd loi chua bat duoc, mat ket noi DB
      // luc khoi dong...) - day la ly do chinh dung PM2 thay vi chay `node src/server.js` thang.
      autorestart: true,
      // KHONG theo doi thay doi file de tu restart - app nay khong can hot-reload o production,
      // va bat watch co the vo tinh restart lien tuc neu co tien trinh khac ghi file trong thu
      // muc du an (vd log, upload). Luon de false o production.
      watch: false,

      // Tu restart neu tien trinh ro ri bo nho vuot nguong nay - dieu chinh theo RAM thuc te cua
      // server (vd server 2GB RAM, nhieu app dung chung thi co the can dat thap hon). Bo dong nay
      // (hoac xoa) neu khong muon gioi han.
      max_memory_restart: '500M',

      // Chan vong lap restart-crash-restart lien tuc (vd sai cau hinh DB khien app crash ngay
      // luc khoi dong) - PM2 se NGUNG tu dong restart sau 10 lan trong vong chua day 10 giay
      // moi lan, chuyen trang thai sang "errored" thay vi thu mai vo ich, de admin de phat hien
      // qua `pm2 list` thay vi app am tham restart-loop ma khong ai biet.
      min_uptime: '10s',
      max_restarts: 10,

      // Thoi gian cho toi da truoc khi PM2 ep SIGKILL luc restart/stop (mac dinh PM2 chi 1.6s,
      // hoi gap cho 1 app Node dang co ket noi DB/request dang xu ly do) - 5s de co co hoi thoat
      // binh thuong hon, khong anh huong gi neu app thoat nhanh hon.
      kill_timeout: 5000,

      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
