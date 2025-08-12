import { prisma } from '../../lib/prisma';
import { verifyOpaqueToken, verifySessionCookie } from '../../lib/auth';
import DashboardClientWrapper from './DashboardClientWrapper';
import { headers } from 'next/headers';

export default async function Page({ searchParams }: { searchParams?: Record<string,string> }) {
  const sp = await (searchParams as any);
  const token = sp?.token;

  // Try token first (opaque token) if present in URL
  let shopId: string | null = null;
  if (token) {
    shopId = await verifyOpaqueToken(token);
  }

  // If no token or invalid, try existing session cookie
  if (!shopId) {
    const headersList = await headers();
    const cookieHeader = headersList.get('cookie') || '';
    const fakeReq = { headers: { get: (_: string) => cookieHeader } } as unknown as Request;
    shopId = await verifySessionCookie(fakeReq);
  }

  if (!shopId) {
    return (
      <div>
        <h1>Unauthorized</h1>
        <p>Invalid or expired token. Access denied.</p>
      </div>
    );
  }

  const reviews = await prisma.review.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' } });

  // serialize dates to string for client component
  const serial = reviews.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }));

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Showing reviews for your shop.</p>
      <DashboardClientWrapper initial={serial} token={token} shop={shopId} />
    </div>
  );
}
