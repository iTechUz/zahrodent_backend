"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinioClientService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = require("crypto");
const nestjs_minio_client_1 = require("nestjs-minio-client");
const mammoth = require("mammoth");
const configService = new config_1.ConfigService();
let MinioClientService = class MinioClientService {
    get client() {
        return this.minio.client;
    }
    constructor(minio) {
        this.minio = minio;
        this.baseBucket = configService.get('MINIO_BUCKET');
        this.logger = new common_1.Logger('MinioStorageService');
    }
    async upload(file, baseBucket = this.baseBucket) {
        if (!(file.mimetype.includes('jpeg') ||
            file.mimetype.includes('png') ||
            file.mimetype.includes('jpg') ||
            file.mimetype.includes('webp') ||
            file.mimetype.includes('gif') ||
            file.mimetype.includes('svg+xml') ||
            file.mimetype.includes('tiff') ||
            file.mimetype.includes('bmp') ||
            file.mimetype.includes('x-icon') ||
            file.mimetype.includes('mp4') ||
            file.mimetype.includes('webm') ||
            file.mimetype.includes('mov') ||
            file.mimetype.includes('application/msword'))) {
            throw new common_1.HttpException('Invalid file type', common_1.HttpStatus.BAD_REQUEST);
        }
        const temp_filename = Date.now().toString();
        const hashedFileName = crypto
            .createHash('md5')
            .update(temp_filename)
            .digest('hex');
        const ext = file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);
        const metaData = {
            'Content-Type': file.mimetype
        };
        const filename = hashedFileName + ext;
        const fileName = `${filename}`;
        const fileBuffer = file.buffer;
        try {
            this.logger.log(`Attempting to upload file to ${baseBucket}/${fileName}`);
            this.logger.log(`MinIO endpoint: ${configService.get('MINIO_ENDPOINT')}`);
            this.logger.log(`MinIO port: ${configService.get('MINIO_PORT')}`);
            await new Promise((resolve, reject) => {
                this.client.putObject(baseBucket, fileName, fileBuffer, metaData, err => {
                    if (err) {
                        this.logger.error(`Error uploading file: ${err.message}`);
                        this.logger.error(`Error details: ${JSON.stringify(err)}`);
                        reject(new common_1.HttpException(`Error uploading file: ${err.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR));
                    }
                    resolve(null);
                });
            });
            return {
                url: `https://${configService.get('MINIO_ENDPOINT')}/${configService.get('MINIO_BUCKET')}/${filename}`
            };
        }
        catch (error) {
            this.logger.error(`Failed to upload file: ${error.message}`);
            throw new common_1.HttpException(`Failed to upload file: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async uploadFile(file, baseBucket = this.baseBucket) {
        if (!(file.mimetype.includes('jpeg') ||
            file.mimetype.includes('png') ||
            file.mimetype.includes('jpg') ||
            file.mimetype.includes('webp') ||
            file.mimetype.includes('gif') ||
            file.mimetype.includes('svg+xml') ||
            file.mimetype.includes('tiff') ||
            file.mimetype.includes('bmp') ||
            file.mimetype.includes('x-icon') ||
            file.mimetype.includes('mp4') ||
            file.mimetype.includes('webm') ||
            file.mimetype.includes('mov') ||
            file.mimetype.includes('application/octet-stream') ||
            file.mimetype.includes('pdf') ||
            file.mimetype.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'))) {
            throw new common_1.HttpException('Invalid file type', common_1.HttpStatus.BAD_REQUEST);
        }
        const temp_filename = Date.now().toString();
        const hashedFileName = crypto
            .createHash('md5')
            .update(temp_filename)
            .digest('hex');
        const ext = file.originalname.substring(file.originalname.lastIndexOf('.'), file.originalname.length);
        const metaData = {
            'Content-Type': file.mimetype
        };
        const filename = hashedFileName + ext;
        const fileName = `${filename}`;
        const fileBuffer = file.buffer;
        try {
            this.logger.log(`Attempting to upload file to ${baseBucket}/${fileName}`);
            this.logger.log(`MinIO endpoint: ${configService.get('MINIO_ENDPOINT')}`);
            this.logger.log(`MinIO port: ${configService.get('MINIO_PORT')}`);
            await new Promise((resolve, reject) => {
                this.client.putObject(baseBucket, fileName, fileBuffer, metaData, err => {
                    if (err) {
                        this.logger.error(`Error uploading file: ${err.message}`);
                        this.logger.error(`Error details: ${JSON.stringify(err)}`);
                        reject(new common_1.HttpException(`Error uploading file: ${err.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR));
                    }
                    resolve(null);
                });
            });
            return {
                url: `${filename}`
            };
        }
        catch (error) {
            this.logger.error(`Failed to upload file: ${error.message}`);
            throw new common_1.HttpException(`Failed to upload file: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async delete(objetName, baseBucket = this.baseBucket) {
        try {
            await new Promise((resolve, reject) => {
                this.client.removeObject(baseBucket, objetName, err => {
                    if (err) {
                        this.logger.error(`Error deleting file: ${err}`);
                        reject(new common_1.HttpException(`Error deleting file: ${err}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR));
                    }
                    resolve(null);
                });
            });
        }
        catch (error) {
            this.logger.error(`Failed to delete file: ${error.message}`);
            throw new common_1.HttpException(`Failed to delete file: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async readFile(file) {
        try {
            const stream = await this.client.getObject(this.baseBucket, file);
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('error', (err) => reject(err));
                stream.on('end', () => resolve(Buffer.concat(chunks)));
            });
        }
        catch (error) {
            this.logger.error(`Failed to read file: ${error.message}`);
            throw new common_1.HttpException(`Failed to read file: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getDocxText(fileName) {
        const fileBuffer = await this.readFile(fileName);
        const { value: text } = await mammoth.extractRawText({ buffer: fileBuffer });
        return text;
    }
    async statObject(key) {
        try {
            const stats = await this.client.statObject(this.baseBucket, key);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to get file stats: ${error.message}`);
            throw new common_1.HttpException(`Failed to get file stats: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            return false;
        }
    }
};
exports.MinioClientService = MinioClientService;
exports.MinioClientService = MinioClientService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nestjs_minio_client_1.MinioService])
], MinioClientService);
//# sourceMappingURL=minio-client.service.js.map