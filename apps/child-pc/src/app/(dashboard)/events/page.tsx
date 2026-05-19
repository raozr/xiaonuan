'use client';

import { useCurrentPairing } from '@/components/providers/current-pairing-provider';
import { EventTimelinePanel } from '@/components/event-timeline-panel';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import Link from 'next/link';

export default function EventsPage() {
  const { currentPairingId, currentPairing, isLoading } = useCurrentPairing();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!currentPairing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
        <Clock className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">请先选择一个老人</p>
        <Link href="/">
          <Button>去选择老人</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">事件时间线</h1>
        <span className="text-sm text-muted-foreground">
          当前老人：{currentPairing.elder.name}
        </span>
      </div>
      <EventTimelinePanel pairingId={currentPairingId} />
    </div>
  );
}
