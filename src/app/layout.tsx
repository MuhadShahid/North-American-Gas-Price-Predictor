import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gas Price Predictor",
  description: "Real-time AI Forecasting based on Live Public Data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
