import { AppMimeType, BufferedFile } from 'src/api/minio/file.model';
import { Controller, Post, Body, UseInterceptors, UploadedFile, BadRequestException, Inject } from '@nestjs/common'
import { FileUploadService } from './file-upload.service'
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentUser } from 'src/decorators/user.decorator';
import { ApiController } from '../jwt.check.controller';
import { IUserProfileDto } from '../users/dto/user.dto';

@Controller('upload')
@ApiTags('Upload')
// @UseGuards(JwtAuthGuard, PermissionGuard)
export class FileUploadController extends ApiController {
  constructor(private readonly fileUploadService: FileUploadService){
    super()
  }

	@Post()
	@ApiBearerAuth('JWT-auth')
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
        properties: {
          is_face_image: {
            type: 'boolean',
            default: false
          },
          file: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    })
    @UseInterceptors(
        FileInterceptor('file'),
      )
	    async uploadFile(@UploadedFile() file: Express.Multer.File, @CurrentUser() user:IUserProfileDto, @Body() body: { is_face_image?: string | boolean }): Promise<{fileUrl: string}> {

       const isFaceImage = body.is_face_image === 'true' || body.is_face_image === true;
            
            const fileBuffer: BufferedFile = {
                encoding: file.encoding,
                mimetype: file.mimetype as AppMimeType,
                originalname: file.originalname,
                fieldname: file.fieldname,
                size: file.size,
                buffer: file.buffer
            }

            if (isFaceImage) {
                const MAX_MAIN_IMAGE_SIZE = 50 * 1024; // 50KB
                if (fileBuffer.size > MAX_MAIN_IMAGE_SIZE) {
                    const uploadedKb = (file.size / 1024).toFixed(2);
                    throw new BadRequestException(
        `Profil rasmi (is_face_image) maksimal 50 KB bo'lishi kerak. ` +
        `Siz yuklagan fayl: ${uploadedKb} KB`
      );
                }
                return await this.fileUploadService.uploadFile(fileBuffer)
            } else if(!isFaceImage) {
              return await this.fileUploadService.uploadFile(fileBuffer)
            }
	}
}
