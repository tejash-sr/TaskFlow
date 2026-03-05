import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '@/utils/tokenUtils';

let io: SocketServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });


  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth as Record<string, string>)?.token ??
      (socket.handshake.query?.token as string | undefined);

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId } = socket.data as { userId: string; role: string };


    socket.on('join:project', (projectId: string) => {
      if (typeof projectId === 'string' && projectId.length > 0) {
        void socket.join(`project:${projectId}`);
      }
    });


    socket.on('leave:project', (projectId: string) => {
      void socket.leave(`project:${projectId}`);
    });

    socket.on('disconnect', () => {
      void userId;
    });
  });

  return io;
}


export function getSocketServer(): SocketServer | null {
  return io;
}


export type TaskEvent =
  | { event: 'task:created'; payload: { task: unknown } }
  | { event: 'task:updated'; payload: { task: unknown } }
  | { event: 'task:assigned'; payload: { task: unknown; assigneeId: string } }
  | { event: 'task:commented'; payload: { taskId: string; comment: unknown } }
  | { event: 'task:status-changed'; payload: { taskId: string; oldStatus: string; newStatus: string } };

export function emitToProject(projectId: string, eventData: TaskEvent): void {
  if (!io) return;
  const room = `project:${projectId}`;
  io.to(room).emit(eventData.event, eventData.payload);
}
