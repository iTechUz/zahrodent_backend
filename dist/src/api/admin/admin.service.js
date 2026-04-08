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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const constantis_1 = require("../../constantis");
const prisma_service_1 = require("../../prisma.service");
const hashing_service_1 = require("../../utils/hashing/hashing.service");
let AdminService = class AdminService {
    constructor(prismaService, hashService) {
        this.prismaService = prismaService;
        this.hashService = hashService;
    }
    async findAll(pagination, user) {
        const { page, pageSize, search } = pagination;
        let where = {};
        if (search) {
            where = {
                OR: [
                    { phone: { contains: search, mode: 'insensitive' } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } }
                ]
            };
        }
        const data = await this.prismaService.user.findMany({
            where: {
                ...where,
                status: constantis_1.STATUS.ACTIVE,
                roles: {
                    name: constantis_1.RolesEnum.ADMIN
                }
            },
            include: {
                roles: {
                    select: { name: true, id: true }
                },
                branches: {
                    select: { id: true, name: true }
                }
            },
            skip: (page - 1) * pageSize,
            take: pageSize
        });
        const total = await this.prismaService.user.count({
            where: { ...where, status: constantis_1.STATUS.ACTIVE, roles: { name: constantis_1.RolesEnum.ADMIN } }
        });
        return {
            data,
            meta: {
                page,
                pageSize,
                total,
                pageCount: Math.ceil(total / pageSize)
            }
        };
    }
    async findOne(id, user) {
        const foundUser = await this.prismaService.user.findUnique({
            where: { id, roles: {
                    name: constantis_1.RolesEnum.ADMIN
                } },
            include: {
                roles: true,
                branches: true
            }
        });
        if (!foundUser) {
            throw new common_1.NotFoundException(`User with ID ${id} not found`);
        }
        return foundUser;
    }
    async create(data, user) {
        const adminRole = await this.prismaService.roles.findFirst({
            where: { name: constantis_1.RolesEnum.ADMIN }
        });
        const isExists = await this.prismaService.user.findFirst({
            where: {
                phone: data.phone,
                roles: {
                    id: adminRole.id
                }
            }
        });
        if (isExists)
            throw new common_1.ConflictException('Admin already exists with this phone number');
        return await this.prismaService.user.create({
            data: {
                phone: data.phone,
                firstName: data.firstName,
                lastName: data.lastName,
                password: await this.hashService.hashPassword(data.password),
                roles: {
                    connect: {
                        id: adminRole.id
                    }
                },
                branches: {
                    connect: data.branchIds.map(branchId => ({ id: branchId }))
                }
            }
        });
    }
    async update(id, data, user) {
        await this.findOne(id, user);
        const { branchIds, ...datas } = data;
        const areBranchesExist = await this.prismaService.branch.findMany({
            where: { id: { in: branchIds } }
        });
        if (branchIds?.length) {
            datas['branches'] = {
                set: branchIds.map(branchId => ({ id: branchId }))
            };
        }
        if (datas.password)
            datas.password = await this.hashService.hashPassword(data.password);
        return await this.prismaService.user.update({
            where: { id },
            data: {
                ...datas
            }
        });
    }
    async remove(id, user) {
        await this.findOne(id, user);
        return await this.prismaService.user.update({
            where: { id },
            data: {
                status: constantis_1.STATUS.DELETED
            }
        });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        hashing_service_1.HashingService])
], AdminService);
//# sourceMappingURL=admin.service.js.map