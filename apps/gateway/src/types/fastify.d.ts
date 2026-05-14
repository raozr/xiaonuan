import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      userId?: string;
      role: string;
      phone?: string;
      familyId?: string;
      deviceId?: string;
      openid?: string;
    };
  }
}
