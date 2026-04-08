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
exports.PermissionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
const prisma_service_1 = require("../prisma.service");
let PermissionGuard = class PermissionGuard {
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const action = this.reflector.get(permissions_decorator_1.PERMISSION_KEY, context.getHandler());
        if (!action)
            return true;
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (user.roleName === 'SUPER_ADMIN')
            return true;
        const path = request.route.path;
        const moduleName = extractModuleFromPath(path);
        const findRolePermis = await this.prisma.permission.findFirst({
            where: {
                roleId: user.roleId,
                name: moduleName
            },
            include: {
                role: {
                    select: {
                        name: true
                    }
                }
            }
        });
        if (!findRolePermis) {
            throw new common_1.ForbiddenException('No permissions assigned');
        }
        const hasPermission = findRolePermis[action];
        if (!hasPermission) {
            throw new common_1.ForbiddenException(`Permission "${action}" denied for module "${moduleName}"`);
        }
        return true;
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector, prisma_service_1.PrismaService])
], PermissionGuard);
function extractModuleFromPath(path) {
    const parts = path.split('/');
    return parts[2] || 'unknown';
}
//# sourceMappingURL=permissions.guard.js.map