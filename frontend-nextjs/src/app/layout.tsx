import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudDeploy — Next-Gen Vercel Clone",
  description: "Deploy web applications effortlessly with live ECS builds, real-time streaming logs, and custom domain reverse-proxying.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] selection:bg-slate-200">
        {children}
      </body>
    </html>
  );
}
