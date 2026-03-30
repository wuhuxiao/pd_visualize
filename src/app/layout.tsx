import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PD Visualize",
  description: "Discrete-event simulator for LLM prefill/decode separated deployment",
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
