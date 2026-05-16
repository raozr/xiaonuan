'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchFamily, fetchDailySummary, updateElder, refreshInviteCode, type Family, type DailySummary } from '@/lib/api';
import { useCurrentFamily } from '@/components/providers/current-family-provider';
import { FamilyFeedPanel } from '@/components/family-feed-panel';
import { VoiceClonePanel } from '@/components/voice-clone-panel';
import { ElderForm } from '@/components/elder-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Copy, RefreshCw, Sun, Clock } from 'lucide-react';

type DetailTab = 'summary' | 'feed' | 'voice' | 'settings';

export default function ElderDetailPage() {
  const params = useParams();
  const familyId = params.id as string;
  const { refreshFamilies } = useCurrentFamily();

  const [family, setFamily] = useState<Family | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleSaveElder = async (data: Partial<Family['elder']>) => {
    if (!familyId) return;
    setSaving(true);
    try {
      await updateElder(familyId, data);
      await refreshFamilies();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!family?.inviteCode) return;
    await navigator.clipboard.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefreshInviteCode = async () => {
    setRefreshing(true);
    try {
      await refreshInviteCode(familyId);
      await refreshFamilies();
      await loadData();
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{elder.name}的陪伴</h1>
      </div>

      {/* Summary bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium text-primary">
                {elder.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{elder.name}</h3>
                  <Badge variant={family.isOnline ? 'default' : 'secondary'}>
                    {family.isOnline ? '陪伴中' : '休息中'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {elder.age ? `${elder.age}岁` : ''} {elder.dialect ? `· ${elder.dialect}` : ''}
                  {family.lastActive ? ` · 最后活跃 ${new Date(family.lastActive).toLocaleString('zh-CN')}` : ' · 今日未通话'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{family.inviteCode}</code>
              <Button variant="outline" size="sm" onClick={handleCopyInviteCode}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copied ? '已复制' : '复制'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefreshInviteCode} disabled={refreshing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'summary' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('summary')}
        >
          今日总结
        </Button>
        <Button
          variant={activeTab === 'feed' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('feed')}
        >
          家庭动态
        </Button>
        <Button
          variant={activeTab === 'voice' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('voice')}
        >
          声音复刻
        </Button>
        <Button
          variant={activeTab === 'settings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('settings')}
        >
          老人设置
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* Tab content */}
      {activeTab === 'summary' && (
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
      )}

      {activeTab === 'feed' && <FamilyFeedPanel familyId={familyId} />}

      {activeTab === 'voice' && <VoiceClonePanel familyId={familyId} />}

      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">老人信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ElderForm elder={family.elder} onSave={handleSaveElder} saving={saving} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
