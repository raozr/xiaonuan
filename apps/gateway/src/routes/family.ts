import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@xiaonuan/prisma';

const createFamilySchema = z.object({
  elderName: z.string().min(1),
  elderAge: z.number().min(50).max(120).optional(),
  elderDialect: z.string().optional(),
});

function generateInviteCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function familyRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const parsed = createFamilySchema.safeParse(body);

    if (!parsed.success) {
      return reply.status(400).send({ success: false, message: '参数错误', errors: parsed.error.errors });
    }

    const { elderName, elderAge, elderDialect } = parsed.data;

    const family = await prisma.family.create({
      data: {
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        elder: {
          create: {
            name: elderName,
            age: elderAge,
            dialect: elderDialect,
          },
        },
      },
      include: {
        elder: true,
      },
    });

    return reply.status(201).send({
      id: family.id,
      inviteCode: family.inviteCode,
      inviteCodeExpiresAt: family.inviteCodeExpiresAt,
      elder: family.elder,
    });
  });

  app.post('/invite-code', async (request, reply) => {
    const body = request.body as { familyId?: string };

    if (!body.familyId) {
      return reply.status(400).send({ success: false, message: 'familyId 必填' });
    }

    const family = await prisma.family.update({
      where: { id: body.familyId },
      data: {
        inviteCode: generateInviteCode(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return reply.send({
      inviteCode: family.inviteCode,
      inviteCodeExpiresAt: family.inviteCodeExpiresAt,
    });
  });
}
