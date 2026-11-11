import { HealthController } from './health.controller';
import { PrismaService } from '../database/prisma.service';
import { TelegramBotRegistry } from '../telegram/telegram-bot.registry';

describe('HealthController', () => {
  let prisma: { $queryRaw: jest.Mock };
  let tg: { health: jest.Mock; groupHealth: jest.Mock };
  let res: { status: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    tg = {
      health: jest.fn().mockResolvedValue('disabled'),
      groupHealth: jest.fn().mockReturnValue('ok'),
    };
    res = { status: jest.fn() };
    controller = new HealthController(
      prisma as unknown as PrismaService,
      tg as unknown as TelegramBotRegistry,
    );
  });
  const deps = () => controller.getDependencies(res as any);

  it('getHealth — ok', () => {
    const out = controller.getHealth();
    expect(out.status).toBe('ok');
    expect(new Date(out.timestamp).toISOString()).toBe(out.timestamp);
  });

  it('getDependencies — DB ishlasa ok, 503 emas', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const out = await deps();
    expect(out).toMatchObject({ status: 'ok', db: 'ok', telegram: 'disabled' });
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('getDependencies — DB xato → 503, degraded/down (xato tashlamaydi)', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('conn refused'));
    await expect(deps()).resolves.toMatchObject({
      status: 'degraded',
      db: 'down',
      telegram: 'disabled',
    });
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('bot down — degraded, lekin 200 (503 emas)', async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    tg.health.mockResolvedValue('down');
    await expect(deps()).resolves.toMatchObject({
      status: 'degraded',
      db: 'ok',
      telegram: 'down',
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('bot ok — status ok', async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    tg.health.mockResolvedValue('ok');
    await expect(deps()).resolves.toMatchObject({
      status: 'ok',
      telegram: 'ok',
    });
  });

  it('/health bot va DB ga bog‘liq emas', () => {
    expect(controller.getHealth().status).toBe('ok');
    expect(tg.health).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('staff guruhi ketma-ket muvaffaqiyatsiz — degraded + telegramGroup=failing (200)', async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    tg.health.mockResolvedValue('ok');
    tg.groupHealth.mockReturnValue('failing');
    await expect(deps()).resolves.toMatchObject({
      status: 'degraded',
      telegram: 'ok',
      telegramGroup: 'failing',
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('guruh ok — telegramGroup=ok va status ok', async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    tg.health.mockResolvedValue('ok');
    await expect(deps()).resolves.toMatchObject({
      status: 'ok',
      telegramGroup: 'ok',
    });
  });
});
