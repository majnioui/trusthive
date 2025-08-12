"use client";
import React from 'react';
import ReviewTableClient from './ReviewTableClient';

export default function DashboardClientWrapper({ initial, shop, ts, token }: { initial: any[]; shop?: string; ts?: string; token?: string }) {
  // If we have a valid token and shop, establish session immediately
  React.useEffect(() => {
    if (token && shop) {
      (async () => {
        try {
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
            credentials: 'same-origin'
          });
          // Remove token from URL to avoid leaking
          if (typeof window !== 'undefined' && window.history && window.location) {
            const url = new URL(window.location.href);
            url.searchParams.delete('token');
            url.searchParams.delete('shop');
            url.searchParams.delete('ts');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          }
        } catch (e) {
          // ignore
        }
      })();
    }
  }, [token, shop]);

  return <ReviewTableClient initial={initial} shop={shop} ts={ts} token={token} />;
}

