import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Real-time delivery channel for notifications. Clients connect to the
 * `/notifications` namespace with their JWT (via handshake auth) and are placed
 * into a private room keyed by their user id, so the service can push events to
 * exactly one user with `emitToUser`.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private room(userId: string) {
    return `user:${userId}`;
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization || '').replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET') || 'development-secret-key',
      });
      const userId = payload?.sub;
      if (!userId) {
        client.disconnect();
        return;
      }
      client.data.userId = userId;
      client.join(this.room(userId));
    } catch {
      client.disconnect();
    }
  }

  /** Push an event to a single user (all of their open tabs). */
  emitToUser(userId: string, event: string, payload: any) {
    if (!this.server) return;
    this.server.to(this.room(userId)).emit(event, payload);
  }
}
