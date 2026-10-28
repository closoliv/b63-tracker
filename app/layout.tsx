import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "B63 Tracker",
  description: "How soon to leave for the next bus or train",
};

export const viewport: Viewport = {
  themeColor: "#0B0C0F",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
