'use client';

import { useCurrentPairing } from '@/components/providers/current-pairing-provider';
import { VoiceClonePanel } from '@/components/voice-clone-panel';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import Link from 'next/link';

export default function VoiceClonePage() {
  const { currentPairingId, currentPairing, isLoading: pairingLoading } = useCurrentPairing();

  if (pairingLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!currentPairing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
        <Users className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">您还没有创建配对</p>
        <Link href="/">
          <Button>去添加配对</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">声音复刻</h1>
        <span className="text-sm text-muted-foreground">
          当前配对：{currentPairing.companionee?.name ?? '未知'}
        </span>
      </div>
      <VoiceClonePanel pairingId={currentPairingId} />
    </div>
  );
}
