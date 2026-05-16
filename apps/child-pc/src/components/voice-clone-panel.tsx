'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  fetchVoiceClones,
  createVoiceClone,
  activateVoiceClone,
  deleteVoiceClone,
  type VoiceClone,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Trash2, Sparkles, Loader2 } from 'lucide-react';

const prompts = [
  '今天天气真不错，我想出去走走，晒晒太阳。',
  '你还记得我小时候的那件事吗？那时候真开心啊。',
  '晚上我想吃点清淡的，帮我看看有什么好吃的。',
];

interface VoiceClonePanelProps {
  familyId: string;
}

export function VoiceClonePanel({ familyId }: VoiceClonePanelProps) {
  const [clones, setClones] = useState<VoiceClone[]>([]);
  const [activeVoiceId, setActiveVoiceId] = useState('');
  const [samples, setSamples] = useState<{ id: string; blob: Blob; url: string }[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldCancelRef = useRef(false);

  const loadClones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchVoiceClones(familyId);
      setClones(res.data);
      setActiveVoiceId(res.activeVoiceId);
    } catch {
      setClones([]);
      setActiveVoiceId('');
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    loadClones();
  }, [loadClones]);

  const startRecording = async () => {
    shouldCancelRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (shouldCancelRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        const url = URL.createObjectURL(blob);
        setSamples((prev) => [...prev, { id: crypto.randomUUID(), blob, url }]);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError('无法访问麦克风');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    shouldCancelRef.current = true;
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const removeSample = (id: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCreateClone = async () => {
    if (samples.length === 0) return;
    setCreating(true);
    try {
      const converted = await Promise.all(
        samples.map(async (s, i) => {
          const reader = new FileReader();
          reader.readAsDataURL(s.blob);
          return new Promise<{ filename: string; base64: string }>((resolve) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve({ filename: `sample_${i + 1}.webm`, base64 });
            };
          });
        })
      );
      await createVoiceClone({ familyId, samples: converted });
      setSamples([]);
      await loadClones();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (voiceId: string) => {
    try {
      await activateVoiceClone(voiceId);
      setActiveVoiceId(voiceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '激活失败');
    }
  };

  const handleDelete = async (voiceId: string) => {
    try {
      await deleteVoiceClone(voiceId);
      await loadClones();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">录制样本</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">参考文案</span>
              <Button variant="ghost" size="sm" onClick={() => setPromptIndex((i) => (i + 1) % prompts.length)}>
                换一段
              </Button>
            </div>
            <p className="text-muted-foreground">{prompts[promptIndex]}</p>
          </div>

          {samples.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium">已录制样本 ({samples.length}/3)</span>
              {samples.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                  <span className="text-sm">样本 {i + 1}</span>
                  <audio src={s.url} controls className="flex-1 h-8" />
                  <Button variant="ghost" size="sm" onClick={() => removeSample(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col items-center gap-3 py-4">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              onTouchCancel={stopRecording}
              className={`h-16 w-16 rounded-full flex items-center justify-center transition-colors ${
                recording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {recording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <p className="text-sm text-muted-foreground">
              {recording ? '录音中，松开发送' : '按住录音，松开后保存样本'}
            </p>
          </div>

          <Button
            className="w-full"
            disabled={samples.length === 0 || creating}
            onClick={handleCreateClone}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            开始复刻
          </Button>
        </CardContent>
      </Card>

      {clones.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">已复刻音色</h3>
          {clones.map((clone) => (
            <Card key={clone.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={clone.status === 'READY' ? 'default' : 'secondary'}>
                    {clone.status === 'READY' ? '可用' : clone.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(clone.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activeVoiceId === clone.voiceId ? (
                    <Badge variant="outline">已激活</Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleActivate(clone.voiceId)}>
                      激活
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(clone.voiceId)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
