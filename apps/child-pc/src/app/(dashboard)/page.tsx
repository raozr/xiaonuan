'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentFamily } from '@/components/providers/current-family-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const { families, isLoading, setCurrentFamilyId } = useCurrentFamily();
  const router = useRouter();

  const handleEnterFamily = (familyId: string) => {
    setCurrentFamilyId(familyId);
    router.push(`/elders/${familyId}`);
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
        <h1 className="text-2xl font-bold">我的老人</h1>
        <Link href="/elders/add">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            添加老人
          </Button>
        </Link>
      </div>

      {families.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-4">👴</div>
            <p className="text-muted-foreground mb-4">您还没有关联任何老人</p>
            <Link href="/elders/add">
              <Button>添加第一位老人</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {families.map((family) => (
            <Card
              key={family.id}
              className="hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => handleEnterFamily(family.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium text-primary">
                  {family.elder.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{family.elder.name}</h3>
                    <Badge variant={family.isOnline ? 'default' : 'secondary'}>
                      {family.isOnline ? '陪伴中' : '休息中'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    最后活跃：{family.lastActive ? new Date(family.lastActive).toLocaleString('zh-CN') : '今日未通话'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
