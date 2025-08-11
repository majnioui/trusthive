import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));
  const { shop_id, product_id, author, rating, title, content, source, site_url } = payload;
  if (!shop_id || !product_id || !author || !author.name || !author.email || !rating || !content) {
    return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 });
  }

  const shop = await prisma.shop.findUnique({ where: { shopId: shop_id } });
  if (!shop) return NextResponse.json({ ok: false, error: 'unknown shop' }, { status: 404 });

  const rec = await prisma.review.create({
    data: {
      shopId: shop_id,
      productId: Number(product_id),
      authorName: author.name,
      authorEmail: author.email,
      rating: Number(rating),
      title: title || null,
      content,
      source: source || null,
      siteUrl: site_url || null,
    }
  });

  return NextResponse.json({ ok: true, id: rec.id }, { status: 201 });
}

