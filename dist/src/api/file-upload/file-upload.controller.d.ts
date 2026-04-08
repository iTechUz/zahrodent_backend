import { FileUploadService } from './file-upload.service';
import { User } from '@prisma/client';
export declare class FileUploadController {
    private fileUploadService;
    constructor(fileUploadService: FileUploadService);
    uploadFile(file: Express.Multer.File, user: User, body: {
        is_face_image?: string | boolean;
    }): Promise<{
        fileUrl: string;
    }>;
}
