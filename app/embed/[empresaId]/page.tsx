import ChatWidget from '@/components/ChatWidget';

interface PageProps {
  params: Promise<{ empresaId: string }>;
}

export default async function EmbedPage({ params }: PageProps) {
  const { empresaId } = await params;
  
  return (
    <>
      <style>{`
        html, body {
          background-color: transparent !important;
          background-image: none !important;
          overflow: hidden !important;
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>
      <ChatWidget empresaId={empresaId} />
    </>
  );
}
