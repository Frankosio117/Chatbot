import ChatWidget from '@/components/ChatWidget';

interface PageProps {
  params: Promise<{ empresaId: string }>;
}

export default async function EmbedPage({ params }: PageProps) {
  const { empresaId } = await params;
  
  return (
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Chat</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: transparent; overflow: hidden; width: 100vw; height: 100vh; }
        `}</style>
      </head>
      <body className="bg-transparent">
        <ChatWidget empresaId={empresaId} />
      </body>
    </html>
  );
}
