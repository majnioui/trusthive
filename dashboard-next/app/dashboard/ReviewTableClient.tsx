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

export default function ReviewTableClient({ initial, shop, ts, token }: { initial: Review[]; shop?: string; ts?: string; token?: string }) {
  const [reviews, setReviews] = useState<Review[]>(initial || []);
  const [loading, setLoading] = useState<string | null>(null);
  const [sessionCreated, setSessionCreated] = useState(false);

  // try to establish session cookie so subsequent requests don't need token
  React.useEffect(() => {
    if (sessionCreated) return;
    if (!shop || !ts || !token) return;
    (async () => {
      try {
        await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop, ts, token }) });
      } catch (e) {
        // ignore
      }
      setSessionCreated(true);
    })();
  }, [shop, ts, token, sessionCreated]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this review?')) return;
    setLoading(id);
    try {
      const qs = new URLSearchParams();
      if (shop) qs.set('shop', shop);
      if (ts) qs.set('ts', ts);
      // if we already created session cookie, token is not required; include token otherwise
      if (token) qs.set('token', token);
      const url = `/api/reviews/${encodeURIComponent(id)}/action?${qs.toString()}`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete' }), credentials: 'same-origin' });
      const data = await res.json();
      if (data && data.ok) {
        setReviews(prev => prev.filter(r => r.id !== id));
      } else {
        alert('Delete failed: ' + (data && data.error ? data.error : res.statusText));
      }

  async function handleApprove(id: string) {
    setLoading(id);
    try {
      const qs = new URLSearchParams(); if (shop) qs.set('shop', shop); if (ts) qs.set('ts', ts); if (token) qs.set('token', token);
      const url = `/api/reviews/${encodeURIComponent(id)}/action?${qs.toString()}`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }), credentials: 'same-origin' });
      const data = await res.json();
      if (data && data.ok) {
        setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: true } : r));
      } else {
        alert('Approve failed: ' + (data && data.error ? data.error : res.statusText));
      }
    } catch (err) {
      alert('Approve error: ' + String(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleHide(id: string) {
    setLoading(id);
    try {
      const qs = new URLSearchParams(); if (shop) qs.set('shop', shop); if (ts) qs.set('ts', ts); if (token) qs.set('token', token);
      const url = `/api/reviews/${encodeURIComponent(id)}/action?${qs.toString()}`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hide' }), credentials: 'same-origin' });
      const data = await res.json();
      if (data && data.ok) {
        setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: false } : r));
      } else {
        alert('Hide failed: ' + (data && data.error ? data.error : res.statusText));
      }
    } catch (err) {
      alert('Hide error: ' + String(err));
    } finally {
      setLoading(null);
    }
  }
    } catch (err) {
      alert('Delete error: ' + String(err));
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
                <Button onClick={() => handleApprove(r.id)} disabled={loading === r.id}>{loading === r.id ? 'Working...' : 'Approve'}</Button>
                <Button onClick={() => handleHide(r.id)} disabled={loading === r.id}>{loading === r.id ? 'Working...' : 'Hide'}</Button>
                <Button onClick={() => handleDelete(r.id)} disabled={loading === r.id} className="border-red-300 text-red-600">{loading === r.id ? 'Deleting...' : 'Delete'}</Button>
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
