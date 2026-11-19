import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const vazirmatn = localFont({
  src: [
    { path: '../assets/fonts/Vazirmatn-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../assets/fonts/Vazirmatn-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../assets/fonts/Vazirmatn-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-vazirmatn',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aghrin PishFactor | سامانه پیش‌فاکتور آهن آگرین',
  description:
    'سامانه اختصاصی مدیریت مشتریان، کالاها و صدور پیش‌فاکتور شرکت آهن آگرین',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-screen bg-[#F1F3F5] text-[#172535] antialiased">{children}</body>
    </html>
  );
}
