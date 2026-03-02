import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nova - Lose Weight with AI Calorie Coaching',
  description:
    'Track calories, maintain your deficit, and lose weight with AI coaching. Log meals by chat or photo. Download Nova on the App Store.',
  manifest: '/manifest.json',
  metadataBase: new URL('https://novahealthcoach.com'),
  openGraph: {
    title: 'Nova - Lose Weight with AI Calorie Coaching',
    description:
      'Track calories, maintain your deficit, and lose weight with AI coaching. Log meals by chat or photo.',
    url: 'https://novahealthcoach.com',
    siteName: 'Nova',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nova - Lose Weight with AI Calorie Coaching',
    description:
      'Track calories, maintain your deficit, and lose weight with AI coaching. Log meals by chat or photo.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-gray-900 transition-colors`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
