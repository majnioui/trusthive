import { prisma } from '../../lib/prisma';
import { verifyOpaqueToken, verifySessionCookie } from '../../lib/auth';
import DashboardClientWrapper from './DashboardClientWrapper';
import { headers } from 'next/headers';

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
  // Check for token in URL first - await searchParams for Next.js 15
  const params = await searchParams;
  const token = params?.token;
  let shopId: string | null = null;
  let authMethod = 'none';

  if (token) {
    shopId = await verifyOpaqueToken(token, false); // Don't mark as used during verification
    if (shopId) {
      authMethod = 'token';
    }
  }

  // If no valid token, check for session cookie
  if (!shopId) {
    const headersList = await headers();
    const cookieHeader = headersList.get('cookie') || '';
    const fakeReq = { headers: { get: (_: string) => cookieHeader } } as unknown as Request;
    shopId = await verifySessionCookie(fakeReq);
    if (shopId) {
      authMethod = 'session';
    }
  }

  if (shopId) {
    const reviews = await prisma.review.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' } });
    // serialize dates to string for client component
    const serial = reviews.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }));
    return <DashboardClientWrapper initial={serial} shop={shopId} />;
  }
}
