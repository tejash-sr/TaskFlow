/**
 * Unit tests for Socket.io authentication and room management.
 * Covers Phase 7 requirement: socket auth rejects unauthenticated connections.
 */
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { initSocketServer } from '@/socket';
import { signAccessToken } from '@/utils/tokenUtils';

let httpServer: http.Server;
let socketServer: SocketServer;
let port: number;

beforeAll((done) => {
  httpServer = http.createServer();
  socketServer = initSocketServer(httpServer);
  httpServer.listen(0, () => {
    const addr = httpServer.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
    done();
  });
});

afterAll((done) => {
  socketServer.close();
  httpServer.close(done);
});

function connectClient(auth?: Record<string, string>): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    autoConnect: false,
    transports: ['websocket'],
    auth,
  });
}

describe('Socket.io authentication', () => {
  it('rejects connection without a token', (done) => {
    const client = connectClient();
    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/authentication required/i);
      client.disconnect();
      done();
    });
    client.connect();
  });

  it('rejects connection with an invalid token', (done) => {
    const client = connectClient({ token: 'invalid.jwt.token' });
    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/invalid|expired/i);
      client.disconnect();
      done();
    });
    client.connect();
  });

  it('accepts connection with a valid token', (done) => {
    const token = signAccessToken({ userId: '507f1f77bcf86cd799439011', role: 'user' });
    const client = connectClient({ token });
    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.disconnect();
      done();
    });
    client.on('connect_error', (err) => {
      client.disconnect();
      done(err);
    });
    client.connect();
  });
});
