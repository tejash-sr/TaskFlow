import express, { Application, Request, Response, NextFunction, RequestHandler } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import ejsLayouts from 'express-ejs-layouts';
import swaggerUi from 'swagger-ui-express';
import { env } from '@/config/env';
import { errorHandler } from '@/middleware/error.middleware';
import { AppError } from '@/utils/AppError';
import { swaggerSpec } from '@/config/swagger';
import { requestId } from '@/middleware/requestId.middleware';
import healthRouter from '@/routes/health.routes';
import authRouter from '@/routes/auth.routes';
import taskRouter from '@/routes/task.routes';
import projectRouter from '@/routes/project.routes';
import digestRouter from '@/routes/digest.routes';
import webRouter from '@/routes/web.routes';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many auth requests, please try again later' },
});

export function createApp(testMiddleware?: RequestHandler[]): Application {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(process.cwd(), 'src', 'views'));
  app.set('layout', 'layout');
  app.use(ejsLayouts);

  app.use(express.static(path.join(process.cwd(), 'public')));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(requestId);
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (!env.isTest) {
    app.use('/api/', apiLimiter);
    app.use('/api/auth/', authLimiter);
  }

  if (testMiddleware) {
    testMiddleware.forEach((mw) => app.use(mw));
  }

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', taskRouter);
  app.use('/api/projects', projectRouter);
  app.use('/api/digest', digestRouter);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

  app.use('/', webRouter);

  return app;
}

export function attachErrorHandlers(app: Application): void {
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError('Route not found', 404));
  });

  app.use(errorHandler);
}

export function createAppWithHandlers(testMiddleware?: RequestHandler[]): Application {
  const app = createApp(testMiddleware);
  attachErrorHandlers(app);
  return app;
}

export async function createAppWithGraphQL(testMiddleware?: RequestHandler[]): Promise<Application> {
  const app = createApp(testMiddleware);
  const { applyGraphQL } = await import('@/graphql/index');
  await applyGraphQL(app);
  attachErrorHandlers(app);
  return app;
}

