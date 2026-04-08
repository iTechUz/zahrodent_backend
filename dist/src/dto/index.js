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
exports.monthDto = exports.startEndDateDto = exports.checkById = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const cuid_1 = require("../validator/cuid");
class checkById {
}
exports.checkById = checkById;
__decorate([
    (0, swagger_1.ApiProperty)({ required: true, example: 'uuid', description: 'Lesson ID' }),
    (0, class_validator_1.IsString)(),
    (0, cuid_1.IsCuid)(),
    __metadata("design:type", String)
], checkById.prototype, "id", void 0);
class startEndDateDto {
}
exports.startEndDateDto = startEndDateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '2024-01-01', description: 'Start Date' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], startEndDateDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '2026-01-31', description: 'End Date' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], startEndDateDto.prototype, "endDate", void 0);
class monthDto {
}
exports.monthDto = monthDto;
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: 'sentabr', description: 'Month Name' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], monthDto.prototype, "month", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: 2026, description: 'Year' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], monthDto.prototype, "year", void 0);
//# sourceMappingURL=index.js.map