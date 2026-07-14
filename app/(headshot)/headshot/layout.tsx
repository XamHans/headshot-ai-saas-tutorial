import type React from 'react';

// The headshot product flow is a focused, full-width conversion page — it
// intentionally opts out of the shared dev-kit sidebar ((main)/layout.tsx)
// rather than removing it app-wide, since /posts and /playground/* still rely
// on it for navigation.
export default function HeadshotLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-screen">{children}</div>;
}
