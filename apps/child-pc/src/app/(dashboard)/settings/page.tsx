'use client';

import { useEffect, useState } from 'react';
import { fetchMe, updateMe, updateElder, refreshInviteCode, type ElderProfile } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { useCurrentFamily } from '@/components/providers/current-family-provider';
import { ElderForm } from '@/components/elder-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, RefreshCw, Save, Users, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SettingsTab = 'account' | 'elder';

export default function SettingsPage() {
  const { user } = useAuth();
  const { currentFamily, currentFamilyId, families, isLoading: familyLoading, refreshFamilies, setCurrentFamilyId } = useCurrentFamily();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [childName, setChildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((me) => {
        setChildName(me.name || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSaveChildInfo = async () => {
    setSaving(true);
    try {
      await updateMe({ name: childName });
      showMessage('子女信息已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveElder = async (data: Partial<ElderProfile>) => {
    if (!currentFamilyId) return;
    setSaving(true);
    try {
      await updateElder(currentFamilyId, data);
      await refreshFamilies();
      showMessage('老人信息已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!currentFamily?.inviteCode) return;
    await navigator.clipboard.writeText(currentFamily.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefreshInviteCode = async () => {
    if (!currentFamilyId) return;
    setRefreshing(true);
    try {
      await refreshInviteCode(currentFamilyId);
      await refreshFamilies();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || familyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">设置</h1>

      {message && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm">{message}</div>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button
          variant={activeTab === 'account' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('account')}
        >
          我的账号
        </Button>
        <Button
          variant={activeTab === 'elder' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('elder')}
        >
          老人信息
        </Button>
      </div>

      {activeTab === 'account' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">子女信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="childName">姓名</Label>
              <Input
                id="childName"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input value={user?.phone || ''} disabled />
            </div>
            <Button onClick={handleSaveChildInfo} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'elder' && (
        <>
          {!currentFamily ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <Users className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">您还没有关联老人</p>
                <Link href="/">
                  <Button>去添加老人</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">老人信息</CardTitle>
                {families.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none">
                      <span>{currentFamily.elder.name}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {families.map((f) => (
                        <DropdownMenuItem
                          key={f.id}
                          onClick={() => setCurrentFamilyId(f.id)}
                          className="flex items-center justify-between"
                        >
                          <span>{f.elder.name}</span>
                          {f.id === currentFamily.id && (
                            <span className="text-xs text-muted-foreground">当前</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <ElderForm
                  elder={currentFamily.elder}
                  onSave={handleSaveElder}
                  saving={saving}
                />
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">老人端绑定码</p>
                  <div className="flex items-center gap-3">
                    <code className="bg-muted px-3 py-1.5 rounded font-mono">
                      {currentFamily.inviteCode}
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
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
