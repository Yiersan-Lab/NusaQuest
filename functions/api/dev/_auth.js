export const SESSION_COOKIE_NAME = 'nq_dev_session';
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return cookies;
}

export function toBase64Url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifyDevPassword(inputPassword, expectedPassword) {
  if (!expectedPassword || !inputPassword) return false;
  const trimmedExpected = String(expectedPassword).trim();
  const trimmedInput = String(inputPassword).trim();
  return timingSafeEqual(trimmedInput, trimmedExpected);
}

export async function createDevSessionToken(secret) {
  const finalSecret = secret || 'default_dev_session_secret_nq_2026';
  const payload = {
    auth: true,
    iat: Date.now(),
    exp: Date.now() + SESSION_DURATION_MS,
    nonce: Math.random().toString(36).substring(2) + Date.now().toString(36)
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(finalSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const signatureBytes = Array.from(new Uint8Array(signatureBuf));
  const signatureRaw = String.fromCharCode(...signatureBytes);
  const signatureB64 = btoa(signatureRaw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  return `${payloadB64}.${signatureB64}`;
}

export async function verifyDevSessionToken(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, signatureB64] = parts;
  
  const finalSecret = secret || 'default_dev_session_secret_nq_2026';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(finalSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  try {
    let base64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }
    
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!isValid) return false;
    
    const payload = JSON.parse(fromBase64Url(payloadB64));
    if (!payload || !payload.auth || !payload.exp) return false;
    if (Date.now() > payload.exp) return false;
    return true;
  } catch (e) {
    return false;
  }
}

export async function isDevAuthenticated(request, env) {
  const secret = env.DEV_SESSION_SECRET || 'default_dev_session_secret_nq_2026';
  
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (await verifyDevSessionToken(token, secret)) return true;
  }
  
  const cookieHeader = request.headers.get('Cookie') || request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (sessionToken && await verifyDevSessionToken(sessionToken, secret)) {
    return true;
  }
  
  return false;
}
