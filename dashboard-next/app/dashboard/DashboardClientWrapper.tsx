"use client";
import React from 'react';
import ReviewTableClient from './ReviewTableClient';

export default function DashboardClientWrapper({ initial, shop, ts, token }: { initial: any[]; shop?: string; ts?: string; token?: string }) {
  return <ReviewTableClient initial={initial} shop={shop} ts={ts} token={token} />;
}

