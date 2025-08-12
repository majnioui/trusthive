"use client";
import React, { useState } from 'react';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/badge';

type Review = {
  id: string;
  productId: number;
  authorName: string;
  authorEmail: string;
  rating: number;
  title?: string | null;
  content: string;
  createdAt: string;
  approved?: boolean;
};

export default function ReviewTableClient({ initial, token }: { initial: Review[]; token?: string }) {
  const [reviews, setReviews] = useState<Review[]>(initial || []);
  const [loading, setLoading] = useState<string | null>(null);
  const [sessionCreated, setSessionCreated] = useState(false);

  // Session creation is now handled in DashboardClientWrapper
  // This useEffect is kept for backward compatibility but should not be needed
  React.useEffect(() => {
    if (sessionCreated) return;
    if (!token) return;
    setSessionCreated(true);
  }, [token, sessionCreated]);

  async function doAction(id: string, action: string) {
    if (action === 'delete' && !confirm('Delete this review?')) return;
    setLoading(id);
    try {
      const url = `/api/reviews/${encodeURIComponent(id)}/action`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }), credentials: 'same-origin' });
      const data = await res.json();
      if (data && data.ok) {
        if (action === 'delete') setReviews(prev => prev.filter(r => r.id !== id));
        if (action === 'approve') setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: true } : r));
        if (action === 'hide') setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: false } : r));
      } else {
        alert((action[0].toUpperCase() + action.slice(1)) + ' failed: ' + (data && data.error ? data.error : res.statusText));
      }
    } catch (err) {
      alert((action[0].toUpperCase() + action.slice(1)) + ' error: ' + String(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr className="bg-gray-50">
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">ID</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Author</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Rating</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Content</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Created</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
        </tr>
      </thead>
      <tbody>
        {reviews.map(r => (
          <tr key={r.id} className={`${r.approved ? 'bg-green-50' : ''}`}>
            <td className="px-4 py-2 align-top max-w-xs truncate">{r.id}</td>
            <td className="px-4 py-2 align-top">{r.productId}</td>
            <td className="px-4 py-2 align-top">{r.authorName}<br/><small className="text-xs text-gray-500">{r.authorEmail}</small></td>
            <td className="px-4 py-2 align-top">{r.rating}</td>
            <td className="px-4 py-2 align-top">{r.title ? <div className="font-semibold">{r.title}</div> : null}<div className="text-sm text-gray-700">{r.content}</div></td>
            <td className="px-4 py-2 align-top">{new Date(r.createdAt).toLocaleString()}</td>
            <td className="px-4 py-2 align-top">
              <div className="flex items-center gap-2">
                <Button onClick={() => doAction(r.id, 'approve')} disabled={loading === r.id}>{loading === r.id ? 'Working...' : 'Approve'}</Button>
                <Button onClick={() => doAction(r.id, 'hide')} disabled={loading === r.id}>{loading === r.id ? 'Working...' : 'Hide'}</Button>
                <Button onClick={() => doAction(r.id, 'delete')} disabled={loading === r.id} className="border-red-300 text-red-600">{loading === r.id ? 'Deleting...' : 'Delete'}</Button>
                {r.approved ? <Badge>Approved</Badge> : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
