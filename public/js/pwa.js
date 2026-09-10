if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Khong co PWA/offline shell cung khong sao - app van hoat dong binh thuong qua mang.
    });
  });

  // Khi co ban Service Worker MOI duoc kich hoat (sau khi deploy ban moi) va vua nam quyen
  // kiem soat trang dang mo san, bao cho nguoi dung roi tu tai lai 1 lan - tranh phai tu
  // dong/mo lai app 2 lan moi thay duoc tinh nang moi (loi cache cu da gap). Bo qua LAN DAU
  // controllerchange (khi SW moi cai dat lan dau nhan quyen kiem soat trang) vi luc do trang
  // dang mo van la ban moi nhat roi, khong can tai lai.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    if (!sessionStorage.getItem('swControlled')) {
      sessionStorage.setItem('swControlled', '1');
      return;
    }
    reloading = true;
    if (typeof showToast === 'function') {
      showToast('Da co ban cap nhat moi - dang tai lai...');
    }
    setTimeout(() => window.location.reload(), 1200);
  });
}
