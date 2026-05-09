import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      role: string;
      phone?: string;
      familyId?: string;
      deviceId?: string;
    };
  }
}
