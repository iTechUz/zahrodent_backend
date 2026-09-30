import { RefreshTokensCleanupService } from './refresh-tokens-cleanup.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';

describe('RefreshTokensCleanupService', () => {
  let repo: { deleteStale: jest.Mock };
  let service: RefreshTokensCleanupService;

  beforeEach(() => {
    repo = { deleteStale: jest.fn().mockResolvedValue(3) };
    service = new RefreshTokensCleanupService(
      repo as unknown as RefreshTokensRepository,
    );
  });

  it('7 kundan eski tokenlar o‘chiriladi', async () => {
    const now = new Date('2026-09-30T00:00:00Z');
    await expect(service.cleanup(now)).resolves.toBe(3);
    expect(repo.deleteStale).toHaveBeenCalledWith(
      new Date('2026-09-23T00:00:00Z'),
    );
  });

  it('xato otilmaydi — 0 qaytadi', async () => {
    repo.deleteStale.mockRejectedValue(new Error('db'));
    await expect(service.cleanup()).resolves.toBe(0);
  });

  it('test muhitida taymer ishga tushmaydi; destroy xavfsiz', () => {
    const spy = jest.spyOn(global, 'setInterval');
    service.onModuleInit();
    expect(spy).not.toHaveBeenCalled();
    service.onModuleDestroy();
    spy.mockRestore();
  });

  it('prod/dev da kunlik taymer (unref) qo‘yiladi va to‘xtatiladi', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.useFakeTimers();
    try {
      service.onModuleInit();
      jest.advanceTimersByTime(60_000);
      expect(repo.deleteStale).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(86_400_000);
      expect(repo.deleteStale).toHaveBeenCalledTimes(2);
      service.onModuleDestroy();
      jest.advanceTimersByTime(86_400_000 * 2);
      expect(repo.deleteStale).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
      process.env.NODE_ENV = prev;
    }
  });
});
