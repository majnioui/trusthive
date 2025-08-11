import { prisma } from '../../lib/prisma';
import { verifyTokenForShop } from '../../lib/auth';
import DashboardClientWrapper from './DashboardClientWrapper';

export default async function Page({ searchParams }: { searchParams?: Record<string,string> }) {
  const shop = searchParams?.shop;
  const ts = searchParams?.ts;
  const token = searchParams?.token;

  const ok = await verifyTokenForShop(shop, ts, token);
  if (!ok) {
    return (
      <div>
        <h1>Unauthorized</h1>
        <p>Invalid or expired token. Access denied.</p>
      </div>
    );
  }

  const reviews = await prisma.review.findMany({ where: { shopId: shop }, orderBy: { createdAt: 'desc' } });

  // serialize dates to string for client component
  const serial = reviews.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }));

  return (
    <div>
      <h1>Dashboard — {shop}</h1>
      <p>Showing reviews for this shop only.</p>
      <DashboardClientWrapper initial={serial} shop={shop} ts={ts} token={token} />
    </div>
  );
}
