import { GetServerSideProps } from 'next';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';

export default function Page() {
  // This page never renders because all logic happens server-side in getServerSideProps
  return null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { req, res, query } = ctx;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;
  const site = Array.isArray(query.site) ? query.site[0] : query.site;

  if (!token || !site) {
    return { redirect: { destination: '/login?error=missing-params', permanent: false } };
  }

  // Validate site URL and require https
  let siteUrl: URL;
  try {
    siteUrl = new URL(site as string);
    if (siteUrl.protocol !== 'https:') {
      return { redirect: { destination: '/login?error=insecure-site', permanent: false } };
    }
  } catch (e) {
    return { redirect: { destination: '/login?error=invalid-site', permanent: false } };
  }

  try {
    const verifyRes = await fetch(siteUrl.origin.replace(/\/$/, '') + '/wp-json/trusthive-reviews/v1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!verifyRes.ok) {
      return { redirect: { destination: '/login?error=invalid-token', permanent: false } };
    }

    const data = await verifyRes.json();
    if (!data || !data.success) {
      return { redirect: { destination: '/login?error=verification-failed', permanent: false } };
    }

    // Ensure there's a Shop record for this site (auto-provision)
    let shop = await prisma.shop.findFirst({ where: { siteUrl: siteUrl.origin } });
    if (!shop) {
      const shopId = 'shop-' + crypto.randomBytes(6).toString('hex');
      const apiKey = crypto.randomBytes(32).toString('hex');
      shop = await prisma.shop.create({ data: { shopId, siteUrl: siteUrl.origin, apiKey } });

      // Send credentials back to the WordPress site so the plugin can store them
      try {
        await fetch(siteUrl.origin.replace(/\/$/, '') + '/wp-json/trusthive-reviews/v1/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, shop_id: shop.shopId, api_key: shop.apiKey }),
        });
      } catch (e) {
        console.error('Failed to provision credentials back to WP site', e);
      }
    }

    const sessionToken = jwt.sign(
      {
        site: siteUrl.origin,
        shopId: shop.shopId,
        userId: data.user_id,
        email: data.email,
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    const cookie = serialize('auth-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);
    return { redirect: { destination: '/dashboard', permanent: false } };
  } catch (err) {
    console.error('WP verification error', err);
    return { redirect: { destination: '/login?error=verification-error', permanent: false } };
  }
};
