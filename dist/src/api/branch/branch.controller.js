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
exports.BranchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const constantis_1 = require("../../constantis");
const permissions_decorator_1 = require("../../decorators/permissions.decorator");
const role_decorator_1 = require("../../decorators/role.decorator");
const check_role_groard_1 = require("../../guards/check.role.groard");
const jwt_guard_1 = require("../../guards/jwt.guard");
const paginations_1 = require("../../utils/paginations");
const jwt_check_controller_1 = require("../jwt.check.controller");
const branch_service_1 = require("./branch.service");
const dto_1 = require("./dto");
let BranchController = class BranchController extends jwt_check_controller_1.ApiController {
    async getAllBranches(pagination) {
        return this.branchService.findAll(pagination);
    }
    async getBranchById(id) {
        return this.branchService.findOne(id);
    }
    async createBranch(data) {
        return this.branchService.create(data);
    }
    async updateBranch(id, data) {
        return this.branchService.update(id, data);
    }
    async deleteBranch(id) {
        return this.branchService.remove(id);
    }
};
exports.BranchController = BranchController;
__decorate([
    (0, common_1.Inject)(),
    __metadata("design:type", branch_service_1.BranchService)
], BranchController.prototype, "branchService", void 0);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermission)('read'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [paginations_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], BranchController.prototype, "getAllBranches", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.RequirePermission)('view'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BranchController.prototype, "getBranchById", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.BranchCreateDto]),
    __metadata("design:returntype", Promise)
], BranchController.prototype, "createBranch", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, permissions_decorator_1.RequirePermission)('update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.BranchCreateDto]),
    __metadata("design:returntype", Promise)
], BranchController.prototype, "updateBranch", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.RequirePermission)('remove'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BranchController.prototype, "deleteBranch", null);
exports.BranchController = BranchController = __decorate([
    (0, swagger_1.ApiTags)('Branch'),
    (0, swagger_1.ApiBearerAuth)('JWT-auth'),
    (0, common_1.Controller)('branch'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, check_role_groard_1.RolesGuard),
    (0, role_decorator_1.RolesD)(constantis_1.RolesEnum.ADMIN, constantis_1.RolesEnum.SUPER_ADMIN)
], BranchController);
//# sourceMappingURL=branch.controller.js.map