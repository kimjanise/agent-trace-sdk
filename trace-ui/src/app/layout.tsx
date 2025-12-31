import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Trace Dashboard",
  description: "Visualize and debug AI agent workflows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
