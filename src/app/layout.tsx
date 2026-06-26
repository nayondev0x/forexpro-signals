import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = "https://forexpro-signals.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ForexPro Signals — Real-Time Forex Trading Signals",
  description:
    "Professional real-time forex trading signals with buy/sell recommendations, take profit and stop loss levels. Live RSI, MACD, EMA, Bollinger Bands analysis. Developed by nayondev.",
  keywords: [
    "forex",
    "forex signals",
    "trading signals",
    "buy sell signals",
    "forex trading",
    "real-time forex",
    "currency pairs",
    "technical analysis",
    "RSI",
    "MACD",
    "nayondev",
  ],
  authors: [{ name: "nayondev" }],
  creator: "nayondev",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "ForexPro Signals — Real-Time Forex Trading Signals",
    description:
      "Professional real-time forex trading signals with live technical analysis. RSI, MACD, EMA, Bollinger Bands powered.",
    siteName: "ForexPro Signals",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ForexPro Signals — Real-Time Forex Trading Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ForexPro Signals — Real-Time Forex Trading Signals",
    description:
      "Professional real-time forex trading signals with live technical analysis.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ForexPro Signals",
  description:
    "Professional real-time forex trading signals with buy/sell recommendations, take profit and stop loss levels.",
  url: siteUrl,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Person",
    name: "nayondev",
  },
  featureList: [
    "Real-time forex signals",
    "Technical analysis (RSI, MACD, EMA, Bollinger Bands)",
    "Currency strength heatmap",
    "Risk calculator",
    "Economic calendar",
    "Market news",
    "Stock prices",
    "Crypto signals",
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}