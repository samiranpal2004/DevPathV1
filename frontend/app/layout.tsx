import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { AuthSync } from "@/components/AuthSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevPath",
  description: "The complete engine for coders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
          <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        </head>
        <body className="min-h-screen flex flex-col bg-surface text-on-surface selection:bg-primary-fixed-dim selection:text-on-primary-fixed">
          <AuthSync />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
