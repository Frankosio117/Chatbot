import ChatWidget from '@/components/ChatWidget';

interface PageProps {
  params: Promise<{ empresaId: string }>;
}

export default async function EmbedPage({ params }: PageProps) {
  const { empresaId } = await params;
  return <ChatWidget empresaId={empresaId} />;
}
