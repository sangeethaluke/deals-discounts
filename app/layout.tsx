import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Deals & Discounts | Discover local, save more",
  description: "Discover shops, restaurants and everyday offers in your city.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
