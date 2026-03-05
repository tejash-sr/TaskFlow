declare module '@apollo/server/express4' {
  import { ApolloServer, BaseContext } from '@apollo/server';
  import { RequestHandler } from 'express';

  interface ExpressMiddlewareOptions<TContext extends BaseContext> {
    context?: (args: { req: import('express').Request; res: import('express').Response }) => Promise<TContext>;
  }

  function expressMiddleware<TContext extends BaseContext>(
    server: ApolloServer<TContext>,
    options?: ExpressMiddlewareOptions<TContext>,
  ): RequestHandler;

  export { expressMiddleware };
}
