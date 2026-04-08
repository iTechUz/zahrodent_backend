import { Module } from "@nestjs/common";
// import { Role } from "@prisma/client";
import { RolesController } from "./roles.controller";
import { PrismaService } from '@/prisma.service'; // ✅ If using path aliases
import { RolesService } from "./roles.service";

@Module({
  imports: [],
  controllers: [RolesController],
  providers: [RolesService, PrismaService],
  exports: [],
})
export class RolesModule {}