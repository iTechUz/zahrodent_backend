import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@/prisma.service'

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async executeTransaction<T>(
    callback: (prisma: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(callback)
  }
}