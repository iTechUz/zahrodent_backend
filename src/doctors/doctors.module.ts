import { Module } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { DoctorsRepository } from './doctors.repository';

import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [DoctorsController],
  providers: [DoctorsService, DoctorsRepository],
  exports: [DoctorsService, DoctorsRepository],
})
export class DoctorsModule {}
