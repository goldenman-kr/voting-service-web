import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: "온라인 투표",
  description: "폐쇄형 선거인 명부 기반의 안전한 온라인 투표 서비스",
  openGraph: {
    title: "온라인 투표",
    description: "폐쇄형 선거인 명부 기반의 안전한 온라인 투표 서비스",
    images: [
      {
        url: "/hero/bg2.png",
        width: 1122,
        height: 1402,
        alt: "투표함에 투표용지를 넣는 손"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "온라인 투표",
    description: "폐쇄형 선거인 명부 기반의 안전한 온라인 투표 서비스",
    images: ["/hero/bg2.png"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
