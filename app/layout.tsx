import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ODAD Mart | Only Deals and Discounts",
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
