import crypto from 'crypto';
import { prisma } from './prisma';

// Legacy HMAC-based verification removed in favor of opaque tokens.
// Create a new opaque token and store its hash in the database.
export async function createOpaqueTokenForShop(shop: string, ttlSeconds = 300, oneTime = true) {
  if (!shop) throw new Error('missing shop');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await prisma.authToken.create({ data: { tokenHash, shopId: shop, expiresAt, oneTime } });
  return token;
}

// Verify an opaque token and return the associated shopId, or null if invalid.
export async function verifyOpaqueToken(token: string | undefined) {
  if (!token) return null;
  // Guard: if Prisma client was not regenerated after adding the AuthToken model
  // then `prisma.authToken` may be undefined which throws a TypeError.
  // Return null and log an actionable message so the server doesn't crash.
  if (!(prisma as any).authToken) {
    console.error('Prisma client missing `AuthToken` model. Run `npx prisma generate` and apply DB changes (`npx prisma db push` or migrations`).');
    return null;
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const rec = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!rec) return null;
  if (rec.used) return null;
  if (rec.expiresAt.getTime() < Date.now()) return null;
  // mark used if oneTime
  if (rec.oneTime) {
    try { await prisma.authToken.update({ where: { tokenHash }, data: { used: true } }); } catch (e) { }
  }
  return rec.shopId;
}

// Verify session cookie value from request headers. Cookie format: base64(payload) + '.' + hexsig
// payload = JSON.stringify({ shop, exp }) where exp is unix timestamp
export async function verifySessionCookie(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('trusthive_sso='));
  if (!match) return null;
  const raw = decodeURIComponent(match.split('=')[1]);
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const payloadB64 = parts[0];
  const sig = parts[1];
  let payloadStr = '';
  try { payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8'); } catch (e) { return null; }
  let payload: any = null;
  try { payload = JSON.parse(payloadStr); } catch (e) { return null; }
  if (!payload || !payload.shop || !payload.exp) return null;
  const shopEntry = await prisma.shop.findUnique({ where: { shopId: payload.shop } });
  if (!shopEntry || !shopEntry.apiKey) return null;
  const expected = crypto.createHmac('sha256', shopEntry.apiKey).update(payloadB64).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))) return null;
  } catch (e) {
    if (expected !== sig) return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (now > Number(payload.exp)) return null;
  return payload.shop;
}
