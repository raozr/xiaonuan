'use client';

import { useState } from 'react';
import { type Elder } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';

interface ElderFormProps {
  elder: Elder;
  onSave: (data: Partial<Elder>) => void;
  saving: boolean;
}

export function ElderForm({ elder, onSave, saving }: ElderFormProps) {
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
