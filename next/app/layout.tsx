import type { Metadata } from "next";
import { Geist, Geist_Mono, Fredoka, Nunito_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ClientViewportFix from './ClientViewportFix'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fredoka',
});

export const metadata: Metadata = {
  title: "Nodal - Your place to think",
  description: "Create, collaborate, and visualize ideas with AI-powered mindmapping",
  icons: {
    icon: [
      {
        url: '/nodal.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/nodal.png', // or whatever you name it
        type: 'image/png',
      },
    ],
    apple: '/nodal.png', // Safari specifically
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-B9L2XKLSWE'

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>

        {/* Google Analytics (GA4) */}
        <Script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>

      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} ${nunitoSans.variable} antialiased`}
      >
        <ClientViewportFix />
        {children}
      </body>
    </html>
  );
}
