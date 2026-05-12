import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId?: string;
      role: string;
      phone?: string;
      familyId?: string;
      deviceId?: string;
    };
  }
}
