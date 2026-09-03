import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

/** Rounded, friendly modern sans with native Thai + Latin coverage. */
const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
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
      className={`${prompt.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
