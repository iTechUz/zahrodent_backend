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
exports.CrudController = CrudController;
const jwt_check_controller_1 = require("../api/jwt.check.controller");
const user_decorator_1 = require("../decorators/user.decorator");
const paginations_1 = require("../utils/paginations");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
function CrudController(CreateDto, UpdateDto) {
    let BaseController = class BaseController extends jwt_check_controller_1.ApiController {
        constructor(service) {
            super();
            this.service = service;
        }
        async findAll(query, user) {
            return await this.service.findAll(query, user);
        }
        findOne(id, user) {
            return this.service.findOne(id, user);
        }
        create(dto, user) {
            return this.service.create(dto, user);
        }
        update(id, dto, user) {
            return this.service.update(id, dto, user);
        }
        remove(id, user) {
            return this.service.remove(id, user);
        }
    };
    __decorate([
        (0, common_1.Get)(),
        (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
        (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
        (0, swagger_1.ApiQuery)({ type: paginations_1.PaginationDto }),
        __param(0, (0, common_1.Query)()),
        __param(1, (0, user_decorator_1.CurrentUser)()),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", [paginations_1.PaginationDto, Object]),
        __metadata("design:returntype", Promise)
    ], BaseController.prototype, "findAll", null);
    __decorate([
        (0, common_1.Get)(':id'),
        (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
        (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
        __param(0, (0, common_1.Param)('id')),
        __param(1, (0, user_decorator_1.CurrentUser)()),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", [String, Object]),
        __metadata("design:returntype", void 0)
    ], BaseController.prototype, "findOne", null);
    __decorate([
        (0, common_1.Post)(),
        (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
        (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
        (0, swagger_1.ApiBody)({ type: CreateDto }),
        __param(0, (0, common_1.Body)()),
        __param(1, (0, user_decorator_1.CurrentUser)()),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", [Object, Object]),
        __metadata("design:returntype", void 0)
    ], BaseController.prototype, "create", null);
    __decorate([
        (0, common_1.Put)(':id'),
        (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
        (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
        (0, swagger_1.ApiBody)({ type: UpdateDto }),
        __param(0, (0, common_1.Param)('id')),
        __param(1, (0, common_1.Body)()),
        __param(2, (0, user_decorator_1.CurrentUser)()),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", [String, Object, Object]),
        __metadata("design:returntype", void 0)
    ], BaseController.prototype, "update", null);
    __decorate([
        (0, common_1.Delete)(':id'),
        (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
        (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
        __param(0, (0, common_1.Param)('id')),
        __param(1, (0, user_decorator_1.CurrentUser)()),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", [String, Object]),
        __metadata("design:returntype", void 0)
    ], BaseController.prototype, "remove", null);
    BaseController = __decorate([
        (0, swagger_1.ApiBearerAuth)(),
        __metadata("design:paramtypes", [Object])
    ], BaseController);
    return BaseController;
}
//# sourceMappingURL=base.service.js.map