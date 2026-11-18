import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://hirzo.com"),
  title: { default: "Hirzo — Entry-Level Sales Jobs UK", template: "%s | Hirzo" },
  description:
    "Find entry-level sales jobs across the UK. SDR, BDR and junior account executive roles for graduates and career changers. Apply directly with Hirzo.",
  keywords: [
    "entry level sales jobs UK",
    "SDR jobs UK",
    "graduate sales jobs",
    "junior sales executive",
    "BDR jobs UK",
    "sales development representative UK",
    "no experience sales jobs",
  ],
  authors: [{ name: "Hirzo" }],
  creator: "Hirzo",
  publisher: "Hirzo",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://hirzo.com",
    siteName: "Hirzo",
    title: "Hirzo — Entry-Level Sales Jobs UK",
    description:
      "Find entry-level sales jobs across the UK. SDR, BDR and junior AE roles for graduates.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Hirzo — Entry-Level Sales Jobs UK",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hirzo — Entry-Level Sales Jobs UK",
    description:
      "Find entry-level sales jobs across the UK. SDR, BDR and junior AE roles for graduates.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://hirzo.com" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
