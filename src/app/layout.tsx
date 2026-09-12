import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Chotu Admin", template: "%s · Chotu Admin" },
  description: "Chotu super admin — manage every cafe running on the Chotu QR ordering system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
