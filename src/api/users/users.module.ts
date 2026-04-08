import { Module } from '@nestjs/common'

import { PrismaService } from '../../prisma.service'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { FileUploadModule } from '../file-upload/file-upload.module'
import { HashingService } from 'src/utils/hashing'

@Module({
	imports: [FileUploadModule],
	controllers: [UsersController],
	providers: [UsersService, PrismaService, HashingService],
	exports: [UsersService]
})
export class UsersModule {}
