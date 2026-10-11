import { ScreenShell } from '@/components/ui/ScreenShell';

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <ScreenShell>
      <h1 className="text-center text-4xl text-leaf">{code.toUpperCase()}</h1>
    </ScreenShell>
  );
}
