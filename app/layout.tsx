import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kafagu Tech | Technician Command Center",
  description: "Panel manajemen teknisi dan pekerjaan PT. Kafagu Tech Prosperous.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
