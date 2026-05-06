import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebAI",
  description: "A modern Gemini-powered chat workspace.",
};

/**
 * RootLayout 负责整个 App Router 共享的 HTML 壳层。
 * 字体变量挂到 body 上，下面所有页面和组件都能直接复用。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
