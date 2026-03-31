import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { Geist } from "geist/font/sans";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "WebAI",
  description: "A modern Gemini-powered chat workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body className={`${Geist.className} ${GeistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
