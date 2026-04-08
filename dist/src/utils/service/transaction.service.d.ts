import { PrismaClient } from "@prisma/client";
import { PrismaService } from '@/prisma.service';
export declare class TransactionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    executeTransaction<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T>;
}
