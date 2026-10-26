import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "ReviewFlow — QR AI Review & Loyalty System",
  description: "A QR code on the table. Customers collect stamps, unlock rewards, and post reviews effortlessly.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="bg-paper text-ink font-sans antialiased selection:bg-[#F4ECE1] selection:text-[#24211E]">
        {children}
      </body>
    </html>
  );
}
