import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { verifyOpaqueToken, verifySessionCookie } from '../../../../../lib/auth';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const url = new URL(req.url);
  const shop = url.searchParams.get('shop') || undefined;
  const ts = url.searchParams.get('ts') || undefined;
  const token = url.searchParams.get('token') || undefined;
  let action = '';

  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    action = (body && body.action) || url.searchParams.get('action') || '';
  } else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    // handle HTML form submissions
    const fd = await req.formData().catch(() => null);
    if (fd) {
      const a = fd.get('action');
      action = a ? String(a) : url.searchParams.get('action') || '';
    } else {
      action = url.searchParams.get('action') || '';
    }
  } else {
    // fallback: try to parse JSON, otherwise use querystring
    const body = await req.text().catch(() => '');
    try {
      const parsed = body ? JSON.parse(body) : {};
      action = (parsed && parsed.action) || url.searchParams.get('action') || '';
    } catch (e) {
      action = url.searchParams.get('action') || '';
    }
  }

  // Accept either opaque token verification OR a valid session cookie
  let shopId: string | null = null;
  if (token) {
    shopId = await verifyOpaqueToken(token);
  }
  if (!shopId) {
    const sessionShop = await verifySessionCookie(req as unknown as Request);
    if (!sessionShop) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    shopId = sessionShop;
  }
  // if shop query param was provided, ensure it matches the authenticated shop
  if (shop && shop !== shopId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  if (action === 'approve') {
    await prisma.review.update({ where: { id }, data: { approved: true } });
    return NextResponse.json({ ok: true });
  } else if (action === 'delete') {
    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } else if (action === 'hide') {
    await prisma.review.update({ where: { id }, data: { approved: false } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 });
}
