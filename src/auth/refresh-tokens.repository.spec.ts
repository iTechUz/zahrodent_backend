import {
  generateRefreshToken,
  hashRefreshToken,
  RefreshTokensRepository,
  revokeAllUserRefreshTokens,
} from './refresh-tokens.repository';
import { PrismaService } from '../database/prisma.service';

describe('refresh token helpers', () => {
  it('token — 48 bayt base64url (64 belgi), har safar boshqa', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(a).not.toBe(b);
  });

  it('hash — sha256 hex, deterministik', () => {
    expect(hashRefreshToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('revokeAllUserRefreshTokens — faqat faol tokenlar', async () => {
    const db = {
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 4 }) },
    };
    const at = new Date('2026-01-01T00:00:00Z');
    await expect(revokeAllUserRefreshTokens(db as any, 'u1', at)).resolves.toBe(
      4,
    );
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: at },
    });
  });
});

describe('RefreshTokensRepository', () => {
  let prisma: any;
  let tx: any;
  let repo: RefreshTokensRepository;
  const at = new Date('2026-01-01T00:00:00Z');

  beforeEach(() => {
    tx = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'new' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(tx)),
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
    };
    repo = new RefreshTokensRepository(prisma as PrismaService);
  });

  it('findByHash', async () => {
    await repo.findByHash('h');
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: 'h' },
    });
  });

  it('rotate — yangisi yaratiladi, eskisi faqat faol bo‘lsa bekor + replacedById', async () => {
    const next = {
      userId: 'u1',
      familyId: 'f',
      tokenHash: 'h2',
      expiresAt: at,
    };
    await expect(repo.rotate('old', next, at)).resolves.toEqual({
      id: 'new',
    });
    expect(tx.refreshToken.create).toHaveBeenCalledWith({ data: next });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'old', revokedAt: null },
      data: { revokedAt: at, replacedById: 'new' },
    });
  });

  it('rotate — eski token allaqachon bekor (parallel) → null (rollback)', async () => {
    tx.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repo.rotate(
        'old',
        { userId: 'u1', familyId: 'f', tokenHash: 'h2', expiresAt: at },
        at,
      ),
    ).resolves.toBeNull();
  });

  it('rotate — boshqa DB xatolari yuqoriga chiqadi', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db down'));
    await expect(
      repo.rotate(
        'old',
        { userId: 'u1', familyId: 'f', tokenHash: 'h2', expiresAt: at },
        at,
      ),
    ).rejects.toThrow('db down');
  });

  it('revokeFamily / revokeByHash — faqat faol tokenlar', async () => {
    await expect(repo.revokeFamily('f', at)).resolves.toBe(2);
    expect(prisma.refreshToken.updateMany).toHaveBeenLastCalledWith({
      where: { familyId: 'f', revokedAt: null },
      data: { revokedAt: at },
    });
    await repo.revokeByHash('h', at);
    expect(prisma.refreshToken.updateMany).toHaveBeenLastCalledWith({
      where: { tokenHash: 'h', revokedAt: null },
      data: { revokedAt: at },
    });
    await repo.revokeAllForUser('u1', at);
    expect(prisma.refreshToken.updateMany).toHaveBeenLastCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: at },
    });
  });

  it('deleteStale — eskirgan yoki bekor qilinganlar', async () => {
    await expect(repo.deleteStale(at)).resolves.toBe(5);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ expiresAt: { lt: at } }, { revokedAt: { lt: at } }],
      },
    });
  });
});
