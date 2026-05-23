import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import EmbedClassManager from "@/components/EmbedClassManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentSaaS — Chatbots de IA para Negocios Locales",
  description: "Plataforma multi-tenant de agentes de IA conversacionales sin alucinaciones para negocios locales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && window.location.pathname.includes('/embed/')) {
                document.documentElement.classList.add('embed-page');
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col text-zinc-100">
        <EmbedClassManager />
        {children}
      </body>
    </html>
  );
}
