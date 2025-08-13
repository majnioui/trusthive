"use client";
import React from 'react';
import ReviewTableClient from './ReviewTableClient';

export default function DashboardClientWrapper({ initial, shop, ts, token }: { initial: any[]; shop?: string; ts?: string; token?: string }) {
  // Establish session if token is present
  React.useEffect(() => {
    if (token && shop) {
      (async () => {
        try {
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
            credentials: 'same-origin'
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to establish session:', response.status, errorData);
          } else {
            // Force a page reload to ensure the session cookie is available
            window.location.reload();
          }
        } catch (e) {
          console.error('Error establishing session:', e);
        }
      })();
    }
  }, [token, shop]);

  // Clean up URL parameters if token is present
  React.useEffect(() => {
    if (token && typeof window !== 'undefined' && window.history && window.location) {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      url.searchParams.delete('shop');
      url.searchParams.delete('ts');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, [token]);

  return <ReviewTableClient initial={initial} token={token} />;
}

