import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import crypto from 'crypto';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const shop = body.shop || undefined;
  const ts = body.ts || undefined;
  const token = body.token || undefined;
  if (!shop || !ts || !token) return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });

  const shopEntry = await prisma.shop.findUnique({ where: { shopId: shop } });
  if (!shopEntry || !shopEntry.apiKey) return NextResponse.json({ ok: false, error: 'unknown shop' }, { status: 404 });

  // verify token
  const now = Math.floor(Date.now() / 1000);
  const tnum = parseInt(ts, 10);
  if (Number.isNaN(tnum) || Math.abs(now - tnum) > 300) return NextResponse.json({ ok: false, error: 'stale' }, { status: 401 });
  const expected = crypto.createHmac('sha256', shopEntry.apiKey).update(`${shop}|${ts}`).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'))) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 401 });
  } catch (e) {
    if (expected !== token) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 401 });
  }

  // create session payload
  const exp = now + 60 * 10; // 10 minutes
  const payload = { shop, exp };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64');
  const sig = crypto.createHmac('sha256', shopEntry.apiKey).update(payloadB64).digest('hex');
  const cookieVal = encodeURIComponent(`${payloadB64}.${sig}`);

  const res = NextResponse.json({ ok: true });
  // set cookie
  res.headers.set('Set-Cookie', `trusthive_sso=${cookieVal}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60*10}; Secure`);
  return res;
}

