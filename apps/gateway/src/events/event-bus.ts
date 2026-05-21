import type { NewEvent, EventOptions } from './event-types.js';
import { prisma } from '@xiaonuan/prisma';

const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_THRESHOLD = 10;

let buffer: NewEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    void flushEvents();
  }, FLUSH_INTERVAL_MS);
  timer.unref();
}

function resetTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function toCreateData(e: NewEvent) {
  return {
    pairingId: e.pairingId,
    actorId: e.actorId ?? null,
    type: e.type,
    content: e.content,
    tags: e.tags ?? [],
    ...(e.payload ? { payload: e.payload } : {}),
    eventTime: e.eventTime ?? new Date(),
  };
}

export async function emitEvent(event: NewEvent, options?: EventOptions) {
  if (options?.immediate) {
    await prisma.eventStream.create({ data: toCreateData(event) });
    return;
  }

  buffer.push(event);
  startTimer();

  if (buffer.length >= FLUSH_THRESHOLD) {
    await flushEvents();
  }
}

export async function flushEvents() {
  if (buffer.length === 0 || flushing) return;

  flushing = true;
  const events = buffer.splice(0, buffer.length);
  resetTimer();

  try {
    await prisma.eventStream.createMany({
      data: events.map(toCreateData),
    });
  } catch (err) {
    console.error('[EventBus] flush 失败，数据已丢失:', err);
  } finally {
    flushing = false;
  }
}

export async function shutdownEventBus() {
  resetTimer();
  await flushEvents();
}

process.on('SIGTERM', () => {
  void shutdownEventBus();
});
process.on('SIGINT', () => {
  void shutdownEventBus();
});
