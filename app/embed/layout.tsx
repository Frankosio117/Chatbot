import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat Widget',
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
      <head>
        <style>{`
          *, *::before, *::after {
            box-sizing: border-box;
          }
          html, body {
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
