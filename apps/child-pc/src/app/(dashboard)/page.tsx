'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchFamilies, type Family } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFamilies()
      .then(setFamilies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
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
            <Link key={family.id} href={`/elders/${family.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
