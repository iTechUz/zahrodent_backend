export interface BufferedFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: AppMimeType;
    size: number;
    buffer: Buffer | string;
}
export interface StoredFile extends HasFile, StoredFileMetadata {
}
export interface HasFile {
    file: Buffer | string;
}
export interface StoredFileMetadata {
    id: string;
    name: string;
    encoding: string;
    mimetype: AppMimeType;
    size: number;
    updatedAt: Date;
    fileSrc?: string;
}
export type AppMimeType = 'image/png' | 'image/jpeg' | 'image/jpg' | 'image/webp' | 'image/gif' | 'image/svg+xml' | 'image/tiff' | 'image/bmp' | 'image/x-icon' | 'video/mp4' | 'video/mpeg' | 'video/quicktime' | 'video/x-msvideo' | 'video/x-ms-wmv' | 'video/webm';
