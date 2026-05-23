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

  const transparentStyle = { background: "transparent", backgroundColor: "transparent" } as const;

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark${isEmbed ? " embed-page" : ""}`}
      style={isEmbed ? transparentStyle : undefined}
    >
      <head>
        {isEmbed && (
          <style>{`
            html, body {
              background: transparent !important;
              background-color: transparent !important;
              background-image: none !important;
              overflow: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          `}</style>
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && window.location.pathname.includes('/embed/')) {
                document.documentElement.classList.add('embed-page');
                document.documentElement.style.setProperty('background-color', 'transparent', 'important');
                document.body && document.body.style.setProperty('background-color', 'transparent', 'important');
              }
            `,
          }}
        />
      </head>
      <body
        className={`min-h-full flex flex-col text-zinc-100${isEmbed ? "" : " bg-zinc-950"}`}
        style={isEmbed ? transparentStyle : undefined}
      >
        <EmbedClassManager />
        {children}
      </body>
    </html>
  );
}
