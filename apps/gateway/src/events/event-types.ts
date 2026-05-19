import type { EventType, Prisma } from '@xiaonuan/prisma';

export interface NewEvent {
  pairingId: string;
  type: EventType;
  content: string;
  actorId?: string;
  tags?: string[];
  payload?: Prisma.InputJsonValue;
  eventTime?: Date;
}

export interface EventOptions {
  immediate?: boolean;
}
