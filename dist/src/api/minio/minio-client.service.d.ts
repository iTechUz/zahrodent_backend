import { MinioClient, MinioService } from 'nestjs-minio-client';
import { BufferedFile } from './file.model';
export declare class MinioClientService {
    private readonly minio;
    private readonly logger;
    private readonly baseBucket;
    get client(): MinioClient;
    constructor(minio: MinioService);
    upload(file: BufferedFile, baseBucket?: string): Promise<{
        url: string;
    }>;
    uploadFile(file: BufferedFile, baseBucket?: string): Promise<{
        url: string;
    }>;
    delete(objetName: string, baseBucket?: string): Promise<void>;
    readFile(file: string): Promise<Buffer>;
    getDocxText(fileName: string): Promise<string>;
    statObject(key: string): Promise<boolean>;
}
