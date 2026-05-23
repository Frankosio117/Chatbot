import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";
  const isEmbed = pathname.includes("/embed/");

  // For embed pages render a minimal, fully transparent page
  if (isEmbed) {
    return (
      <html lang="es" style={{ colorScheme: 'light', background: 'transparent', backgroundColor: 'transparent' }}>
        <head>
          <style>{`
            *, *::before, *::after { box-sizing: border-box; }
            html, body {
              color-scheme: light !important;
              background: transparent !important;
              background-color: transparent !important;
              background-image: none !important;
              overflow: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: 100% !important;
            }
          `}</style>
        </head>
        <body style={{ background: 'transparent', backgroundColor: 'transparent' }}>
          {children}
        </body>
      </html>
    );
  }

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
                document.documentElement.style.setProperty('color-scheme', 'light', 'important');
                document.documentElement.style.setProperty('background-color', 'transparent', 'important');
                document.body && document.body.style.setProperty('background-color', 'transparent', 'important');
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <EmbedClassManager />
        {children}
      </body>
    </html>
  );
}
