'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchFamily, fetchDailySummary, refreshInviteCode, type Family, type DailySummary } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Copy, RefreshCw, MessageSquare, Sun, Clock } from 'lucide-react';

export default function ElderDetailPage() {
  const params = useParams();
  const familyId = params.id as string;

  const [family, setFamily] = useState<Family | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    try {
      const [f, s] = await Promise.all([
        fetchFamily(familyId),
        fetchDailySummary(familyId),
      ]);
      setFamily(f);
      setSummary(s.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [familyId]);

  const handleCopyInviteCode = async () => {
    if (!family?.inviteCode) return;
    await navigator.clipboard.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefreshInviteCode = async () => {
    setRefreshing(true);
    try {
      const res = await refreshInviteCode(familyId);
      setFamily((prev) => prev ? { ...prev, inviteCode: res.inviteCode } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}小时${mins % 60}分钟`;
    return `${mins}分钟`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !family) {
    return <p className="text-destructive">{error || '老人信息不存在'}</p>;
  }

  const elder = family.elder;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{elder.name}的陪伴</h1>
      </div>

      {/* 今日总结 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">今日状态</CardTitle>
        </CardHeader>
        <CardContent>
          {summary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted rounded-lg p-4 flex items-center gap-3">
                  <Sun className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">情绪</p>
                    <p className="font-medium">{summary?.mood || '--'}</p>
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-4 flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">时长</p>
                    <p className="font-medium">
                      {summary?.duration ? formatDuration(summary.duration) : '--'}
                    </p>
                  </div>
                </div>
              </div>

              {summary?.highlights && summary.highlights.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">今日亮点</p>
                  <div className="space-y-2">
                    {summary.highlights.map((highlight, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {highlight}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">今天还没有陪伴记录</p>
          )}
        </CardContent>
      </Card>

      {/* 告诉小暖 */}
      <Link href={`/feed?familyId=${familyId}`}>
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">告诉小暖一件事</p>
                <p className="text-sm text-muted-foreground">分享关于老人的信息，帮助 AI 更好地陪伴</p>
              </div>
            </div>
            <Badge variant="secondary">去填写</Badge>
          </CardContent>
        </Card>
      </Link>

      {/* 邀请码 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">老人端绑定码</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <code className="bg-muted px-3 py-2 rounded text-lg font-mono tracking-wider">
              {family.inviteCode}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyInviteCode}>
              <Copy className="h-4 w-4 mr-1" />
              {copied ? '已复制' : '复制'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefreshInviteCode} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              重新生成
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            让老人在 APP 中输入此 6 位数字即可绑定
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
