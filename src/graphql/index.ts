import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { Application, Request } from 'express';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { verifyAccessToken } from '@/utils/tokenUtils';

interface GqlContext {
  userId?: string;
  userRole?: string;
}

export async function applyGraphQL(app: Application): Promise<void> {
  const server = new ApolloServer<GqlContext>({ typeDefs, resolvers });
  await server.start();

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }: { req: Request }): Promise<GqlContext> => {
        const header = req.headers.authorization ?? '';
        if (header.startsWith('Bearer ')) {
          const token = header.split(' ')[1];
          try {
            const payload = verifyAccessToken(token);
            return { userId: payload.userId, userRole: payload.role };
          } catch {
          }
        }
        return {};
      },
    }),
  );
}
