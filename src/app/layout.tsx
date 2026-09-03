import type { Metadata } from "next";
import { Source_Serif_4, Noto_Serif_Thai } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const notoSerifThai = Noto_Serif_Thai({
  variable: "--font-noto-serif-thai",
  subsets: ["thai"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FamKeep",
  description:
    "พื้นที่ของครอบครัวสำหรับเก็บไฟล์ งาน และปฏิทินร่วมกัน เชื่อมต่อกับ LINE",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${sourceSerif.variable} ${notoSerifThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
