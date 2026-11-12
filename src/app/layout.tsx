import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YalSync Attendance",
  description: "Time in / time out with facial recognition kiosk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="flex min-h-full flex-col bg-[var(--bg-base)] text-white">
        {children}
      </body>
    </html>
  );
}
