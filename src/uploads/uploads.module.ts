import { Module } from '@nestjs/common';
import { CdnStorageService } from './cdn-storage.service';
import { UploadsController } from './uploads.controller';

@Module({
  controllers: [UploadsController],
  providers: [CdnStorageService],
  exports: [CdnStorageService],
})
export class UploadsModule {}
