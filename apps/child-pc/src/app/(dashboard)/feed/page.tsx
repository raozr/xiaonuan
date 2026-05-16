'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchFamilies, fetchFeeds, createFeed, type Family, type FamilyFeed } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Send, Loader2 } from 'lucide-react';

type InputMode = 'text' | 'voice';

export default function FeedPage() {
  const searchParams = useSearchParams();
  const initialFamilyId = searchParams.get('familyId');

  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>(initialFamilyId || '');
  const [feeds, setFeeds] = useState<FamilyFeed[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const loadFamilies = useCallback(async () => {
    try {
      const f = await fetchFamilies();
      setFamilies(f);
      if (!selectedFamilyId && f.length > 0) {
        setSelectedFamilyId(f[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [selectedFamilyId]);

  const loadFeeds = useCallback(async () => {
    if (!selectedFamilyId) return;
    try {
      const res = await fetchFeeds(selectedFamilyId);
      setFeeds(res.data);
    } catch {
      setFeeds([]);
    }
  }, [selectedFamilyId]);

  useEffect(() => {
    loadFamilies();
  }, [loadFamilies]);

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const handleSendText = async () => {
    if (!textContent.trim() || !selectedFamilyId) return;
    setSending(true);
    try {
      await createFeed(selectedFamilyId, { type: 'TEXT', content: textContent.trim() });
      setTextContent('');
      await loadFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await uploadVoice(audioBlob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError('无法访问麦克风');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const uploadVoice = async (blob: Blob) => {
    if (!selectedFamilyId) return;
    setSending(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        await createFeed(selectedFamilyId, {
          type: 'VOICE',
          content: '(语音消息)',
          audioBase64: base64,
        });
        await loadFeeds();
        setSending(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (families.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">您还没有关联老人，请先添加老人</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">告诉小暖一件事</h1>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* Family selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">选择老人:</span>
        <div className="flex gap-2">
          {families.map((f) => (
            <Button
              key={f.id}
              variant={selectedFamilyId === f.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFamilyId(f.id)}
            >
              {f.elder.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Button
              variant={inputMode === 'text' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('text')}
            >
              文字
            </Button>
            <Button
              variant={inputMode === 'voice' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('voice')}
            >
              语音
            </Button>
          </div>

          {inputMode === 'text' ? (
            <div className="space-y-2">
              <Textarea
                placeholder="告诉小暖一件关于老人的事，比如明天要去医院复查..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={4}
              />
              <div className="flex justify-end">
                <Button onClick={handleSendText} disabled={!textContent.trim() || sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  发送
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6">
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`h-16 w-16 rounded-full flex items-center justify-center transition-colors ${
                  recording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {recording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
              <p className="text-sm text-muted-foreground">
                {recording ? '录音中，松开发送' : '按住录音，松开后自动发送'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">历史记录</h2>
        {feeds.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">还没有记录，快去告诉小暖一件事吧</p>
        ) : (
          <div className="space-y-3">
            {feeds.map((feed) => (
              <Card key={feed.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <Badge variant={feed.type === 'VOICE' ? 'secondary' : 'default'}>
                    {feed.type === 'VOICE' ? '语音' : '文字'}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{feed.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatTime(feed.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
