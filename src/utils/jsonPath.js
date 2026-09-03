/**
 * Doc gia tri trong 1 object theo duong dan dang chuoi, ho tro ca mang:
 *   getByPath(obj, "data.status")        -> obj.data.status
 *   getByPath(obj, "items[0].code")      -> obj.items[0].code
 * Tra ve undefined neu duong dan khong ton tai, khong nem loi.
 */
function getByPath(obj, path) {
  if (!path || typeof path !== 'string') return undefined;
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((p) => p.length > 0);

  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

module.exports = { getByPath };
