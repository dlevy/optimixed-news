import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.optimixed.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Optimixed — SEO & Digital Marketing News",
    template: "%s | Optimixed",
  },
  description:
    "The latest SEO news, algorithm updates, and digital marketing headlines from dozens of trusted sources — curated, categorized, and summarized in one place.",
  openGraph: {
    siteName: "Optimixed",
    type: "website",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4fbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1514" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${roboto.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* No-flash theme: apply the saved light/dark preference before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=document.cookie.match(/(?:^|; )optx_theme=(light|dark)/);if(m){document.documentElement.setAttribute('data-theme',m[1]);}}catch(e){}})();",
          }}
        />
        {/* Material Symbols (MD3 icon set). display=block avoids a flash of raw
            ligature text (e.g. "search") before the icon glyphs load. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-surface">
        {children}
      </body>
    </html>
  );
}
