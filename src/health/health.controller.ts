import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { TelegramBotRegistry } from '../telegram/telegram-bot.registry';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramBotRegistry,
  ) {}

  @Get()
  @ApiOperation({ summary: 'API holati (simple)' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('deps')
  @ApiOperation({
    summary:
      'Bog’liqliklar holati (DB, Telegram bot, latency). DB down → 503; bot down → 200 + degraded',
  })
  async getDependencies(@Res({ passthrough: true }) res: Response) {
    const startedAt = Date.now();
    let dbOk = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }
    const telegram = await this.telegram.health();
    // Only the DB makes the API unusable → 503 (uptime monitors). A dead bot
    // is reported in the body but keeps 200, and never touches /health
    // (Docker HEALTHCHECK must not restart the container because of it).
    if (!dbOk) res.status(503);
    return {
      status: dbOk && telegram !== 'down' ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'down',
      telegram,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
  }
}
