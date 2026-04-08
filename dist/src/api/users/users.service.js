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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const constantis_1 = require("../../constantis");
const hashing_1 = require("../../utils/hashing");
const prisma_service_1 = require("../../prisma.service");
const date_time_service_1 = require("../date-time/date-time.service");
let UsersService = class UsersService {
    constructor(prisma, dateTimeService, hashService) {
        this.prisma = prisma;
        this.dateTimeService = dateTimeService;
        this.hashService = hashService;
    }
    async findAll(pagination) {
        const { page, pageSize, search, sortBy, roleId } = pagination;
        let where = {};
        if (roleId) {
            const role = await this.prisma.roles.findFirst({
                where: {
                    id: roleId,
                    name: {
                        notIn: [constantis_1.RolesEnum.SUPER_ADMIN]
                    }
                }
            });
            if (!role)
                throw new common_1.NotFoundException('Role not found');
            where['roleId'] = roleId;
        }
        const total = await this.prisma.user.count({
            where: {
                ...where,
                status: constantis_1.STATUS.ACTIVE,
                roles: {
                    name: {
                        notIn: [constantis_1.RolesEnum.SUPER_ADMIN]
                    }
                }
            }
        });
        const data = await this.prisma.user.findMany({
            take: pageSize,
            skip: (page - 1) * pageSize,
            where: {
                ...where,
                status: constantis_1.STATUS.ACTIVE,
                roles: {
                    name: {
                        notIn: [constantis_1.RolesEnum.SUPER_ADMIN]
                    }
                },
                OR: search
                    ? [
                        { firstName: { contains: search, mode: 'insensitive' } },
                        { lastName: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search, mode: 'insensitive' } }
                    ]
                    : undefined
            },
            orderBy: {
                createdAt: sortBy.toLocaleLowerCase() === 'asc' ? 'asc' : 'desc'
            },
            include: {
                roles: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                branches: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        phone: true
                    }
                }
            }
        });
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
    async findOne(id, currentUser) {
        const user = await this.prisma.user.findUnique({
            where: { id, status: constantis_1.STATUS.ACTIVE },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                image: true,
                roles: {
                    select: {
                        id: true,
                        name: true,
                        permission: {
                            select: {
                                id: true,
                                name: true,
                                read: true,
                                create: true,
                                update: true,
                                remove: true,
                                view: true,
                                export: true,
                                filter: true,
                                import: true,
                                print: true,
                                share: true,
                                upload: true,
                                restore: true,
                                roleId: true
                            }
                        }
                    }
                },
                branches: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        user.roles['permissions'] = user.roles.permission.reduce((acc, el) => {
            acc[el.name] = {
                read: el.read,
                create: el.create,
                update: el.update,
                remove: el.remove,
                view: el.view,
                export: el.export,
                filter: el.filter,
                import: el.import,
                print: el.print,
                share: el.share,
                upload: el.upload,
                restore: el.restore
            };
            return acc;
        }, {});
        if (user.roles.name === constantis_1.RolesEnum.SUPER_ADMIN) {
            user.roles['permissions'] = {
                all: true
            };
        }
        delete user.roles.permission;
        return user;
    }
    async setCurrentBranch(user, branchId) {
        const branchData = await this.prisma.user.findFirst({
            where: {
                id: user.id,
                status: constantis_1.STATUS.ACTIVE,
                branches: {
                    some: {
                        id: branchId
                    }
                }
            }
        });
        if (!branchData)
            throw new common_1.NotFoundException('Branch does not exist or you do not have access');
        return await this.prisma.user.update({
            where: { id: user.id },
            data: { currentBranchId: branchId }
        });
    }
    async remove(id) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return this.prisma.user.update({
            where: { id },
            data: { status: constantis_1.STATUS.DELETED }
        });
    }
    async create(user, data) {
        let arr = ['STUDENT', 'TEACHER', 'SUPER_ADMIN', 'ADMIN'];
        const branchId = user.currentBranchId || data.currentBranchId;
        if (!branchId)
            throw new common_1.NotFoundException('branch does not exist');
        if (constantis_1.phoneRegEx.test(data.phone) === false) {
            throw new common_1.NotFoundException('Phone number is not valid');
        }
        const itemUser = await this.prisma.user.findFirst({
            where: {
                phone: data.phone
            }
        });
        if (itemUser) {
            throw new common_1.NotFoundException('User already exists or phone number already exists');
        }
        const { roleId, branchIds, ...rest } = data;
        const role = await this.prisma.roles.findUnique({
            where: {
                id: roleId
            }
        });
        if (!role || arr.includes(role.name))
            throw new common_1.NotFoundException('Role does not exist or you do not have access');
        const ids = branchIds.map(el => ({ id: el }));
        const hashPassword = await this.hashService.hashPassword(rest.password);
        return await this.prisma.user.create({
            data: {
                ...rest,
                roles: {
                    connect: {
                        id: data.roleId
                    }
                },
                password: hashPassword,
                branches: {
                    connect: ids
                }
            }
        });
    }
    async update(id, data) {
        {
            await this.findOne(id);
            if (data.phone && constantis_1.phoneRegEx.test(data.phone) === false) {
                throw new common_1.NotFoundException('Phone number is not valid');
            }
            if (data.branchIds?.length) {
                const ids = await data.branchIds.map(el => ({ id: el }));
                data['branches'] = {
                    connect: ids
                };
                delete data.branchIds;
            }
            if (data.password) {
                data.password = await this.hashService.hashPassword(data.password);
            }
            return await this.prisma.user.update({
                where: { id, status: constantis_1.STATUS.ACTIVE },
                data: {
                    ...data
                }
            });
        }
    }
    async numberOfUsers() {
        const allUsers = await this.prisma.user.count({
            where: {
                status: constantis_1.STATUS.ACTIVE
            }
        });
        const admins = await this.prisma.user.count({
            where: {
                status: constantis_1.STATUS.ACTIVE,
                roles: {
                    name: {
                        notIn: [constantis_1.RolesEnum.SUPER_ADMIN]
                    }
                }
            }
        });
        return {
            count: {
                all: allUsers,
                admins: admins
            }
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        date_time_service_1.DateTimeService,
        hashing_1.HashingService])
], UsersService);
//# sourceMappingURL=users.service.js.map