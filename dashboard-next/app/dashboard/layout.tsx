import Sidebar from '../../components/ui/sidebar';
import React from 'react';

export const metadata = {
  title: 'Dashboard - TrustHive',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}

