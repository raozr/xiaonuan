'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchFeeds, createFeed, deleteFeed, type Feed } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Send, Loader2, Trash2 } from 'lucide-react';

type InputMode = 'text' | 'voice';

interface PairingFeedPanelProps {
  pairingId: string;
}

export function PairingFeedPanel({ pairingId }: PairingFeedPanelProps) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldCancelRef = useRef(false);

  const loadFeeds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFeeds(pairingId);
      setFeeds(res.data);
    } catch {
      setFeeds([]);
    } finally {
      setLoading(false);
    }
  }, [pairingId]);

  const handleDelete = async (feedId: string) => {
    try {
      await deleteFeed(pairingId, feedId);
      setFeeds((prev) => prev.filter((f) => f.id !== feedId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const handleSendText = async () => {
    if (!textContent.trim()) return;
    setSending(true);
    try {
      await createFeed(pairingId, { type: 'TEXT', content: textContent.trim() });
      setTextContent('');
      await loadFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    shouldCancelRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (shouldCancelRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

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
      setRecording(false);
    }
  };

  const stopRecording = () => {
    shouldCancelRef.current = true;
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const uploadVoice = async (blob: Blob) => {
    setSending(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        await createFeed(pairingId, {
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
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-2">你可以告诉小暖这些事：</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>• 身体：她最近睡眠不好，夜里容易醒</span>
            <span>• 爱好：喜欢听京剧，尤其是包公铡美案</span>
            <span>• 习惯：每天早上六点起床锻炼</span>
            <span>• 回避：别聊她老伴的事</span>
            <span>• 称呼：叫她王阿姨就好</span>
            <span>• 语言：她会说四川话</span>
          </div>
        </CardContent>
      </Card>

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
                placeholder={
                  '告诉小暖一件关于对方的事...\n\n可以告诉我：对方的身体状况、兴趣爱好、生活习惯、近期发生的事、需要回避的话题、称呼偏好等。小暖会自动从这些信息中了解TA，让对话更贴心。'
                }
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
                {recording ? '录音中，松开发送' : '按住录音，松开后自动发送'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-base font-semibold">历史记录</h3>
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
                  <button
                    onClick={() => {
                      if (confirm('确定删除这条记录吗？')) {
                        handleDelete(feed.id);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
