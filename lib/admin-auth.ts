export type AdminConfig = {
  username: string;
  passwordHash: string;
  sessionSecret: string;
};
export const SESSION_COOKIE = 'fengbin_admin_session';
export const SESSION_TTL = 8 * 60 * 60;
const encoder = new TextEncoder();
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding');
  return Uint8Array.from(
    atob(value.replaceAll('-', '+').replaceAll('_', '/')),
    (c) => c.charCodeAt(0),
  );
}
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
function hashParts(value: string) {
  const [algorithm, iterations, salt, hash, extra] = value.split('$');
  if (
    algorithm !== 'pbkdf2-sha256' ||
    iterations !== '100000' ||
    extra !== undefined
  )
    throw new Error('Invalid credential configuration');
  const saltBytes = decode(salt);
  const hashBytes = decode(hash);
  if (saltBytes.length !== 16 || hashBytes.length !== 32)
    throw new Error('Invalid credential configuration');
  return { saltBytes, hashBytes };
}
export function validConfig(config: AdminConfig): boolean {
  try {
    hashParts(config.passwordHash);
    return config.username.length > 0 && config.sessionSecret.length >= 43;
  } catch {
    return false;
  }
}
export async function verifyPassword(
  username: string,
  password: string,
  config: AdminConfig,
): Promise<boolean> {
  if (!validConfig(config) || password.length > 256 || username.length > 80)
    return false;
  const passwordMatches = await verifyPasswordHash(password, config.passwordHash);
  const usernameMatches = sameBytes(encoder.encode(username), encoder.encode(config.username));
  return passwordMatches && usernameMatches;
}
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256,
  );
  return `pbkdf2-sha256$100000$${encode(salt)}$${encode(new Uint8Array(hash))}`;
}
export async function verifyPasswordHash(password: string, passwordHash: string): Promise<boolean> {
  if (password.length > 256) return false;
  let parts: ReturnType<typeof hashParts>;
  try { parts = hashParts(passwordHash); } catch { return false; }
  const { saltBytes, hashBytes } = parts;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const result = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 100000 },
    key,
    256,
  );
  return sameBytes(new Uint8Array(result), hashBytes);
}
async function signingKey(config: AdminConfig) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(config.sessionSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
async function credentialVersion(config: AdminConfig) {
  return encode(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(config.username + '\n' + config.passwordHash),
      ),
    ),
  );
}
export async function createSession(
  config: AdminConfig,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  if (!validConfig(config)) throw new Error('Authentication unavailable');
  const payload = encode(
    encoder.encode(
      JSON.stringify({
        sub: config.username,
        exp: now + SESSION_TTL,
        iat: now,
        version: await credentialVersion(config),
        nonce: encode(crypto.getRandomValues(new Uint8Array(16))),
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(config),
    encoder.encode(payload),
  );
  return payload + '.' + encode(new Uint8Array(signature));
}
export async function verifySession(
  token: string | undefined,
  config: AdminConfig,
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!token || token.length > 2048 || !validConfig(config)) return false;
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) return false;
    if (
      !(await crypto.subtle.verify(
        'HMAC',
        await signingKey(config),
        decode(signature),
        encoder.encode(payload),
      ))
    )
      return false;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    return (
      data.sub === config.username &&
      data.version === (await credentialVersion(config)) &&
      Number.isInteger(data.exp) &&
      Number.isInteger(data.iat) &&
      data.iat <= now &&
      data.exp > now &&
      data.exp - data.iat === SESSION_TTL
    );
  } catch {
    return false;
  }
}
export type UserSessionClaims = { sub: string; version: number; iat: number; exp: number };
export async function createUserSession(
  user: { id: string; sessionVersion: number },
  config: AdminConfig,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  if (!validConfig(config)) throw new Error('Authentication unavailable');
  const payload = encode(encoder.encode(JSON.stringify({
    sub: user.id, version: user.sessionVersion, iat: now, exp: now + SESSION_TTL,
    nonce: encode(crypto.getRandomValues(new Uint8Array(16))),
  })));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(config), encoder.encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
export async function readUserSession(
  token: string | undefined,
  config: AdminConfig,
  now = Math.floor(Date.now() / 1000),
): Promise<UserSessionClaims | null> {
  if (!token || token.length > 2048 || !validConfig(config)) return null;
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined || !(await crypto.subtle.verify(
      'HMAC', await signingKey(config), decode(signature), encoder.encode(payload),
    ))) return null;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (typeof data.sub !== 'string' || !Number.isSafeInteger(data.version) || data.version < 1 ||
        !Number.isInteger(data.exp) || !Number.isInteger(data.iat) || data.iat > now ||
        data.exp <= now || data.exp - data.iat !== SESSION_TTL) return null;
    return data;
  } catch { return null; }
}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  try {
    return (
      Boolean(origin) && new URL(origin!).origin === new URL(request.url).origin
    );
  } catch {
    return false;
  }
}
export function sessionCookie(
  token: string,
  secure: boolean,
  clear = false,
): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_TTL}${secure ? '; Secure' : ''}`;
}
