import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SearchProvider } from "@/components/search/SearchProvider";
import { CommandPalette } from "@/components/search/CommandPalette";
import "./globals.css";

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dynasty Database — NFL Draft Prospect Analytics",
  description:
    "Analytical grades, position rankings, and draft-class boards for every incoming dynasty relevant rookie since 2015.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${body.variable} ${mono.variable}`}
    >
      <body className="bg-void font-body text-ink antialiased selection:bg-accent/30 selection:text-ink">
        <SearchProvider>
          <Navbar />
          {children}
          <Footer />
          <CommandPalette />
        </SearchProvider>
      </body>
    </html>
  );
}
