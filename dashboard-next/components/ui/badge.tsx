"use client";
import React from 'react';

export default function Badge({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">{children}</span>
  );
}

