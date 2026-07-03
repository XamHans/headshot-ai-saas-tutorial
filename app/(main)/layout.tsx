import type React from 'react';
import { Sidebar } from '@/components/sidebar';

import { Toaster } from "@/components/ui/sonner"

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col">{children}</main>
      <Toaster />
    </div>
  );
}
