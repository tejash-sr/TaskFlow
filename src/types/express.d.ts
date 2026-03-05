import { RequestHandler } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    userRole?: string;
    requestId?: string;
  }
}

export type AsyncRequestHandler = RequestHandler;
