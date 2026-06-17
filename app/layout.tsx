import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { PwaScript } from "@/components/PwaScript"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Aprime fluides — Réalisations",
  description: "Back-office techniciens Aprime fluides",
  robots: "noindex, nofollow",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aprime fluides",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0e2a52",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        {children}
        <PwaScript />
      </body>
    </html>
  )
}
