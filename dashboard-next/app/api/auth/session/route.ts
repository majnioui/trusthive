import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import crypto from 'crypto';
import { verifyOpaqueToken } from '../../../../lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = body.token || undefined;
  if (!token) return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });

  // Verify opaque token and map to shop
  const shop = await verifyOpaqueToken(token);
  if (!shop) return NextResponse.json({ ok: false, error: 'invalid or expired' }, { status: 401 });

  const shopEntry = await prisma.shop.findUnique({ where: { shopId: shop } });
  if (!shopEntry || !shopEntry.apiKey) return NextResponse.json({ ok: false, error: 'unknown shop' }, { status: 404 });

  // create session payload
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 90; // 90 minutes
  const payload = { shop, exp };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64');
  const sig = crypto.createHmac('sha256', shopEntry.apiKey).update(payloadB64).digest('hex');
  const cookieVal = encodeURIComponent(`${payloadB64}.${sig}`);

  const res = NextResponse.json({ ok: true });
  // set cookie
  res.headers.set('Set-Cookie', `trusthive_sso=${cookieVal}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60*90}; Secure`);
  return res;
}
