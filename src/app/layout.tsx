import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Disclaimer } from "@/components/disclaimer";
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
  title: "HeizCheck",
  description: "Prüfung von Heizkostenabrechnungen vor dem Versand an Mieter",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Disclaimer />
      </body>
    </html>
  );
}
