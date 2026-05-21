import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Mock Prisma before importing the module under test
const mockPrisma = vi.hoisted(() => ({
  participant: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@xiaonuan/prisma', () => ({
  prisma: mockPrisma,
}));

import { verifyCompanioneeAuth, authenticate } from './auth.js';

describe('verifyCompanioneeAuth', () => {
  const mockRequest = (user: Partial<FastifyRequest['user']> = {}) =>
    ({ user }) as FastifyRequest;

  const mockReply = () =>
    ({
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      sent: false,
    } as unknown as FastifyReply);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip verification for non-COMPANIONEE role', async () => {
    const request = mockRequest({ role: 'STEWARD', pairingId: 'p1' });
    const reply = mockReply();

    await verifyCompanioneeAuth(request, reply);

    expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
  });

  it('should skip verification when no pairingId', async () => {
    const request = mockRequest({ role: 'COMPANIONEE' });
    const reply = mockReply();

    await verifyCompanioneeAuth(request, reply);

    expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
  });

  it('should return 401 when participant not found', async () => {
    mockPrisma.participant.findFirst.mockResolvedValueOnce(null);

    const request = mockRequest({ role: 'COMPANIONEE', pairingId: 'p1' });
    const reply = mockReply();

    await verifyCompanioneeAuth(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      message: '被陪伴者信息不存在',
    });
  });

  it('should return 401 when deviceId does not match', async () => {
    mockPrisma.participant.findFirst.mockResolvedValueOnce({
      deviceId: 'device-ABC',
      openid: null,
    });

    const request = mockRequest({ role: 'COMPANIONEE', pairingId: 'p1', deviceId: 'device-XYZ' });
    const reply = mockReply();

    await verifyCompanioneeAuth(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      message: '设备已解绑',
    });
  });

  it('should return 401 when openid does not match', async () => {
    mockPrisma.participant.findFirst.mockResolvedValueOnce({
      deviceId: null,
      openid: 'open-ABC',
    });

    const request = mockRequest({ role: 'COMPANIONEE', pairingId: 'p1', openid: 'open-XYZ' });
    const reply = mockReply();

    await verifyCompanioneeAuth(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      message: '认证信息无效',
    });
  });

  it('should pass when participant matches', async () => {
    mockPrisma.participant.findFirst.mockResolvedValueOnce({
      deviceId: 'device-ABC',
      openid: 'open-ABC',
    });

    const request = mockRequest({ role: 'COMPANIONEE', pairingId: 'p1', deviceId: 'device-ABC', openid: 'open-ABC' });
    const reply = mockReply();

    await verifyCompanioneeAuth(request, reply);

    expect(mockPrisma.participant.findFirst).toHaveBeenCalledWith({
      where: { pairingId: 'p1', role: 'COMPANIONEE', isAI: false },
      select: { deviceId: true, openid: true },
    });
    expect(reply.status).not.toHaveBeenCalled();
  });
});

describe('authenticate', () => {
  let capturedHook: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

  const mockApp = (overrides = {}) =>
    ({
      addHook: vi.fn((_name, hook) => {
        capturedHook = hook;
      }),
      ...overrides,
    }) as unknown as FastifyInstance;

  const mockReply = () =>
    ({
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      sent: false,
    } as unknown as FastifyReply);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no authorization header', async () => {
    await authenticate(mockApp());

    const request = { headers: {} } as FastifyRequest;
    const reply = mockReply();

    await capturedHook(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      message: '未提供认证令牌',
    });
  });

  it('should skip verifyCompanioneeAuth for STEWARD role', async () => {
    await authenticate(mockApp());

    const request = {
      headers: { authorization: 'Bearer fake-token' },
      jwtDecode: vi.fn().mockResolvedValue({ role: 'STEWARD', pairingId: 'p1' }),
    } as unknown as FastifyRequest;
    const reply = mockReply();

    await capturedHook(request, reply);

    expect(mockPrisma.participant.findFirst).not.toHaveBeenCalled();
    expect(request.user).toEqual({ role: 'STEWARD', pairingId: 'p1' });
  });
});
