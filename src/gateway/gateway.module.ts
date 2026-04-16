import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PrismaService } from '@/prisma.service'
import { AppGateway } from './app.gateway'
import { GatewayService } from './gateway.service'
import { WsJwtGuard } from './ws-jwt.guard'

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get('JWT_SECRET') }),
    }),
  ],
  providers: [AppGateway, GatewayService, WsJwtGuard, PrismaService],
  exports: [GatewayService],
})
export class GatewayModule {}
