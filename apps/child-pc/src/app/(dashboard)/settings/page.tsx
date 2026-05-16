'use client';

import { useEffect, useState } from 'react';
import { fetchMe, updateMe, fetchFamilies, updateElder, refreshInviteCode, type Family, type ElderProfile } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Copy, RefreshCw, ChevronDown, Save } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [childName, setChildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchMe(), fetchFamilies()])
      .then(([me, f]) => {
        setChildName(me.name || '');
        setFamilies(f);
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

  const handleSaveElder = async (familyId: string, data: Partial<ElderProfile>) => {
    setSaving(true);
    try {
      await updateElder(familyId, data);
      setFamilies((prev) =>
        prev.map((f) =>
          f.id === familyId ? { ...f, elder: { ...f.elder, ...data } } : f
        )
      );
      showMessage('老人信息已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (familyId: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(familyId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = async (familyId: string) => {
    setRefreshingId(familyId);
    try {
      const res = await refreshInviteCode(familyId);
      setFamilies((prev) =>
        prev.map((f) =>
          f.id === familyId ? { ...f, inviteCode: res.inviteCode } : f
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setRefreshingId(null);
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

      {/* 子女信息 */}
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

      {/* 老人信息 */}
      {families.map((family) => (
        <Collapsible key={family.id} defaultOpen>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{family.elder.name} 的信息</CardTitle>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <ElderForm
                  elder={family.elder}
                  onSave={(data) => handleSaveElder(family.id, data)}
                  saving={saving}
                />
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">老人端绑定码</p>
                  <div className="flex items-center gap-3">
                    <code className="bg-muted px-3 py-1.5 rounded font-mono">{family.inviteCode}</code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(family.id, family.inviteCode)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      {copiedId === family.id ? '已复制' : '复制'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefresh(family.id)}
                      disabled={refreshingId === family.id}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${refreshingId === family.id ? 'animate-spin' : ''}`} />
                      重新生成
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}

function ElderForm({
  elder,
  onSave,
  saving,
}: {
  elder: ElderProfile;
  onSave: (data: Partial<ElderProfile>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: elder.name,
    age: elder.age?.toString() || '',
    dialect: elder.dialect || '',
    hobbies: elder.hobbies || '',
    healthNotes: elder.healthNotes || '',
    topicsToAvoid: elder.topicsToAvoid || '',
    greetingPreference: elder.greetingPreference || '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave({
      name: form.name,
      age: form.age ? parseInt(form.age, 10) : undefined,
      dialect: form.dialect,
      hobbies: form.hobbies,
      healthNotes: form.healthNotes,
      topicsToAvoid: form.topicsToAvoid,
      greetingPreference: form.greetingPreference,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>姓名</Label>
          <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>年龄</Label>
          <Input
            type="number"
            value={form.age}
            onChange={(e) => handleChange('age', e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>方言</Label>
        <Input value={form.dialect} onChange={(e) => handleChange('dialect', e.target.value)} placeholder="如普通话、粤语、四川话" />
      </div>
      <div className="space-y-2">
        <Label>爱好</Label>
        <Textarea
          value={form.hobbies}
          onChange={(e) => handleChange('hobbies', e.target.value)}
          placeholder="如养花、听京剧、下棋等"
        />
      </div>
      <div className="space-y-2">
        <Label>健康注意事项</Label>
        <Textarea
          value={form.healthNotes}
          onChange={(e) => handleChange('healthNotes', e.target.value)}
          placeholder="如腰不好、避免剧烈运动等"
        />
      </div>
      <div className="space-y-2">
        <Label>回避话题</Label>
        <Textarea
          value={form.topicsToAvoid}
          onChange={(e) => handleChange('topicsToAvoid', e.target.value)}
          placeholder="如已故的老伴等敏感话题"
        />
      </div>
      <div className="space-y-2">
        <Label>问候偏好</Label>
        <Input
          value={form.greetingPreference}
          onChange={(e) => handleChange('greetingPreference', e.target.value)}
          placeholder="称呼我老王就行"
        />
      </div>
      <Button onClick={handleSubmit} disabled={saving}>
        <Save className="h-4 w-4 mr-1" />
        保存老人信息
      </Button>
    </div>
  );
}
