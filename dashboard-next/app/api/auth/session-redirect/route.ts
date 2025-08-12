import { NextResponse } from 'next/server';
import { verifyOpaqueToken } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import crypto from 'crypto';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || undefined;
  if (!token) return NextResponse.redirect(new URL('/dashboard', url.origin));

  const shop = await verifyOpaqueToken(token);
  if (!shop) return NextResponse.redirect(new URL('/dashboard?error=unauthorized', url.origin));

  const shopEntry = await prisma.shop.findUnique({ where: { shopId: shop } });
  if (!shopEntry || !shopEntry.apiKey) return NextResponse.redirect(new URL('/dashboard?error=unknown', url.origin));

  // create session payload (90 minutes)
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 90;
  const payload = { shop, exp };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64');
  const sig = crypto.createHmac('sha256', shopEntry.apiKey).update(payloadB64).digest('hex');
  const cookieVal = encodeURIComponent(`${payloadB64}.${sig}`);

  const res = NextResponse.redirect(new URL('/dashboard', url.origin));
  res.headers.set('Set-Cookie', `trusthive_sso=${cookieVal}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60*90}; Secure`);
  return res;
}
