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
exports.FileUploadService = void 0;
const common_1 = require("@nestjs/common");
const minio_client_service_1 = require("../minio/minio-client.service");
let FileUploadService = class FileUploadService {
    constructor(minioClientService) {
        this.minioClientService = minioClientService;
    }
    async upload(file) {
        if (Array.isArray(file)) {
            return this.uploadMultiple(file);
        }
        return await this.uploadSingle(file);
    }
    async uploadSingle(file) {
        const uploadResult = await this.minioClientService.upload(file);
        return uploadResult.url;
    }
    async uploadMultiple(files) {
        const uploadPromises = files.map(file => this.minioClientService.upload(file));
        const uploadResults = await Promise.all(uploadPromises);
        return uploadResults.map(result => result.url);
    }
    async uploadFile(file) {
        const uploadResult = await this.minioClientService.uploadFile(file);
        return { fileUrl: uploadResult.url };
    }
    async readFile(file) {
        const data = await this.minioClientService.getDocxText(file);
        return data;
    }
    async hasFile(key) {
        try {
            await this.minioClientService.statObject(key);
            return true;
        }
        catch (error) {
            if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
                return false;
            }
            throw error;
        }
    }
};
exports.FileUploadService = FileUploadService;
exports.FileUploadService = FileUploadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [minio_client_service_1.MinioClientService])
], FileUploadService);
//# sourceMappingURL=file-upload.service.js.map