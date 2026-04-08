import { Module } from "@nestjs/common";
import { BranchController } from "./branch.controller";
import { BranchService } from "./branch.service";
import { PrismaService } from '@/prisma.service'; // ✅ If using path aliases

@Module({
  imports: [],
  controllers: [BranchController],
  providers: [BranchService, PrismaService],
  exports: [],
})
export class BranchModule {}