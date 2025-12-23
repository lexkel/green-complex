import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/components/GoogleAuth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Green Complex',
  description: 'Track and analyse your golf putting statistics',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Green Complex',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f6b3e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
