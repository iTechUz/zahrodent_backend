import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from '@/prisma.service'; // ✅ If using path aliases

@Module({
  imports: [],
  controllers: [NotificationsController],
  providers: [NotificationsService, PrismaService],
  exports: [],
})
export class NotificationsModule {}