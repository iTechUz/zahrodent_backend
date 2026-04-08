import { Module } from '@nestjs/common'
import { FileUploadService } from './file-upload.service'
import { FileUploadController } from './file-upload.controller'
import { MinioClientModule } from 'src/api/minio/minio-client.module'
import { PrismaModule } from 'src/prisma.module'

@Module({
	imports: [MinioClientModule, PrismaModule],
	controllers: [FileUploadController],
	providers: [FileUploadService],
	exports: [FileUploadService]
})
export class FileUploadModule {}
