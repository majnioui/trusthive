import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { verifyOpaqueToken } from '../../../../lib/auth';
import crypto from 'crypto';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const redirectTo = url.searchParams.get('redirect') || '/dashboard';

  if (!token) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // Verify the token - mark as used when establishing session
  const shopId = await verifyOpaqueToken(token, true);
  if (!shopId) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // Get shop details
  const shopEntry = await prisma.shop.findUnique({ where: { shopId } });
  if (!shopEntry || !shopEntry.apiKey) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // Create session payload
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 90; // 90 minutes
  const payload = { shop: shopId, exp };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64');
  const sig = crypto.createHmac('sha256', shopEntry.apiKey).update(payloadB64).digest('hex');
  const cookieVal = encodeURIComponent(`${payloadB64}.${sig}`);

  // Create response with redirect
  const response = NextResponse.redirect(new URL(redirectTo, req.url));

  // Set the session cookie
  response.cookies.set('trusthive_sso', cookieVal, {
    httpOnly: true,
    secure: false, // false for development
    sameSite: 'lax',
    maxAge: 60 * 90,
    path: '/'
  });

  return response;
}
