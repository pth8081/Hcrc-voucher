/**
 * Thay {placeholder} trong 1 chuoi (dung cho URL path/query, KHONG dung cho JSON body
 * vi khong an toan voi ky tu dac biet - xem renderJsonValue ben duoi).
 * Gia tri duoc URL-encode.
 */
function renderPathTemplate(pathTemplate, vars = {}) {
  return String(pathTemplate).replace(/\{(\w+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key) || vars[key] === undefined || vars[key] === null) {
      return match;
    }
    return encodeURIComponent(String(vars[key]));
  });
}

/**
 * Render 1 JSON template (object/array/string/so...) bang cach thay the {placeholder}:
 * - Neu 1 chuoi la CHINH XAC "{key}" -> thay bang gia tri that (giu nguyen kieu du lieu,
 *   vd so, boolean), tranh loi JSON khi gia tri chua ky tu dac biet.
 * - Neu {key} nam trong 1 chuoi dai hon -> thay the dang chuoi (string interpolation).
 * Dung de render RedeemBodyTemplate/CheckBodyTemplate (da duoc JSON.parse tu truoc).
 */
function renderJsonValue(value, vars = {}) {
  if (typeof value === 'string') {
    const exact = value.match(/^\{(\w+)\}$/);
    if (exact && Object.prototype.hasOwnProperty.call(vars, exact[1])) {
      return vars[exact[1]];
    }
    return value.replace(/\{(\w+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(vars, key) && vars[key] !== undefined && vars[key] !== null
        ? String(vars[key])
        : match
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderJsonValue(item, vars));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = renderJsonValue(value[key], vars);
    }
    return result;
  }
  return value;
}

module.exports = { renderPathTemplate, renderJsonValue };
