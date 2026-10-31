import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

// Self-hosted by next/font at build time: no runtime request to Google.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const ui = Figtree({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

export const metadata: Metadata = {
  title: "Sportstech Console",
  description: "Sportstech Amazon.de weekly sales and PPC dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <Sidebar />
        <main className="wd-main">{children}</main>
      </body>
    </html>
  );
}
