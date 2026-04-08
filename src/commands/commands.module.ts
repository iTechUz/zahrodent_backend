// src/commands/commands.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Module({
//   imports: [CommandModule],
  providers: [ PrismaService],
})
export class CommandsModule {}
