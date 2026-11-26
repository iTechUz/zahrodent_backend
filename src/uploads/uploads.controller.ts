import {
  Controller,
  ForbiddenException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { AuthUserView } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { CdnStorageService } from './cdn-storage.service';
import { AVATAR_MAX_BYTES, validateAvatarFile } from './image-validation';

const imageUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  // multer rejects bigger bodies itself (413) before they are buffered
  limits: { fileSize: AVATAR_MAX_BYTES + 1, files: 1 },
});

@ApiTags('uploads')
@ApiBearerAuth('JWT')
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(
    private readonly cdn: CdnStorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('avatar')
  @Roles('admin', 'receptionist')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(imageUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Avatar rasmini CDN ga yuklash (JPG/PNG/WEBP, ≤ 3 MB) → { url }',
  })
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    const { mime, ext } = validateAvatarFile(file);
    return { url: await this.cdn.putImage(file.buffer, mime, ext) };
  }

  @Post('avatar/me')
  @Roles('doctor')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(imageUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: "Shifokor o'z rasmini yuklaydi va profiliga biriktiradi → { url }",
  })
  async uploadOwnAvatar(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: AuthUserView,
  ) {
    if (!user.doctorId)
      throw new ForbiddenException(
        'Shifokor profili topilmadi — administratorga murojaat qiling',
      );
    const { mime, ext } = validateAvatarFile(file);
    const url = await this.cdn.putImage(file.buffer, mime, ext);
    await this.prisma.$transaction([
      this.prisma.doctor.update({
        where: { id: user.doctorId },
        data: { avatar: url },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { avatar: url },
      }),
    ]);
    return { url };
  }
}
