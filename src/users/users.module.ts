import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminInitService } from './admin-init.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AdminInitService],
  exports: [UsersService],
})
export class UsersModule {}
