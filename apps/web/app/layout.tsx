import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/component/providers";
import { getRequestCurrency } from "@/lib/request-currency";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Everest Academy",
  description: "Plateforme d'élite pour l'excellence académique.",
  icons: {
    icon: "/logo-white.png",
    shortcut: "/logo-white.png",
    apple: "/logo-white.png",
  },
};

/**
 * Le layout lit la devise du visiteur et la descend dans l'arbre client.
 *
 * Cette lecture rend tout le site dynamique — c'est voulu : une page mise en cache
 * afficherait le tarif du visiteur précédent, ce qui est exactement le défaut qu'on
 * cherche à éviter.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currency = await getRequestCurrency();

  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers currency={currency}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
