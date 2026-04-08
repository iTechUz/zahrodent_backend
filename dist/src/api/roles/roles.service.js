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
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const constantis_1 = require("../../constantis");
const prisma_service_1 = require("../../prisma.service");
let RolesService = class RolesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(pagination, user) {
        const { page, pageSize, search, sortBy } = pagination;
        let where = {
            name: {
                not: constantis_1.RolesEnum.SUPER_ADMIN
            }
        };
        if (search) {
            where = {
                ['AND']: [
                    { name: { not: constantis_1.RolesEnum.SUPER_ADMIN } },
                    {
                        name: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    }
                ]
            };
        }
        const data = await this.prisma.roles.findMany({
            where,
            take: pageSize,
            skip: (page - 1) * pageSize,
            orderBy: {
                createdAt: sortBy.toLocaleLowerCase() === 'asc' ? 'asc' : 'desc'
            },
            include: {
                permission: true,
                _count: {
                    select: {
                        permission: true
                    }
                }
            }
        });
        const total = await this.prisma.roles.count();
        return {
            data,
            meta: {
                total,
                page,
                pageSize,
                pageCount: Math.ceil(total / pageSize)
            }
        };
    }
    async findOne(id, user) {
        let role = await this.prisma.roles.findUnique({
            where: { id },
            include: {
                users: true,
                permission: true
            }
        });
        if (!role) {
            throw new common_1.NotFoundException(`Role with ID ${id} not found`);
        }
        role['permissions'] = role.permission.reduce((acc, el) => {
            acc[el.name] = {
                ...el
            };
            return acc;
        }, {});
        return role;
    }
    async create(data, user) {
        const { name, permissions } = data;
        const _data = await this.prisma.$transaction(async (ctx) => {
            const role = await ctx.roles.findFirst({ where: { name } });
            if (role)
                throw new common_1.BadRequestException('Role already exists with this name');
            const createRole = await ctx.roles.create({
                data: { name }
            });
            for (let key in permissions) {
                await ctx.permission.create({
                    data: {
                        roleId: createRole.id,
                        name: key,
                        ...permissions[key]
                    }
                });
            }
            return await ctx.roles.findFirst({
                where: {
                    name
                },
                include: {
                    permission: true
                }
            });
        });
        return _data;
    }
    async update(id, data, user) {
        const item = await this.findOne(id, user);
        const per = data.permissions;
        return await this.prisma.$transaction(async (ctx) => {
            for (let key in per) {
                const find = await ctx.permission.findFirst({
                    where: {
                        roleId: id,
                        name: key
                    }
                });
                if (find)
                    await ctx.permission.update({
                        where: { id: find.id },
                        data: per[key]
                    });
                if (!find) {
                    await ctx.permission.create({
                        data: {
                            roleId: item.id,
                            name: key,
                            ...per[key]
                        }
                    });
                }
            }
            return true;
        });
    }
    async remove(id, user) {
        const role = await this.findOne(id, user);
        if (role.users.length > 0) {
            throw new common_1.NotFoundException('Role cannot be deleted because it is assigned to users');
        }
        return await this.prisma.$transaction(async (ctx) => {
            const role = await ctx.roles.findFirst({
                where: {
                    id
                },
                include: {
                    permission: true
                }
            });
            const per = role.permission;
            for (let i = 0; i < per.length; i++) {
                const { id } = per[i];
                await ctx.permission.delete({
                    where: {
                        id
                    }
                });
            }
            await ctx.roles.delete({
                where: { id }
            });
            return { success: true, message: 'role success remove' };
        });
    }
    async getSomeRoles() {
        const arr = ['STUDENT', 'TEACHER', 'SUPER_ADMIN', 'ADMIN'];
        return this.prisma.roles.findMany({
            where: {
                name: {
                    notIn: arr
                }
            }
        });
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RolesService);
//# sourceMappingURL=roles.service.js.map