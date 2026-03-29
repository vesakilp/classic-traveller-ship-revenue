import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Classic Traveller Ship Revenue Calculator",
  description: "Calculate passenger and cargo revenues for Classic Traveller RPG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
