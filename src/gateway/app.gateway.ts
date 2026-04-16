import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets'
import { UseGuards } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { GatewayService } from './gateway.service'
import { WsJwtGuard } from './ws-jwt.guard'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '@/prisma.service'

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private connectedClients = new Map<string, { userId: string; rooms: string[] }>()

  constructor(
    private readonly gatewayService: GatewayService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.gatewayService.setServer(server)
    console.log('WebSocket Gateway ishga tushdi (/ws)')
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client)
      if (!token) throw new WsException('Token yo\'q')

      const payload = this.jwtService.verify<{ sub: string; role: string }>(token)
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          phone: true,
          currentBranchId: true,
          roles: { select: { id: true, name: true } },
          branches: { select: { id: true } },
        },
      })

      if (!user) {
        client.emit('error', { message: 'Foydalanuvchi topilmadi' })
        client.disconnect()
        return
      }

      ;(client as any).user = user

      // Foydalanuvchini o'z xonasiga qo'shish
      const userRoom = `user:${user.id}`
      client.join(userRoom)
      const rooms = [userRoom]

      // Shifokor bo'lsa o'z doctor xonasiga qo'shish
      if (user.roles?.name === 'DOCTOR') {
        const doctorRoom = `doctor:${user.id}`
        client.join(doctorRoom)
        rooms.push(doctorRoom)
      }

      // Barcha biriktirilgan branch xonalariga qo'shish
      for (const branch of user.branches) {
        const branchRoom = `branch:${branch.id}`
        client.join(branchRoom)
        rooms.push(branchRoom)
      }

      // Joriy branch xonasiga ham qo'shish
      if (user.currentBranchId) {
        const currentRoom = `branch:${user.currentBranchId}`
        if (!rooms.includes(currentRoom)) {
          client.join(currentRoom)
          rooms.push(currentRoom)
        }
      }

      this.connectedClients.set(client.id, { userId: user.id, rooms })

      client.emit('connected', {
        message: 'WebSocket ga ulandi',
        userId: user.id,
        role: user.roles?.name,
        rooms,
      })

      console.log(`[WS] Ulandi: ${user.phone} (${user.roles?.name}) | socket: ${client.id}`)
    } catch (err) {
      client.emit('error', { message: err.message || 'Autentifikatsiya xatosi' })
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    const info = this.connectedClients.get(client.id)
    if (info) {
      console.log(`[WS] Uzildi: userId=${info.userId} | socket: ${client.id}`)
      this.connectedClients.delete(client.id)
    }
  }

  // ─── Xonaga qo'shilish/chiqish ─────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join:room')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }) {
    client.join(data.room)
    client.emit('joined', { room: data.room })
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave:room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }) {
    client.leave(data.room)
    client.emit('left', { room: data.room })
  }

  // ─── Ping / Pong ────────────────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { time: new Date().toISOString() })
  }

  // ─── Online foydalanuvchilar ─────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('get:online')
  handleGetOnline(@ConnectedSocket() client: Socket) {
    client.emit('online:list', {
      count: this.connectedClients.size,
      users: Array.from(this.connectedClients.values()).map((c) => c.userId),
    })
  }

  // ─── Ichki helper ────────────────────────────────────────────

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth?.token || client.handshake.headers?.authorization
    if (!auth) return null
    const str = auth as string
    return str.startsWith('Bearer ') ? str.slice(7) : str
  }
}
