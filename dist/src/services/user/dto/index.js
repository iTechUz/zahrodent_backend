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
exports.UserProfileDto = exports.SetCurrentBranchDto = exports.filterByUserDto = exports.UpdateUserDto = exports.CreateUserDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const paginations_1 = require("../../../utils/paginations");
const cuid_1 = require("../../../validator/cuid");
class CreateUserDto {
}
exports.CreateUserDto = CreateUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'John', description: 'First name' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Doe', description: 'Last name' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+1234567890', description: 'User phone number' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'password123', description: 'User password' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'file url', description: 'file url' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "image", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'uuid',
        description: 'User role'
    }),
    (0, cuid_1.IsCuid)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "roleId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'uuid',
        description: 'Current Branch Id'
    }),
    (0, cuid_1.IsCuid)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "currentBranchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: ['uuid'],
        description: 'User branches'
    }),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateUserDto.prototype, "branchIds", void 0);
class UpdateUserDto extends (0, swagger_1.PartialType)(CreateUserDto) {
}
exports.UpdateUserDto = UpdateUserDto;
class filterByUserDto extends paginations_1.PaginationDto {
}
exports.filterByUserDto = filterByUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        required: false,
        description: 'Role id'
    }),
    (0, class_validator_1.IsOptional)(),
    (0, cuid_1.IsCuid)(),
    __metadata("design:type", String)
], filterByUserDto.prototype, "roleId", void 0);
class SetCurrentBranchDto {
}
exports.SetCurrentBranchDto = SetCurrentBranchDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'uuid', description: 'Branch Id' }),
    (0, class_validator_1.IsString)(),
    (0, cuid_1.IsCuid)(),
    __metadata("design:type", String)
], SetCurrentBranchDto.prototype, "branchId", void 0);
class UserProfileDto {
}
exports.UserProfileDto = UserProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'John', description: 'First name' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserProfileDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Doe', description: 'Last name' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserProfileDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '+1234567890', description: 'Phone number' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserProfileDto.prototype, "phone", void 0);
//# sourceMappingURL=index.js.map