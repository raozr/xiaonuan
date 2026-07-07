import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Service Layer', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockClear();
  });

  describe('api.ts - base HTTP client', () => {
    it('should inject Authorization header when token provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"data":"test"}'),
      });

      const { api } = await import('../services/api');
      await api('/api/test', { token: 'my-token' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });

    it('should not inject Authorization header when no token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      const { api } = await import('../services/api');
      await api('/api/test');

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers.Authorization).toBeUndefined();
    });

    it('should throw ApiError on non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      const { api, ApiError } = await import('../services/api');
      await expect(api('/api/test')).rejects.toThrow(ApiError);
    });

    it('should handle 204 No Content responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      });

      const { api } = await import('../services/api');
      const result = await api('/api/test');
      expect(result).toBeNull();
    });
  });

  describe('auth.ts - authentication service', () => {
    it('should call login endpoint with phone and password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          token: 'auth-token',
          user: { id: '1', name: 'Alice', phone: '1234567890' },
        })),
      });

      const { login } = await import('../services/auth');
      const result = await login({ phone: '1234567890', password: 'secret' });

      expect(result.token).toBe('auth-token');
      expect(result.user.name).toBe('Alice');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pc-auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ phone: '1234567890', password: 'secret' }),
        })
      );
    });

    it('should call register endpoint with name, phone, password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          token: 'new-token',
          user: { id: '2', name: 'Bob', phone: '9876543210' },
        })),
      });

      const { register } = await import('../services/auth');
      const result = await register({
        name: 'Bob',
        phone: '9876543210',
        password: 'password123',
      });

      expect(result.token).toBe('new-token');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pc-auth/register'),
        expect.any(Object)
      );
    });
  });

  describe('pairing.ts - pairing service', () => {
    it('should call bind endpoint and return pairing info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          token: 'bind-token',
          pairingId: 'pair-123',
          stewardName: 'Alice',
          companioneeName: 'Bob',
        })),
      });

      const { bindPairing } = await import('../services/pairing');
      const result = await bindPairing({ inviteCode: '123456', deviceId: 'device-1' });

      expect(result.token).toBe('bind-token');
      expect(result.pairingId).toBe('pair-123');
      expect(result.stewardName).toBe('Alice');
      expect(result.companioneeName).toBe('Bob');
    });

    it('should list pairings with token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([
          { id: 'pair-1', companioneeName: 'Bob', online: true, lastActive: '5 mins ago' },
          { id: 'pair-2', companioneeName: 'Carol', online: false },
        ])),
      });

      const { listPairings } = await import('../services/pairing');
      const result = await listPairings('test-token');

      expect(result).toHaveLength(2);
      expect(result[0].companioneeName).toBe('Bob');
    });

    it('should delete a pairing with token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, message: '配对已删除' })),
      });

      const { deletePairing } = await import('../services/pairing');
      const result = await deletePairing('test-token', 'pair-1');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pairings/pair-1'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('feed.ts - feed service', () => {
    it('should list feeds for a pairing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([
          { id: 'f1', title: 'Hello', content: 'Test message', acknowledged: false },
        ])),
      });

      const { listFeeds } = await import('../services/feed');
      const result = await listFeeds('test-token', 'pair-1');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Hello');
    });

    it('should create a new feed message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      const { createFeed } = await import('../services/feed');
      await createFeed('test-token', 'pair-1', 'New message');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pairings/pair-1/feeds'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'New message' }),
        })
      );
    });

    it('should acknowledge a feed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      const { acknowledgeFeed } = await import('../services/feed');
      await acknowledgeFeed('test-token', 'pair-1', 'feed-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pairings/pair-1/feeds/feed-1/acknowledge'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should delete a feed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      });

      const { deleteFeed } = await import('../services/feed');
      await deleteFeed('test-token', 'pair-1', 'feed-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pairings/pair-1/feeds/feed-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('voice-clone.ts - voice clone service', () => {
    it('should get voice clone status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          isCloned: false,
          samples: [
            { id: 1, label: 'Sample 1', phrase: 'Hello', status: 'completed' },
            { id: 2, label: 'Sample 2', phrase: 'World', status: 'pending' },
          ],
        })),
      });

      const { getVoiceCloneStatus } = await import('../services/voice-clone');
      const result = await getVoiceCloneStatus('test-token', 'pair-1');

      expect(result.isCloned).toBe(false);
      expect(result.samples).toHaveLength(2);
      expect(result.samples[0].status).toBe('completed');
    });

    it('should reset voice clone', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      });

      const { resetVoiceClone } = await import('../services/voice-clone');
      await resetVoiceClone('test-token', 'pair-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pairings/pair-1/voice-clone/reset'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('events.ts - events service', () => {
    it('should get daily summary', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          emotion: 'Happy',
          conversationTime: '30 mins',
          topicCount: 3,
          highlights: ['Walked', 'Chatted'],
          importantNote: 'Take medication',
        })),
      });

      const { getDailySummary } = await import('../services/events');
      const result = await getDailySummary('test-token', 'pair-1');

      expect(result.emotion).toBe('Happy');
      expect(result.highlights).toHaveLength(2);
    });

    it('should get events for a specific date', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([
          { id: 'e1', time: '10:00 AM', title: 'Event 1', variant: 'normal' },
        ])),
      });

      const { getEvents } = await import('../services/events');
      await getEvents('test-token', 'pair-1', '2024-01-15');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pairings/pair-1/events?date=2024-01-15'),
        expect.any(Object)
      );
    });

    it('should get today events', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([
          { id: 'e1', time: '08:00 AM', title: 'Morning', variant: 'action' },
        ])),
      });

      const { getTodayEvents } = await import('../services/events');
      const result = await getTodayEvents('test-token', 'pair-1');

      expect(result).toHaveLength(1);
      expect(result[0].variant).toBe('action');
    });
  });
});
