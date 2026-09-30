import { Injectable } from '@nestjs/common';
import { Prisma, RefreshToken } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/** Random bytes of a refresh token (base64url → 64 chars). */
export const REFRESH_TOKEN_BYTES = 48;

export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/** Only this hash is stored — a DB leak doesn't leak usable tokens. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Revokes every active refresh token of a user (password/role change,
 * forced logout). Usable inside a transaction.
 */
export async function revokeAllUserRefreshTokens(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<number> {
  const r = await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: at },
  });
  return r.count;
}

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  create(
    data: Prisma.RefreshTokenUncheckedCreateInput,
    db: Db = this.prisma,
  ): Promise<RefreshToken> {
    return db.refreshToken.create({ data });
  }

  /**
   * Rotation: inserts the successor and revokes `oldId` in one transaction.
   * Returns `null` when `oldId` was already revoked meanwhile (concurrent
   * reuse) — nothing is written in that case.
   */
  async rotate(
    oldId: string,
    next: Prisma.RefreshTokenUncheckedCreateInput,
    at: Date = new Date(),
  ): Promise<RefreshToken | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.refreshToken.create({ data: next });
        const r = await tx.refreshToken.updateMany({
          where: { id: oldId, revokedAt: null },
          data: { revokedAt: at, replacedById: created.id },
        });
        if (r.count !== 1) throw new ConcurrentRotationError();
        return created;
      });
    } catch (e) {
      if (e instanceof ConcurrentRotationError) return null;
      throw e;
    }
  }

  async revokeFamily(familyId: string, at: Date = new Date()) {
    const r = await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
    return r.count;
  }

  async revokeByHash(tokenHash: string, at: Date = new Date()) {
    const r = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: at },
    });
    return r.count;
  }

  revokeAllForUser(userId: string, at: Date = new Date()) {
    return revokeAllUserRefreshTokens(this.prisma, userId, at);
  }

  /** Deletes tokens that expired or were revoked before `before`. */
  async deleteStale(before: Date): Promise<number> {
    const r = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: before } }, { revokedAt: { lt: before } }],
      },
    });
    return r.count;
  }
}

class ConcurrentRotationError extends Error {}
