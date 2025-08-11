import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import crypto from 'crypto';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const site_url = body.site_url;
  if (!site_url) return NextResponse.json({ ok: false, error: 'missing site_url' }, { status: 400 });

  const shopId = 'shop-' + crypto.randomBytes(6).toString('hex');
  const apiKey = crypto.randomBytes(32).toString('hex');

  const created = await prisma.shop.create({
    data: { shopId, siteUrl: site_url, apiKey }
  });

  return NextResponse.json({ ok: true, shop_id: shopId, api_key: apiKey });
}

