import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Club Support", template: "%s · Club Support" },
  description:
    "Club Support: veldbezetting, kleedkamerindeling, wedstrijdplanning en vrijwilligersroosters voor amateurverenigingen. Weg met de Excel-sheets.",
};

// viewport-fit=cover lets the app draw under the iPhone home indicator; we pad with safe-area insets ourselves.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#061f15",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
