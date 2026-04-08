import { BufferedFile } from 'src/api/minio/file.model';
import { MinioClientService } from 'src/api/minio/minio-client.service';
export declare class FileUploadService {
    private minioClientService;
    constructor(minioClientService: MinioClientService);
    upload(file: BufferedFile | BufferedFile[]): Promise<string | string[]>;
    private uploadSingle;
    private uploadMultiple;
    uploadFile(file: BufferedFile): Promise<{
        fileUrl: string;
    }>;
    readFile(file: string): Promise<string>;
    hasFile(key: string): Promise<boolean>;
}
