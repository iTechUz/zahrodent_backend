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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const users_service_1 = require("../users/users.service");
const constantis_1 = require("../../constantis");
const hashing_1 = require("../../utils/hashing");
const prisma_service_1 = require("../../prisma.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService, usersService, hashingService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.usersService = usersService;
        this.hashingService = hashingService;
    }
    async login(loginDto) {
        const user = await this.prisma.user.findFirst({
            where: {
                phone: loginDto.phone,
                status: {
                    in: [constantis_1.STATUS.ACTIVE]
                }
            },
            include: {
                roles: {
                    select: {
                        id: true
                    }
                },
                branches: true
            }
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        console.log(loginDto.password);
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        console.log(isPasswordValid);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid password');
        }
        const token = this.jwtService.sign({ sub: user.id, role: user.roles.id });
        return {
            token,
            branches: user.branches.map(branch => branch)
        };
    }
    async changePassword(changePasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: {
                phone: changePasswordDto.phone
            }
        });
        if (!user)
            throw new common_1.NotFoundException("User not found");
        const isPasswordValid = await bcrypt.compare(changePasswordDto.oldPassword, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid password');
        }
        const hashedPassword = await this.hashingService.hashPassword(changePasswordDto.newPassword);
        return await this.prisma.user.update({
            where: {
                phone: changePasswordDto.phone
            },
            data: {
                password: hashedPassword
            }
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        users_service_1.UsersService,
        hashing_1.HashingService])
], AuthService);
//# sourceMappingURL=auth.service.js.map