import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import { Analytics } from '@vercel/analytics/react';

const roboto = Roboto({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'tagtapgo - Student Engagement Platform',
  description: 'Gamified attendance tracking for students',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/ttg-icon.svg',
    apple: '/icons/ttg-icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'tagtapgo',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6366F1',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={roboto.className} suppressHydrationWarning>
        <ServiceWorkerRegistration />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
