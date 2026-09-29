import { HealthController } from './health.controller';
import { PrismaService } from '../database/prisma.service';

describe('HealthController', () => {
  let prisma: { $queryRaw: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    controller = new HealthController(prisma as unknown as PrismaService);
  });

  it('getHealth — ok', () => {
    const out = controller.getHealth();
    expect(out.status).toBe('ok');
    expect(new Date(out.timestamp).toISOString()).toBe(out.timestamp);
  });

  it('getDependencies — DB ishlasa ok', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const out = await controller.getDependencies();
    expect(out).toMatchObject({ status: 'ok', db: 'ok' });
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('getDependencies — DB xato bo‘lsa degraded/down (xato tashlamaydi)', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('conn refused'));
    await expect(controller.getDependencies()).resolves.toMatchObject({
      status: 'degraded',
      db: 'down',
    });
  });
});
