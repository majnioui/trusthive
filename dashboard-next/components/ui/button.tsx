"use client";
import React from 'react';

export default function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode, className?: string }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium border bg-white hover:bg-gray-50 ${className}`}
    >
      {children}
    </button>
  );
}

