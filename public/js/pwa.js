if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Khong co PWA/offline shell cung khong sao - app van hoat dong binh thuong qua mang.
    });
  });
}
