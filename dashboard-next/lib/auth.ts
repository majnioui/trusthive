import crypto from 'crypto';
import { prisma } from './prisma';

export async function verifyTokenForShop(shop: string | undefined, ts: string | undefined, token: string | undefined, maxAge = 300) {
  if (!shop || !ts || !token) return false;
  const shopEntry = await prisma.shop.findUnique({ where: { shopId: shop } });
  if (!shopEntry || !shopEntry.apiKey) return false;
  const secret = shopEntry.apiKey;
  const now = Math.floor(Date.now() / 1000);
  const tnum = parseInt(ts, 10);
  if (Number.isNaN(tnum) || Math.abs(now - tnum) > maxAge) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${shop}|${ts}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch (e) {
    return expected === token;
  }
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
