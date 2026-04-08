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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_guard_1 = require("../../guards/jwt.guard");
const permissions_decorator_1 = require("../../decorators/permissions.decorator");
const user_decorator_1 = require("../../decorators/user.decorator");
const file_upload_service_1 = require("../file-upload/file-upload.service");
const user_dto_1 = require("./dto/user.dto");
const users_service_1 = require("./users.service");
let UsersController = class UsersController {
    constructor(usersService, fileUploadService) {
        this.usersService = usersService;
        this.fileUploadService = fileUploadService;
    }
    async findAll(pagination) {
        return this.usersService.findAll(pagination);
    }
    numberOfUsers() {
        return this.usersService.numberOfUsers();
    }
    getMe(user) {
        return this.usersService.findOne(user.id, user);
    }
    findOne(id) {
        return this.usersService.findOne(id);
    }
    async updateCurrentBranch(user, branchId) {
        return this.usersService.setCurrentBranch(user, branchId);
    }
    update(id, data) {
        return this.usersService.update(id, data);
    }
    delete(id) {
        return this.usersService.remove(id);
    }
    async uploadAvatar(user, body) {
        return this.usersService.create(user, body);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
    (0, permissions_decorator_1.RequirePermission)('read'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_dto_1.filterByUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('/number-of-users'),
    (0, permissions_decorator_1.RequirePermission)('read'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "numberOfUsers", null);
__decorate([
    (0, common_1.Get)('/me'),
    (0, permissions_decorator_1.RequirePermission)('view'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user information' }),
    __param(0, (0, user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "getMe", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.RequirePermission)('view'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':branchId'),
    (0, permissions_decorator_1.RequirePermission)('update'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
    (0, swagger_1.ApiBody)({ type: user_dto_1.SetCurrentBranchDto }),
    __param(0, (0, user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateCurrentBranch", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, permissions_decorator_1.RequirePermission)('update'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
    (0, swagger_1.ApiBody)({ type: user_dto_1.UpdateUserDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.RequirePermission)('remove'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Success' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not found' }),
    (0, swagger_1.ApiBody)({ type: user_dto_1.CreateUserDto }),
    __param(0, (0, user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, user_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "uploadAvatar", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('users'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        file_upload_service_1.FileUploadService])
], UsersController);
//# sourceMappingURL=users.controller.js.map