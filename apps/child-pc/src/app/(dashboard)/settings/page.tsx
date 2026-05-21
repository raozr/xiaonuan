'use client';

import { useEffect, useState } from 'react';
import { fetchMe, updateMe } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [childName, setChildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
      showMessage('个人信息已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">我的账号</CardTitle>
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
    </div>
  );
}
