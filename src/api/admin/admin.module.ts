import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { PrismaService } from '@/prisma.service'; // ✅ If using path aliases
import { HashingService } from "src/utils/hashing/hashing.service";


@Module({
    controllers: [AdminController],
    providers: [AdminService, HashingService, PrismaService],
    exports: [AdminService]
})
export class AdminModule {}