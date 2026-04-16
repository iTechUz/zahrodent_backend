import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { WsException } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { PrismaService } from '@/prisma.service'

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient()
    const token = this.extractToken(client)

    if (!token) throw new WsException('Token topilmadi')

    try {
      const payload = this.jwtService.verify<{ sub: string; role: string }>(token)

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          phone: true,
          currentBranchId: true,
          roles: { select: { id: true, name: true } },
        },
      })

      if (!user) throw new WsException('Foydalanuvchi topilmadi')

      ;(client as any).user = { ...user, roleName: user.roles?.name, roleId: user.roles?.id }
      return true
    } catch {
      throw new WsException('Token noto\'g\'ri yoki muddati o\'tgan')
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth?.token || client.handshake.headers?.authorization
    if (!auth) return null
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7)
    return auth as string
  }
}
