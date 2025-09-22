import type { Metadata } from "next";
import { Geist, Geist_Mono, Fredoka, Nunito_Sans } from "next/font/google";
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>

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
