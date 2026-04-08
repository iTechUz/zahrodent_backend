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
exports.PermissionUpdateDto = exports.RoleUpdateDto = exports.RoleCreateDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const decorators_1 = require("../../../decorators");
class RoleCreateDto {
}
exports.RoleCreateDto = RoleCreateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'name', description: 'name' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RoleCreateDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: {
            users: {
                read: true,
                create: false,
                update: true,
                remove: false,
                view: true,
                filter: false
            }
        },
        description: 'permissions'
    }),
    (0, class_validator_1.IsObject)(),
    (0, decorators_1.IsPermissionsObject)({
        message: 'Each permission must be an object with only these actions: read, create, update, remove, view, filter and their values must be boolean.'
    }),
    __metadata("design:type", Object)
], RoleCreateDto.prototype, "permissions", void 0);
class RoleUpdateDto {
}
exports.RoleUpdateDto = RoleUpdateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'name', description: 'name' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RoleUpdateDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: {
            users: {
                read: true,
                create: false,
                update: true,
                remove: false,
                view: true,
                filter: false
            }
        },
        description: 'permissions'
    }),
    (0, class_validator_1.IsObject)(),
    (0, decorators_1.IsPermissionsObject)({
        message: 'Each permission must be an object with only these actions: read, create, update, remove, view, filter and their values must be boolean.'
    }),
    __metadata("design:type", Object)
], RoleUpdateDto.prototype, "permissions", void 0);
class PermissionUpdateDto {
}
exports.PermissionUpdateDto = PermissionUpdateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'name', description: 'name' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PermissionUpdateDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "read", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "create", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "update", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "remove", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "view", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "filter", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "export", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "import", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "upload", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "print", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "share", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Should be boolean' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PermissionUpdateDto.prototype, "restore", void 0);
//# sourceMappingURL=index.js.map