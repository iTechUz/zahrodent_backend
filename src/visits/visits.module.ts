import { Module } from '@nestjs/common';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { VisitsRepository } from './visits.repository';

@Module({
  controllers: [VisitsController],
  providers: [VisitsService, VisitsRepository],
  exports: [VisitsService, VisitsRepository],
})
export class VisitsModule {}
