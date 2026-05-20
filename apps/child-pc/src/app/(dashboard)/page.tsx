'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentPairing } from '@/components/providers/current-pairing-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const { pairings, isLoading, setCurrentPairingId } = useCurrentPairing();
  const router = useRouter();

  const handleEnterPairing = (pairingId: string) => {
    setCurrentPairingId(pairingId);
    router.push(`/elders/${pairingId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的配对</h1>
        <Link href="/elders/add">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            添加配对
          </Button>
        </Link>
      </div>

      {pairings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-4">👴</div>
            <p className="text-muted-foreground mb-4">您还没有关联任何配对</p>
            <Link href="/elders/add">
              <Button>添加第一个配对</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pairings.map((pairing) => {
            const elderName = pairing.elder?.name ?? '未知';
            return (
            <Card
              key={pairing.id}
              className="hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => handleEnterPairing(pairing.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium text-primary">
                  {elderName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{elderName}</h3>
                    <Badge variant={pairing.isOnline ? 'default' : 'secondary'}>
                      {pairing.isOnline ? '陪伴中' : '休息中'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    最后活跃：{pairing.lastActive ? new Date(pairing.lastActive).toLocaleString('zh-CN') : '今日未通话'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
