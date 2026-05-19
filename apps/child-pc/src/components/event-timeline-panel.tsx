'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchEvents, type Event, type EventType } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock } from 'lucide-react';

const EVENT_TYPE_LABELS: Record<EventType, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  feed_message: { label: '留言', variant: 'default' },
  conversation_turn: { label: '对话', variant: 'default' },
  conversation_extracted: { label: '摘要', variant: 'secondary' },
  info_extracted: { label: '信息', variant: 'secondary' },
  mood_change: { label: '情绪', variant: 'outline' },
  relationship_shift: { label: '关系', variant: 'outline' },
  proactive_outreach: { label: '关怀', variant: 'outline' },
  persona_updated: { label: '人格', variant: 'outline' },
};

const PAGE_LIMIT = 30;

interface EventTimelinePanelProps {
  pairingId: string;
}

export function EventTimelinePanel({ pairingId }: EventTimelinePanelProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadEvents = useCallback(
    async (reset = false) => {
      const targetPage = reset ? 1 : page;
      if (reset) {
        setLoading(true);
        setEvents([]);
      } else {
        setLoadingMore(true);
      }
      try {
        const res = await fetchEvents(pairingId, {
          type: filterType === 'all' ? undefined : filterType,
          page: targetPage,
          limit: PAGE_LIMIT,
        });
        setEvents((prev) => (reset ? res.data : [...prev, ...res.data]));
        setTotal(res.pagination?.total ?? 0);
        setPage(targetPage);
      } catch {
        setError('加载失败');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [pairingId, filterType, page]
  );

  useEffect(() => {
    loadEvents(true);
  }, [loadEvents]);

  const handleTypeChange = (value: string | null) => {
    setFilterType((value as EventType | 'all') ?? 'all');
    setPage(1);
  };

  const handleLoadMore = () => {
    setPage((p) => p + 1);
    loadEvents(false);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasMore = events.length < total;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <Select value={filterType} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="筛选类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {EVENT_TYPE_LABELS[type].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">共 {total} 条事件</span>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Clock className="h-10 w-10 mb-3" />
            <p>还没有事件记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const meta = EVENT_TYPE_LABELS[event.type];
            return (
              <Card key={event.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{event.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatTime(event.eventTime)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {loadingMore ? '加载中...' : '加载更多'}
          </Button>
        </div>
      )}
    </div>
  );
}
