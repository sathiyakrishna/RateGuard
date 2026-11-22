import type { Metadata, Viewport } from 'next';
import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'RateGuard – Catch vendor overbilling before you pay', template: '%s · RateGuard' },
  description: 'Upload a contract and an invoice. RateGuard checks every line against the contract rate card and shows what you can recover before you pay.',
  openGraph: {
    title: 'RateGuard – Catch vendor overbilling before you pay',
    description: 'Rate drift, items not in the contract and expired rates, caught line by line with the clause cited.',
    type: 'website'
  }
};

export const viewport: Viewport = { themeColor: '#0B1F4D', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* restore the saved sidebar choice before first paint so a collapsed sidebar never flashes open */}
        <script dangerouslySetInnerHTML={{ __html: "try{var v=localStorage.getItem('ig-sidebar');if(v==='rail'||v==='full')document.documentElement.dataset.sb=v}catch(e){}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
