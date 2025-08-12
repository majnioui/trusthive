import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { createOpaqueTokenForShop } from '../../../../lib/auth';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return NextResponse.json({ ok: false, error: 'missing auth' }, { status: 401 });
  const apiKey = m[1];

  const body = await req.json().catch(() => ({}));
  const shop = body.shop || undefined;
  if (!shop) return NextResponse.json({ ok: false, error: 'missing shop' }, { status: 400 });

  const shopEntry = await prisma.shop.findUnique({ where: { shopId: shop } });
  if (!shopEntry || shopEntry.apiKey !== apiKey) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // create a short-lived one-time token
  try {
    const token = await createOpaqueTokenForShop(shop, 300, true);
    return NextResponse.json({ ok: true, token });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
