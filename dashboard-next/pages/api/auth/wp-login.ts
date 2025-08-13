import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token, site } = req.query as { token?: string; site?: string };

  if (!token || !site) {
    return res.redirect('/login?error=missing-params');
  }

  let siteUrl: URL;
  try {
    siteUrl = new URL(site);
    if (siteUrl.protocol !== 'https:') {
      return res.redirect('/login?error=insecure-site');
    }
  } catch (e) {
    return res.redirect('/login?error=invalid-site');
  }

  try {
    const verifyRes = await fetch(siteUrl.origin.replace(/\/$/, '') + '/wp-json/trusthive-reviews/v1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!verifyRes.ok) {
      return res.redirect('/login?error=invalid-token');
    }

    const data = await verifyRes.json();
    if (!data || !data.success) {
      return res.redirect('/login?error=verification-failed');
    }

    const sessionToken = jwt.sign(
      {
        site: siteUrl.origin,
        userId: data.user_id,
        email: data.email,
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    res.setHeader('Set-Cookie', serialize('auth-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    }));

    res.redirect('/dashboard');
  } catch (err) {
    console.error('WP verification error', err);
    res.redirect('/login?error=verification-error');
  }
}
