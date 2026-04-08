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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploadController = void 0;
const common_1 = require("@nestjs/common");
const file_upload_service_1 = require("./file-upload.service");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const permissions_decorator_1 = require("../../decorators/permissions.decorator");
const user_decorator_1 = require("../../decorators/user.decorator");
let FileUploadController = class FileUploadController {
    constructor(fileUploadService) {
        this.fileUploadService = fileUploadService;
    }
    async uploadFile(file, user, body) {
        const isFaceImage = body.is_face_image === 'true' || body.is_face_image === true;
        const fileBuffer = {
            encoding: file.encoding,
            mimetype: file.mimetype,
            originalname: file.originalname,
            fieldname: file.fieldname,
            size: file.size,
            buffer: file.buffer
        };
        if (isFaceImage) {
            const MAX_MAIN_IMAGE_SIZE = 50 * 1024;
            if (fileBuffer.size > MAX_MAIN_IMAGE_SIZE) {
                const uploadedKb = (file.size / 1024).toFixed(2);
                throw new common_1.BadRequestException(`Profil rasmi (is_face_image) maksimal 50 KB bo'lishi kerak. ` +
                    `Siz yuklagan fayl: ${uploadedKb} KB`);
            }
            return await this.fileUploadService.uploadFile(fileBuffer);
        }
        else if (!isFaceImage) {
            return await this.fileUploadService.uploadFile(fileBuffer);
        }
    }
};
exports.FileUploadController = FileUploadController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, permissions_decorator_1.RequirePermission)('upload'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
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
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], FileUploadController.prototype, "uploadFile", null);
exports.FileUploadController = FileUploadController = __decorate([
    (0, common_1.Controller)('upload'),
    (0, swagger_1.ApiTags)('Upload'),
    __metadata("design:paramtypes", [file_upload_service_1.FileUploadService])
], FileUploadController);
//# sourceMappingURL=file-upload.controller.js.map