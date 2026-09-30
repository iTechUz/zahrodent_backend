import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { AuthService, AuthUserView } from '../auth/auth.service';

/** Roles that receive `newLead` (same roles that can read /leads). */
const LEAD_ROOMS = ['role:admin', 'role:receptionist'];

/** Token from handshake `auth.token`, `Authorization: Bearer …` or `?token=`. */
export function extractSocketToken(client: Socket): string | null {
  const hs = client.handshake;
  const fromAuth = (hs?.auth as { token?: unknown } | undefined)?.token;
  if (typeof fromAuth === 'string' && fromAuth.trim()) {
    return fromAuth.replace(/^Bearer\s+/i, '').trim();
  }
  const header = hs?.headers?.authorization;
  if (typeof header === 'string' && /^Bearer\s+/i.test(header)) {
    return header.replace(/^Bearer\s+/i, '').trim() || null;
  }
  const q = hs?.query?.token;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return null;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : true,
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('NotificationsGateway');

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway Initialized');
  }

  /** Requires a valid JWT of an existing user; otherwise disconnects. */
  async handleConnection(client: Socket) {
    const token = extractSocketToken(client);
    let user: AuthUserView | null = null;
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<object>(token);
        user = await this.authService.resolveTokenUser(payload);
      } catch {
        user = null;
      }
    }
    if (!user) {
      this.logger.warn(`Unauthorized socket rejected: ${client.id}`);
      client.emit('unauthorized', { message: 'Avtorizatsiya talab qilinadi' });
      client.disconnect(true);
      return;
    }
    client.data.user = user;
    await client.join(`role:${user.role}`);
    this.logger.log(`Client connected: ${client.id} (${user.role})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  sendNewLead(lead: unknown) {
    this.server.to(LEAD_ROOMS).emit('newLead', lead);
  }
}
