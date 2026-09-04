function webauthnSupported() {
  return !!(window.SimpleWebAuthnBrowser && window.SimpleWebAuthnBrowser.browserSupportsWebAuthn && window.SimpleWebAuthnBrowser.browserSupportsWebAuthn());
}

/** Dang ky van tay/Face ID cho THIET BI HIEN TAI, gan voi tai khoan dang dang nhap. */
async function registerPasskey(deviceLabel) {
  if (!webauthnSupported()) {
    throw new Error('Trinh duyet nay khong ho tro dang nhap bang van tay/Face ID.');
  }
  const { options, flowId } = await apiFetch('/auth/webauthn/register-options', { method: 'POST' });
  const response = await window.SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options });
  await apiFetch('/auth/webauthn/register-verify', {
    method: 'POST',
    body: JSON.stringify({ flowId, response, deviceLabel: deviceLabel || null }),
  });
}

/**
 * Dang nhap bang van tay/Face ID. Khong can biet truoc ten dang nhap - neu thiet bi co
 * nhieu passkey (dung chung tai quay), trinh duyet/he dieu hanh tu hien bang chon tai khoan.
 * Tra ve { token, user } giong het ket qua dang nhap mat khau.
 */
async function loginWithPasskey() {
  if (!webauthnSupported()) {
    throw new Error('Trinh duyet nay khong ho tro dang nhap bang van tay/Face ID.');
  }
  const { options, flowId } = await apiFetch('/auth/webauthn/login-options', { method: 'POST' });
  const response = await window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options });
  return apiFetch('/auth/webauthn/login-verify', {
    method: 'POST',
    body: JSON.stringify({ flowId, response }),
  });
}

async function listPasskeys() {
  return apiFetch('/auth/webauthn/devices');
}

async function removePasskey(id) {
  return apiFetch(`/auth/webauthn/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
