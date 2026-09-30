import type { Metadata } from "next";
import { Disclaimer } from "@/components/disclaimer";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeizCheck",
  description: "Prüfung von Heizkostenabrechnungen vor dem Versand an Mieter",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="flex min-h-screen flex-col antialiased">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8">{children}</div>
        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <Disclaimer />
          </div>
        </footer>
      </body>
    </html>
  );
}
